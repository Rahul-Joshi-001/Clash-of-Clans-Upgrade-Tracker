
const { home } = require("clash-of-clans-data");

const categories = [
  "armyBuildings",
  "defenses",
  "craftedDefenses",
  "heroEquipment",
  "heroes",
  "traps",
  "walls",
  "resourceBuildings",
  "spells",
  "troops",
  "pets",
  "siegeMachines",
  "otherBuildings"
];

for (const category of categories) {
  const collection = home()[category]();
  const methods = Object.getOwnPropertyNames(
    Object.getPrototypeOf(collection)
  ).filter(name => name !== "constructor");

  // Test the first item-returning method in each category.
  const method = methods.find(name =>
    ![
      "byTownHall", "byBuilding", "byDamageType",
      "byPhase", "current", "former", "byTargetType",
      "byHero", "byRarity", "byBlacksmith", "byTrap",
      "byType", "withSuperTroop", "byPetHouse", "byWorkshop",
      "byHeroHall", "byType", "byBlacksmith", "levelCountAtTownHall",
      "hasGearUp"
    ].includes(name)
  );

  if (!method) continue;

  try {
    const result = collection[method]().first();
    console.log(`\n${category} -> ${method}`);
    console.dir(result, { depth: 2 });
  } catch (error) {
    console.log(`\n${category} -> ${method}: ${error.message}`);
  }
}
