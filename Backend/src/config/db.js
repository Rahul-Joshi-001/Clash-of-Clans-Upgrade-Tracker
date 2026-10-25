const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

let db;

function durationToSeconds(time) {
  if (!time) return null;
  return (Number(time.days || 0) * 86400) +
    (Number(time.hours || 0) * 3600) +
    (Number(time.minutes || 0) * 60) +
    Number(time.seconds || 0);
}

function createSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS USERS (
      USER_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      USERNAME TEXT NOT NULL,
      EMAIL TEXT NOT NULL UNIQUE,
      PASSWORD_HASH TEXT NOT NULL,
      CREATED_AT TEXT DEFAULT CURRENT_TIMESTAMP,
      PLAYER_TAG TEXT
    );
    CREATE TABLE IF NOT EXISTS GAME_ITEMS (
      ITEM_ID INTEGER PRIMARY KEY,
      GAME_DATA_ID TEXT NOT NULL,
      SOURCE_DATA_ID INTEGER,
      ITEM_NAME TEXT NOT NULL,
      VILLAGE_TYPE TEXT NOT NULL DEFAULT 'HOME',
      CATEGORY TEXT NOT NULL,
      SUBCATEGORY TEXT,
      SOURCE_CATEGORY TEXT,
      IMAGE_PATH TEXT,
      ICON_PATH TEXT,
      DESCRIPTION TEXT,
      IS_ACTIVE TEXT NOT NULL DEFAULT 'Y'
    );
    CREATE INDEX IF NOT EXISTS IDX_GAME_ITEMS_SOURCE ON GAME_ITEMS(SOURCE_DATA_ID, VILLAGE_TYPE);
    CREATE TABLE IF NOT EXISTS ITEM_LEVEL_COSTS (
      ITEM_ID INTEGER NOT NULL,
      ITEM_LEVEL INTEGER NOT NULL,
      SUPERCHARGE_LEVEL INTEGER NOT NULL DEFAULT 0,
      UPGRADE_COST REAL,
      COST_RESOURCE TEXT,
      UPGRADE_TIME_SECONDS INTEGER,
      TOWN_HALL_REQUIRED INTEGER,
      LABORATORY_REQUIRED INTEGER,
      PRIMARY KEY (ITEM_ID, ITEM_LEVEL, SUPERCHARGE_LEVEL)
    );
    CREATE TABLE IF NOT EXISTS EQUIPMENT_LEVEL_COSTS (
      ITEM_ID INTEGER NOT NULL,
      ITEM_LEVEL INTEGER NOT NULL,
      SHINY_ORE INTEGER,
      GLOWY_ORE INTEGER,
      STARRY_ORE INTEGER,
      BLACKSMITH_LEVEL_REQUIRED INTEGER,
      PRIMARY KEY (ITEM_ID, ITEM_LEVEL)
    );
    CREATE TABLE IF NOT EXISTS ITEM_TOWNHALL_LIMITS (
      ITEM_ID INTEGER NOT NULL,
      TOWN_HALL_LEVEL INTEGER NOT NULL,
      ITEM_COUNT INTEGER,
      PRIMARY KEY (ITEM_ID, TOWN_HALL_LEVEL)
    );
    CREATE TABLE IF NOT EXISTS USER_VILLAGE_ITEMS (
      VILLAGE_ITEM_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      USER_ID INTEGER NOT NULL,
      ITEM_ID INTEGER NOT NULL,
      QUANTITY INTEGER NOT NULL,
      CURRENT_LEVEL INTEGER NOT NULL,
      SUPERCHARGE_LEVEL INTEGER NOT NULL DEFAULT 0,
      CREATED_AT TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UPGRADE_TIMER_SECONDS INTEGER,
      PLAYER_TAG TEXT
    );
    CREATE INDEX IF NOT EXISTS IDX_USER_VILLAGE_ITEMS_USER ON USER_VILLAGE_ITEMS(USER_ID, PLAYER_TAG);
    CREATE TABLE IF NOT EXISTS USER_VILLAGE_PROFILE (
      USER_ID INTEGER NOT NULL,
      PLAYER_TAG TEXT NOT NULL,
      CURRENT_TOWN_HALL INTEGER,
      UPDATED_AT TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (USER_ID, PLAYER_TAG)
    );
    CREATE TABLE IF NOT EXISTS USER_VILLAGE_JSON (
      USER_ID INTEGER PRIMARY KEY,
      PLAYER_TAG TEXT NOT NULL,
      CURRENT_TOWN_HALL INTEGER,
      VILLAGE_JSON TEXT NOT NULL,
      UPDATED_AT TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedCatalog(database) {
  const count = database.prepare("SELECT COUNT(*) AS count FROM GAME_ITEMS").get().count;
  if (count > 0) return;

  const dataPath = path.join(__dirname, "..", "..", "scripts", "game-reference-export.json");
  if (!fs.existsSync(dataPath)) {
    console.warn("Game catalog export was not found; catalog tables will be empty.");
    return;
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const insertItem = database.prepare(`
    INSERT INTO GAME_ITEMS (
      ITEM_ID, GAME_DATA_ID, SOURCE_DATA_ID, ITEM_NAME, VILLAGE_TYPE,
      CATEGORY, SUBCATEGORY, SOURCE_CATEGORY, IMAGE_PATH, ICON_PATH, DESCRIPTION, IS_ACTIVE
    ) VALUES (?, ?, ?, ?, 'HOME', ?, ?, ?, ?, ?, ?, 'Y')
  `);
  const insertLevel = database.prepare(`
    INSERT INTO ITEM_LEVEL_COSTS (
      ITEM_ID, ITEM_LEVEL, SUPERCHARGE_LEVEL, UPGRADE_COST, COST_RESOURCE,
      UPGRADE_TIME_SECONDS, TOWN_HALL_REQUIRED, LABORATORY_REQUIRED
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEquipment = database.prepare(`
    INSERT INTO EQUIPMENT_LEVEL_COSTS (
      ITEM_ID, ITEM_LEVEL, SHINY_ORE, GLOWY_ORE, STARRY_ORE, BLACKSMITH_LEVEL_REQUIRED
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertLimit = database.prepare(`
    INSERT INTO ITEM_TOWNHALL_LIMITS (ITEM_ID, TOWN_HALL_LEVEL, ITEM_COUNT)
    VALUES (?, ?, ?)
  `);

  const HERO_HALL_TH = { 1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 6: 12, 7: 13, 8: 14, 9: 15, 10: 16, 11: 17, 12: 18 };
  const BLACKSMITH_TH = { 0: 8, 1: 8, 2: 9, 3: 10, 4: 11, 5: 12, 6: 13, 7: 14, 8: 15, 9: 16, 10: 17 };

  const seed = database.transaction(() => {
    for (const item of data.items || []) {
      const itemId = Number(item.itemId);
      insertItem.run(
        itemId, String(item.sourceId), item.sourceDataId ?? null, item.name,
        item.group, item.subcategory ?? null, item.sourceCategory ?? null,
        item.imagePath ?? null, item.iconPath ?? null, item.description ?? null
      );

      for (const level of item.levels || []) {
        const t = level.upgradeTime;
        const timeSeconds = t ? Number(t.days || 0) * 86400 + Number(t.hours || 0) * 3600 +
          Number(t.minutes || 0) * 60 + Number(t.seconds || 0) : null;
        let townHall = level.townHallRequired ?? null;
        if (townHall == null && item.group === "HEROES" && level.sourceLevel?.heroHallLevelRequired != null) {
          townHall = HERO_HALL_TH[level.sourceLevel.heroHallLevelRequired] ?? null;
        }
        if (townHall == null && item.group === "EQUIPMENT" && level.blacksmithLevelRequired != null) {
          townHall = BLACKSMITH_TH[level.blacksmithLevelRequired] ?? null;
        }
        insertLevel.run(itemId, level.level, level.supercharge ? level.level : 0,
          level.cost ?? null, level.costResource ?? null, timeSeconds,
          townHall, level.laboratoryRequired ?? null);
      }

      for (const level of item.equipmentLevels || []) {
        insertEquipment.run(itemId, level.level, level.shinyOre ?? 0,
          level.glowyOre ?? 0, level.starryOre ?? 0,
          level.blacksmithLevelRequired ?? null);
      }

      for (const limit of item.sourceItem?.availablePerTownHall || []) {
        insertLimit.run(itemId, limit.townHallLevel, limit.count);
      }
    }
  });
  seed();
  console.log(`Loaded ${data.items.length} Clash of Clans catalog items into the local database.`);
}

function makeConnection(database) {
  let transactionOpen = false;

  return {
    async execute(sql, binds = {}, options = {}) {
      const normalized = String(sql)
        .replace(/\bNVL\s*\(/gi, "IFNULL(")
        .trim();
      const convertedBinds = {};
      for (const [key, value] of Object.entries(binds || {})) {
        if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "val")) {
          convertedBinds[key] = value.val;
        } else if (value && typeof value === "object" && !Array.isArray(value) && !Buffer.isBuffer(value)) {
          // Oracle OUT bind descriptors are handled in the controller-specific code, not SQLite.
          convertedBinds[key] = value;
        } else {
          convertedBinds[key] = value;
        }
      }

      if (/^SAVEPOINT\b/i.test(normalized)) {
        if (!transactionOpen) {
          database.exec("BEGIN");
          transactionOpen = true;
        }
        database.exec(normalized);
        return { rows: [] };
      }
      if (/^COMMIT\b/i.test(normalized)) {
        if (transactionOpen) database.exec("COMMIT");
        transactionOpen = false;
        return { rows: [] };
      }
      if (/^ROLLBACK\b/i.test(normalized)) {
        if (transactionOpen) database.exec("ROLLBACK");
        transactionOpen = false;
        return { rows: [] };
      }

      const statement = database.prepare(normalized);
      if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(normalized)) {
        let rows;
        if (/^\s*SELECT\s+DISTINCT\s+ITEM_ID\s+FROM\s+ITEM_TOWNHALL_LIMITS/i.test(normalized) && !Object.keys(convertedBinds).length) {
          rows = statement.all();
        } else {
          rows = statement.all(convertedBinds);
        }
        return { rows };
      }

      const result = statement.run(convertedBinds);
      return { rows: [], rowsAffected: result.changes, lastRowId: result.lastInsertRowid };
    },
    async commit() {
      if (transactionOpen) database.exec("COMMIT");
      transactionOpen = false;
    },
    async rollback() {
      if (transactionOpen) database.exec("ROLLBACK");
      transactionOpen = false;
    },
    async close() {
      // The shared database remains open for the lifetime of the server.
    }
  };
}

async function connectDB() {
  const dataDirectory = path.join(__dirname, "..", "..", "data");
  fs.mkdirSync(dataDirectory, { recursive: true });
  const databasePath = process.env.SQLITE_DB_PATH
    ? path.resolve(process.env.SQLITE_DB_PATH)
    : path.join(dataDirectory, "clashtrack.sqlite");

  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  seedCatalog(db);
  console.log(`Local SQLite database ready: ${databasePath}`);
}

function getPool() {
  if (!db) throw new Error("Local database is not initialized");
  return {
    async getConnection() {
      return makeConnection(db);
    },
    async close() {}
  };
}

module.exports = { connectDB, getPool };
