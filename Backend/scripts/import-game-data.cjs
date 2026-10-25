const fs = require('node:fs');
const path = require('node:path');
const { home } = require('clash-of-clans-data');

const outputPath = path.join(__dirname, 'game-reference-export.json');

// Only Home Village categories used by the tracker. Builder Base/crafted defenses
// are intentionally excluded for now.
const CATEGORY_CONFIG = [
  { source: 'armyBuildings', group: 'BUILDINGS', subcategory: 'NORMAL' },
  { source: 'resourceBuildings', group: 'BUILDINGS', subcategory: 'NORMAL' },
  { source: 'otherBuildings', group: 'BUILDINGS', subcategory: 'NORMAL' },
  { source: 'defenses', group: 'BUILDINGS', subcategory: 'DEFENSIVE' },
  { source: 'traps', group: 'BUILDINGS', subcategory: 'TRAP' },
  { source: 'walls', group: 'WALLS', subcategory: null },
  { source: 'troops', group: 'LABORATORY', subcategory: 'TROOP' },
  { source: 'spells', group: 'LABORATORY', subcategory: 'SPELL' },
  { source: 'siegeMachines', group: 'LABORATORY', subcategory: 'SIEGE_MACHINE' },
  { source: 'heroes', group: 'HEROES', subcategory: null },
  { source: 'pets', group: 'PETS', subcategory: null },
  { source: 'heroEquipment', group: 'EQUIPMENT', subcategory: null },
];

// These methods are filters/helpers rather than individual game items.
const NON_ITEM_METHODS = new Set([
  'byBuilding', 'byTownHall', 'byDamageType', 'hasGearUp',
  'byPhase', 'current', 'former', 'byTargetType', 'byHero',
  'byRarity', 'byBlacksmith', 'byTrap', 'byType', 'withSuperTroop',
  'byPetHouse', 'byWorkshop', 'byHeroHall', 'levelCountAtTownHall',
  'helpers'
]);

function getPrototypeMethods(collection) {
  const methods = new Set();
  let proto = Object.getPrototypeOf(collection);
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor' && typeof collection[name] === 'function') {
        methods.add(name);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
  return [...methods];
}

function getFirstRecord(result) {
  if (result && typeof result.first === 'function') return result.first();
  return result;
}

function getResourceKind(item, level) {
  const raw = level.buildCostResource || level.researchCostResource || level.upgradeCostResource || null;
  if (!raw) return null;
  if (raw === 'Gold or Elixir') return 'GOLD_OR_ELIXIR';
  if (raw === 'Gold') return 'GOLD';
  if (raw === 'Elixir') return 'ELIXIR';
  if (raw === 'Dark Elixir') return 'DARK_ELIXIR';
  return String(raw).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function normalizeLevel(item, level) {
  const isEquipment = item.category === 'hero-equipment';
  const isLaboratory = ['troop', 'spell', 'siege-machine'].includes(item.category);
  const cost = isEquipment
    ? null
    : (level.buildCost ?? level.researchCost ?? level.upgradeCost ?? null);
  const time = isEquipment
    ? null
    : (level.buildTime ?? level.researchTime ?? level.upgradeTime ?? null);

  return {
    level: level.level,
    supercharge: Boolean(level.supercharge),
    cost,
    costResource: isEquipment ? null : getResourceKind(item, level),
    upgradeTime: time ? {
      days: Number(time.days || 0),
      hours: Number(time.hours || 0),
      minutes: Number(time.minutes || 0),
      seconds: Number(time.seconds || 0),
    } : null,
    townHallRequired: level.townHallRequired ?? null,
    laboratoryRequired: level.laboratoryRequired ?? null,
    blacksmithLevelRequired: level.blacksmithLevelRequired ?? null,
    shinyOre: level.upgradeShinyOre ?? null,
    glowyOre: level.upgradeGlowingOre ?? null,
    starryOre: level.upgradeStarryOre ?? null,
    // Keep the complete source level object so fields are not discarded.
    sourceLevel: level,
  };
}

function main() {
  const allItems = [];
  const extractionWarnings = [];
  const seenSourceIds = new Set();

  for (const config of CATEGORY_CONFIG) {
    let collection;
    try {
      collection = home()[config.source]();
    } catch (error) {
      extractionWarnings.push(`${config.source}: could not open category: ${error.message}`);
      continue;
    }

    const methods = getPrototypeMethods(collection).filter(
      name => !NON_ITEM_METHODS.has(name) && !name.startsWith('by') && !name.startsWith('with')
    );
    let categoryCount = 0;

    for (const method of methods) {
      try {
        const result = getFirstRecord(collection[method]());
        if (!result || typeof result !== 'object' || !result.id || !result.name || !Array.isArray(result.levels)) {
          continue;
        }

        const dedupeKey = `${config.group}:${result.id}`;
        if (seenSourceIds.has(dedupeKey)) continue;
        seenSourceIds.add(dedupeKey);

        const isEquipment = config.group === 'EQUIPMENT';
        const levels = result.levels.map(level => normalizeLevel(result, level));
        const record = {
          // Custom ITEM_ID is assigned later by the Oracle import stage.
          itemId: null,
          sourceId: result.id,
          sourceDataId: result.dataId ?? null,
          name: result.name,
          group: config.group,
          subcategory: config.subcategory,
          sourceCategory: result.category ?? config.source,
          base: result.base ?? 'home',
          description: result.description ?? null,
          imagePath: result.images?.normal ?? result.images?.icon ?? null,
          iconPath: result.images?.icon ?? null,
          availablePerTownHall: result.availablePerTownHall ?? null,
          levels,
          equipmentLevels: isEquipment ? levels.map(level => ({
            level: level.level,
            shinyOre: level.shinyOre ?? 0,
            glowyOre: level.glowyOre ?? 0,
            starryOre: level.starryOre ?? 0,
            blacksmithLevelRequired: level.blacksmithLevelRequired,
            sourceLevel: level.sourceLevel,
          })) : null,
          // Retain complete source item data for future schema additions.
          sourceItem: result,
        };
        allItems.push(record);
        categoryCount++;
      } catch (error) {
        extractionWarnings.push(`${config.source}.${method}: ${error.message}`);
      }
    }
    console.log(`${config.group}${config.subcategory ? `/${config.subcategory}` : ''} (${config.source}): ${categoryCount} items`);
  }

  // Assign deterministic custom IDs in sorted order. Once imported, the database
  // should preserve these IDs and future imports should match by sourceId.
  allItems.sort((a, b) =>
    a.group.localeCompare(b.group) ||
    String(a.subcategory || '').localeCompare(String(b.subcategory || '')) ||
    a.name.localeCompare(b.name)
  );
  allItems.forEach((item, index) => { item.itemId = index + 1; });

  const exportData = {
    generatedAt: new Date().toISOString(),
    sourcePackage: 'clash-of-clans-data',
    base: 'home',
    itemCount: allItems.length,
    levelCount: allItems.reduce((sum, item) => sum + item.levels.length, 0),
    categories: CATEGORY_CONFIG,
    warnings: extractionWarnings,
    items: allItems,
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`\nExported ${exportData.itemCount} items and ${exportData.levelCount} level records.`);
  console.log(`File: ${outputPath}`);
  if (extractionWarnings.length) {
    console.warn(`Warnings: ${extractionWarnings.length}. Review the warnings in the JSON export.`);
  }
  console.log('\nThis step only generates the reference-data export. It does not write to Oracle yet.');
}

main();
