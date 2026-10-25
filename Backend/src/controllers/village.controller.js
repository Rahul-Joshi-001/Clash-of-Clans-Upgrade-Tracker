const { getPool } = require("../config/db");
const { parseVillageJson } = require("../utils/parseVillageJson");

async function matchVillageItems(req, res) {
  let connection;
  try {
    const villageData = req.body?.villageData || req.body;
    const userId = req.user.userId;
    if (!villageData || !villageData.tag) {
      return res.status(400).json({ success: false, message: "Valid Clash of Clans village JSON is required" });
    }

    const parsed = parseVillageJson(villageData);
    const playerTag = parsed.playerTag;
    const pool = getPool();
    connection = await pool.getConnection();

    const matchedItems = [];
    const unmatchedItems = [];
    let currentTownHall = parsed.currentTownHall ??
      (villageData.buildings || []).find(item => Number(item.data) === 1000001)?.lvl ?? null;
    currentTownHall = currentTownHall == null ? null : Number(currentTownHall);

    for (const item of parsed.items) {
      const result = await connection.execute(
        `SELECT ITEM_ID, ITEM_NAME, VILLAGE_TYPE, CATEGORY
         FROM GAME_ITEMS
         WHERE SOURCE_DATA_ID = :sourceDataId AND VILLAGE_TYPE = :villageType`,
        { sourceDataId: item.sourceDataId, villageType: item.village }
      );
      if (result.rows.length) {
        const catalog = result.rows[0];
        matchedItems.push({ ...item, catalog });
        if (item.village === "HOME" && String(catalog.ITEM_NAME).trim().toUpperCase() === "TOWN HALL") {
          currentTownHall = Number(item.level);
        }
      } else unmatchedItems.push(item);
    }

    await connection.execute("SAVEPOINT before_village_import");
    try {
      await connection.execute(
        `DELETE FROM USER_VILLAGE_ITEMS WHERE USER_ID = :userId AND PLAYER_TAG = :playerTag`,
        { userId, playerTag }
      );

      for (const item of matchedItems) {
        await connection.execute(
          `INSERT INTO USER_VILLAGE_ITEMS (
            USER_ID, ITEM_ID, QUANTITY, CURRENT_LEVEL, SUPERCHARGE_LEVEL,
            UPGRADE_TIMER_SECONDS, PLAYER_TAG, CREATED_AT, UPDATED_AT
          ) VALUES (
            :userId, :itemId, :quantity, :currentLevel, 0,
            :upgradeTimerSeconds, :playerTag, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          {
            userId,
            itemId: item.catalog.ITEM_ID,
            quantity: item.quantity,
            currentLevel: item.level,
            upgradeTimerSeconds: item.upgradeTimerSeconds ?? null,
            playerTag
          }
        );
      }

      if (currentTownHall != null) {
        await connection.execute(
          `INSERT INTO USER_VILLAGE_PROFILE (USER_ID, PLAYER_TAG, CURRENT_TOWN_HALL, UPDATED_AT)
           VALUES (:userId, :playerTag, :currentTownHall, CURRENT_TIMESTAMP)
           ON CONFLICT(USER_ID, PLAYER_TAG) DO UPDATE SET
             CURRENT_TOWN_HALL = excluded.CURRENT_TOWN_HALL,
             UPDATED_AT = CURRENT_TIMESTAMP`,
          { userId, playerTag, currentTownHall }
        );
      }

      await connection.execute(
        `INSERT INTO USER_VILLAGE_JSON (USER_ID, PLAYER_TAG, CURRENT_TOWN_HALL, VILLAGE_JSON, UPDATED_AT)
         VALUES (:userId, :playerTag, :currentTownHall, :villageJson, CURRENT_TIMESTAMP)
         ON CONFLICT(USER_ID) DO UPDATE SET
           PLAYER_TAG = excluded.PLAYER_TAG,
           CURRENT_TOWN_HALL = excluded.CURRENT_TOWN_HALL,
           VILLAGE_JSON = excluded.VILLAGE_JSON,
           UPDATED_AT = CURRENT_TIMESTAMP`,
        { userId, playerTag, currentTownHall, villageJson: JSON.stringify(villageData) }
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    return res.json({
      success: true,
      message: "Village imported successfully",
      userId,
      playerTag,
      currentTownHall,
      totalParsed: parsed.items.length,
      matchedCount: matchedItems.length,
      unmatchedCount: unmatchedItems.length,
      savedCount: matchedItems.length,
      matchedItems,
      unmatchedItems
    });
  } catch (error) {
    console.error("Village import failed:", error);
    return res.status(500).json({ success: false, message: "Failed to import village" });
  } finally {
    if (connection) await connection.close();
  }
}

async function getSavedVillage(req, res) {
  let connection;
  try {
    const pool = getPool();
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT PLAYER_TAG, CURRENT_TOWN_HALL, VILLAGE_JSON, UPDATED_AT
       FROM USER_VILLAGE_JSON WHERE USER_ID = :userId`,
      { userId: req.user.userId }
    );

    if (!result.rows.length) {
      return res.json({ success: true, saved: false, message: "No saved village found" });
    }
    const row = result.rows[0];
    let villageData;
    try {
      villageData = typeof row.VILLAGE_JSON === "string" ? JSON.parse(row.VILLAGE_JSON) : row.VILLAGE_JSON;
    } catch (error) {
      console.error("Saved village JSON could not be parsed:", error.message);
      return res.status(500).json({ success: false, message: "Saved village JSON is invalid. Please import it again." });
    }
    return res.json({
      success: true, saved: true, playerTag: row.PLAYER_TAG,
      currentTownHall: row.CURRENT_TOWN_HALL, villageData, updatedAt: row.UPDATED_AT
    });
  } catch (error) {
    console.error("Fetching saved village failed:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch saved village" });
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { matchVillageItems, getSavedVillage };
