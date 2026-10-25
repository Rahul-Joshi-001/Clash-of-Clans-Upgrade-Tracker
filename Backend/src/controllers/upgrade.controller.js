const { getPool } = require("../config/db");

async function calculateUpgradeCosts(req, res) {
  let connection;

  try {
    const { playerTag, targetTownHall } = req.body;
    // Number of builders working at once (home village max is 6).
    const builders = Math.min(6, Math.max(1, Number(req.body.builders) || 6));
    const userId = req.user.userId;
    const townHall = Number(targetTownHall);

    if (
      !playerTag ||
      !Number.isInteger(townHall) ||
      townHall < 1 ||
      townHall > 18
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid playerTag and targetTownHall (1-18) are required",
      });
    }

    const pool = getPool();
    connection = await pool.getConnection();

    // 1. Get current Town Hall.
    const townHallResult = await connection.execute(
      `SELECT CURRENT_TOWN_HALL
       FROM USER_VILLAGE_PROFILE
       WHERE USER_ID = :userId
         AND PLAYER_TAG = :playerTag`,
      { userId, playerTag },
      {}
    );

    if (townHallResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Town Hall level not found. Import your village first.",
      });
    }

    const currentTownHall = Number(
      townHallResult.rows[0].CURRENT_TOWN_HALL
    );

    if (townHall < currentTownHall) {
      return res.status(400).json({
        success: false,
        message: `Target Town Hall cannot be lower than your current Town Hall (TH${currentTownHall}).`,
        currentTownHall,
        targetTownHall: townHall,
      });
    }

    // 2. Fetch saved village items and their eligible upgrade levels.
    const result = await connection.execute(
      `SELECT
          U.VILLAGE_ITEM_ID,
          U.ITEM_ID,
          U.CURRENT_LEVEL,
          U.QUANTITY,
          U.UPGRADE_TIMER_SECONDS,
          G.ITEM_NAME,
          G.CATEGORY,
          G.VILLAGE_TYPE,
          L.ITEM_LEVEL AS TARGET_LEVEL,
          L.UPGRADE_COST,
          L.COST_RESOURCE,
          L.UPGRADE_TIME_SECONDS,
          L.TOWN_HALL_REQUIRED
       FROM USER_VILLAGE_ITEMS U
       JOIN GAME_ITEMS G
         ON G.ITEM_ID = U.ITEM_ID
       LEFT JOIN ITEM_LEVEL_COSTS L
         ON L.ITEM_ID = U.ITEM_ID
        AND L.SUPERCHARGE_LEVEL = 0
        AND L.TOWN_HALL_REQUIRED <= :targetTownHall
       WHERE U.USER_ID = :userId
         AND U.PLAYER_TAG = :playerTag
       ORDER BY U.VILLAGE_ITEM_ID, L.ITEM_LEVEL`,
      {
        userId,
        playerTag,
        targetTownHall: townHall,
      },
      {}
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No saved village found for this player tag",
      });
    }

    const items = new Map();

    for (const row of result.rows) {
      const id = row.VILLAGE_ITEM_ID;

      if (!items.has(id)) {
        items.set(id, {
          villageItemId: id,
          itemId: Number(row.ITEM_ID),
          name: row.ITEM_NAME,
          category: row.CATEGORY,
          villageType: row.VILLAGE_TYPE,
          currentLevel: Number(row.CURRENT_LEVEL ?? 0),
          quantity: Math.max(1, Number(row.QUANTITY ?? 1)),
          upgradeTimerSeconds:
            row.UPGRADE_TIMER_SECONDS == null
              ? null
              : Number(row.UPGRADE_TIMER_SECONDS),
          maxAllowedLevel: 0,
          remainingCost: {},
          remainingTimeSeconds: 0,
          upgrades: [],
        });
      }

      const item = items.get(id);

      if (row.TARGET_LEVEL == null) continue;

      const targetLevel = Number(row.TARGET_LEVEL);
      item.maxAllowedLevel = Math.max(
        item.maxAllowedLevel,
        targetLevel
      );

      if (targetLevel <= item.currentLevel) continue;

      const cost = Number(row.UPGRADE_COST ?? 0);
      const resource = row.COST_RESOURCE || "UNKNOWN";
      const time = Number(row.UPGRADE_TIME_SECONDS ?? 0);

      item.remainingCost[resource] =
        (item.remainingCost[resource] || 0) + cost;

      item.remainingTimeSeconds += time;

      item.upgrades.push({
        targetLevel,
        cost,
        resource,
        timeSeconds: time,
        requiredTownHall: Number(row.TOWN_HALL_REQUIRED),
      });
    }

    // 3. Fetch eligible catalog items and allowed quantities.
    const catalogResult = await connection.execute(
      `SELECT
          G.ITEM_ID,
          G.ITEM_NAME,
          G.CATEGORY,
          G.VILLAGE_TYPE,
          NVL(T.ITEM_COUNT, 0) AS ALLOWED_COUNT,
          NVL(MAX(L.ITEM_LEVEL), 0) AS MAX_LEVEL
       FROM GAME_ITEMS G
       LEFT JOIN ITEM_TOWNHALL_LIMITS T
         ON T.ITEM_ID = G.ITEM_ID
        AND T.TOWN_HALL_LEVEL = :targetTownHall
       LEFT JOIN ITEM_LEVEL_COSTS L
         ON L.ITEM_ID = G.ITEM_ID
        AND L.SUPERCHARGE_LEVEL = 0
        AND L.TOWN_HALL_REQUIRED <= :targetTownHall
       WHERE G.IS_ACTIVE = 'Y'
       GROUP BY
          G.ITEM_ID,
          G.ITEM_NAME,
          G.CATEGORY,
          G.VILLAGE_TYPE,
          T.ITEM_COUNT`,
      { targetTownHall: townHall },
      {}
    );

    // Heroes, pets, troops, spells, sieges and equipment have no rows in
    // ITEM_TOWNHALL_LIMITS (the game data only lists per-TH counts for
    // buildings, traps and walls). For those items, allow exactly 1 copy
    // as long as they are unlocked at the target Town Hall (MAX_LEVEL > 0).
    const limitsResult = await connection.execute(
      `SELECT DISTINCT ITEM_ID FROM ITEM_TOWNHALL_LIMITS`,
      {},
      {}
    );

    const itemsWithLimits = new Set(
      limitsResult.rows.map((row) => Number(row.ITEM_ID))
    );

    for (const row of catalogResult.rows) {
      if (!itemsWithLimits.has(Number(row.ITEM_ID))) {
        row.ALLOWED_COUNT = 1;
      }
    }

    // Count saved copies of each catalog item.
    const ownedByItem = new Map();

    for (const item of items.values()) {
      const id = Number(item.itemId);

      ownedByItem.set(
        id,
        (ownedByItem.get(id) || 0) + item.quantity
      );
    }

    // Fetch costs for levels needed by missing items.
    const missingCostResult = await connection.execute(
      `SELECT
          ITEM_ID,
          ITEM_LEVEL,
          UPGRADE_COST,
          COST_RESOURCE,
          UPGRADE_TIME_SECONDS,
          TOWN_HALL_REQUIRED
       FROM ITEM_LEVEL_COSTS
       WHERE SUPERCHARGE_LEVEL = 0
         AND TOWN_HALL_REQUIRED <= :targetTownHall
       ORDER BY ITEM_ID, ITEM_LEVEL`,
      { targetTownHall: townHall },
      {}
    );

    const costsByItem = new Map();

    for (const row of missingCostResult.rows) {
      const id = Number(row.ITEM_ID);

      if (!costsByItem.has(id)) {
        costsByItem.set(id, []);
      }

      costsByItem.get(id).push({
        targetLevel: Number(row.ITEM_LEVEL),
        cost: Number(row.UPGRADE_COST ?? 0),
        resource: row.COST_RESOURCE || "UNKNOWN",
        timeSeconds: Number(row.UPGRADE_TIME_SECONDS ?? 0),
        requiredTownHall: Number(row.TOWN_HALL_REQUIRED),
      });
    }

    // 4. Build existing item details and totals.
    const totals = {
      resources: {},
      upgradeTimeSeconds: 0,
      itemCount: 0,
      itemsWithUpgrades: 0,
    };

    const itemDetails = [];

    for (const item of items.values()) {
      const quantity = item.quantity;

      for (const [resource, cost] of Object.entries(
        item.remainingCost
      )) {
        totals.resources[resource] =
          (totals.resources[resource] || 0) + cost * quantity;
      }

      totals.upgradeTimeSeconds +=
        item.remainingTimeSeconds * quantity;

      if (item.upgrades.length > 0) {
        totals.itemsWithUpgrades++;
      }

      itemDetails.push({
        ...item,
        remainingCost: Object.fromEntries(
          Object.entries(item.remainingCost).map(
            ([resource, cost]) => [resource, cost * quantity]
          )
        ),
        remainingTimeSeconds:
          item.remainingTimeSeconds * quantity,
        upgrades: item.upgrades.map((upgrade) => ({
          ...upgrade,
          totalCost: upgrade.cost * quantity,
          totalTimeSeconds: upgrade.timeSeconds * quantity,
        })),
      });
    }

    // 5. Add eligible copies missing from the imported village.
    const missingItems = [];

    for (const row of catalogResult.rows) {
      const itemId = Number(row.ITEM_ID);
      const allowedCount = Number(row.ALLOWED_COUNT ?? 0);
      const maxLevel = Number(row.MAX_LEVEL ?? 0);
      const ownedCount = ownedByItem.get(itemId) || 0;

      if (allowedCount <= 0 || maxLevel <= 0) continue;

      const missingCount = Math.max(
        0,
        allowedCount - ownedCount
      );

      if (missingCount === 0) continue;

      const allLevels = costsByItem.get(itemId) || [];
      const upgrades = allLevels.filter(
        (upgrade) => upgrade.targetLevel > 0
      );

      const remainingCost = {};
      let remainingTimeSeconds = 0;

      for (const upgrade of upgrades) {
        remainingCost[upgrade.resource] =
          (remainingCost[upgrade.resource] || 0) +
          upgrade.cost;

        remainingTimeSeconds += upgrade.timeSeconds;
      }

      const missingItem = {
        villageItemId: null,
        itemId,
        name: row.ITEM_NAME,
        category: row.CATEGORY,
        villageType: row.VILLAGE_TYPE,
        currentLevel: 0,
        quantity: missingCount,
        maxAllowedLevel: maxLevel,
        isMissingFromVillage: true,
        needsBuilding: true,
        remainingCost: Object.fromEntries(
          Object.entries(remainingCost).map(
            ([resource, cost]) => [
              resource,
              cost * missingCount,
            ]
          )
        ),
        remainingTimeSeconds:
          remainingTimeSeconds * missingCount,
        upgrades: upgrades.map((upgrade) => ({
          ...upgrade,
          totalCost: upgrade.cost * missingCount,
          totalTimeSeconds:
            upgrade.timeSeconds * missingCount,
        })),
      };

      missingItems.push(missingItem);

      // Include missing-item estimates in the totals.
      for (const [resource, cost] of Object.entries(
        missingItem.remainingCost
      )) {
        totals.resources[resource] =
          (totals.resources[resource] || 0) + cost;
      }

      totals.upgradeTimeSeconds +=
        missingItem.remainingTimeSeconds;

      if (upgrades.length > 0) {
        totals.itemsWithUpgrades++;
      }
    }

    // 6. Calculate overall and category-wise progress.
    let totalCompletedLevels = 0;
    let totalPossibleLevels = 0;

    const categoryStats = new Map();

    for (const row of catalogResult.rows) {
      const allowedCount = Number(row.ALLOWED_COUNT ?? 0);
      const maxLevel = Number(row.MAX_LEVEL ?? 0);

      if (allowedCount <= 0 || maxLevel <= 0) continue;

      const itemId = Number(row.ITEM_ID);
      const ownedCount = ownedByItem.get(itemId) || 0;
      const possibleLevels = allowedCount * maxLevel;

      let completedLevels = 0;

      for (const item of items.values()) {
        if (Number(item.itemId) !== itemId) continue;

        completedLevels +=
          Math.min(item.currentLevel, maxLevel) * item.quantity;
      }

      completedLevels = Math.min(
        possibleLevels,
        completedLevels
      );

      totalPossibleLevels += possibleLevels;
      totalCompletedLevels += completedLevels;

      const category = row.CATEGORY || "OTHER";

      if (!categoryStats.has(category)) {
        categoryStats.set(category, {
          category,
          completedLevels: 0,
          totalLevels: 0,
          itemCount: 0,
        });
      }

      const stats = categoryStats.get(category);

      stats.completedLevels += completedLevels;
      stats.totalLevels += possibleLevels;
      stats.itemCount++;
    }

    const overallProgressPercent =
      totalPossibleLevels > 0
        ? Number(
            (
              (totalCompletedLevels / totalPossibleLevels) *
              100
            ).toFixed(2)
          )
        : 0;

    // Remaining time and cost per category (existing + missing items).
    const categoryRemaining = new Map();

    for (const item of [...itemDetails, ...missingItems]) {
      const key = item.category || "OTHER";

      if (!categoryRemaining.has(key)) {
        categoryRemaining.set(key, {
          remainingTimeSeconds: 0,
          remainingCost: {},
        });
      }

      const entry = categoryRemaining.get(key);
      entry.remainingTimeSeconds += item.remainingTimeSeconds || 0;

      for (const [resource, cost] of Object.entries(
        item.remainingCost || {}
      )) {
        entry.remainingCost[resource] =
          (entry.remainingCost[resource] || 0) + cost;
      }
    }

    // Realistic time estimate: queues run in parallel in the game.
    //  - Builders: total / number of builders (never less than the longest single chain)
    //  - Laboratory and Pets: one at a time, so the full total
    //  - Heroes: each hero upgrades on its own, so the longest hero
    const allItems = [...itemDetails, ...missingItems];

    const sumTime = (cats) =>
      allItems
        .filter((i) => cats.includes(i.category))
        .reduce((sum, i) => sum + (i.remainingTimeSeconds || 0), 0);

    const longestCopy = (cats) =>
      allItems
        .filter((i) => cats.includes(i.category))
        .reduce(
          (max, i) =>
            Math.max(
              max,
              (i.remainingTimeSeconds || 0) / Math.max(1, i.quantity || 1)
            ),
          0
        );

    // Builders work on Buildings and Heroes (Walls cost no time).
    const builderCats = ["BUILDINGS", "HEROES"];


    const estimatedByCategory = {
      BUILDINGS: Math.max(
        sumTime(["BUILDINGS"]) / builders,
        longestCopy(["BUILDINGS"])
      ),
      HEROES: Math.max(
        sumTime(["HEROES"]) / builders,
        longestCopy(["HEROES"])
      ),
      WALLS: sumTime(["WALLS"]) / builders,
      LABORATORY: sumTime(["LABORATORY"]), // one research at a time
      PETS: sumTime(["PETS"]), // one pet upgrade at a time
      EQUIPMENT: 0,
    };

    // Top box: (Buildings time + Heroes time) / builders
    const builderTime =
      (estimatedByCategory.BUILDINGS + estimatedByCategory.HEROES) / builders;

    // Progress and levels for the builder queue only (Buildings + Heroes).
    let builderCompleted = 0;
    let builderTotal = 0;

    for (const category of builderCats) {
      const stats = categoryStats.get(category);
      if (!stats) continue;
      builderCompleted += stats.completedLevels;
      builderTotal += stats.totalLevels;
    }

    const builderSummary = {
      completedLevels: builderCompleted,
      totalLevels: builderTotal,
      remainingLevels: Math.max(0, builderTotal - builderCompleted),
      progressPercent:
        builderTotal > 0
          ? Number(((builderCompleted / builderTotal) * 100).toFixed(2))
          : 0,
    };

    const timeEstimate = {
      builders,
      realisticSeconds: Math.round(builderTime),
      laboratorySeconds: Math.round(estimatedByCategory.LABORATORY),
      petsSeconds: Math.round(estimatedByCategory.PETS),
      totalWorkSeconds: totals.upgradeTimeSeconds,
    };

    const categoryProgress = Array.from(
      categoryStats.values()
    ).map((stats) => ({
      ...stats,
      remainingTimeSeconds:
        categoryRemaining.get(stats.category)?.remainingTimeSeconds || 0,
      estimatedSeconds: Math.round(
        estimatedByCategory[stats.category] ??
          categoryRemaining.get(stats.category)?.remainingTimeSeconds ??
          0
      ),
      remainingCost:
        categoryRemaining.get(stats.category)?.remainingCost || {},
      progressPercent:
        stats.totalLevels > 0
          ? Number(
              (
                (stats.completedLevels / stats.totalLevels) *
                100
              ).toFixed(2)
            )
          : 0,
    }));

    // 7. Return all remaining upgrades, including missing items.
    const remainingUpgrades = [
      ...itemDetails
        .filter((item) => item.upgrades.length > 0)
        .map((item) => ({
          villageItemId: item.villageItemId,
          itemId: item.itemId,
          name: item.name,
          category: item.category,
          villageType: item.villageType,
          currentLevel: item.currentLevel,
          maxAllowedLevel: item.maxAllowedLevel,
          quantity: item.quantity,
          remainingCost: item.remainingCost,
          remainingTimeSeconds: item.remainingTimeSeconds,
          upgrades: item.upgrades,
          isMissingFromVillage: false,
          needsBuilding: false,
        })),
      ...missingItems,
    ];

    totals.itemCount = itemDetails.length + missingItems.length;

    return res.json({
      success: true,
      playerTag,
      currentTownHall,
      targetTownHall: townHall,
      overallProgressPercent,
      progressSummary: {
        completedLevels: totalCompletedLevels,
        totalLevels: totalPossibleLevels,
        remainingLevels: Math.max(
          0,
          totalPossibleLevels - totalCompletedLevels
        ),
      },
      categoryProgress,
      timeEstimate,
      builderSummary,
      remainingUpgrades,
      totals,
      items: itemDetails,
    });
  } catch (error) {
    console.error("Upgrade cost calculation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to calculate upgrade costs",
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { calculateUpgradeCosts };