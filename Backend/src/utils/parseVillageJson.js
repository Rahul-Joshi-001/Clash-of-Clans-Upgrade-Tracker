
const CATEGORY_MAP = {
    buildings: "BUILDING",
    buildings2: "BUILDING",
    traps: "TRAP",
    traps2: "TRAP",
    units: "TROOP",
    units2: "TROOP",
    siege_machines: "SIEGE_MACHINE",
    heroes: "HERO",
    heroes2: "HERO",
    spells: "SPELL",
    pets: "PET",
    equipment: "EQUIPMENT",
};

function parseVillageJson(data) {
    if (!data || typeof data !== "object" || !data.tag) {
        throw new Error("Invalid village JSON: missing player tag");
    }

    const items = [];

    for (const [section, category] of Object.entries(CATEGORY_MAP)) {
        const entries = data[section];

        if (!Array.isArray(entries)) continue;

        for (const entry of entries) {
            if (entry.data == null || entry.lvl == null) continue;

            items.push({
                sourceDataId: Number(entry.data),
                category,
                village: section.endsWith("2") ? "BUILDER" : "HOME",
                level: Number(entry.lvl),
                quantity: entry.cnt ?? 1,
                upgradeTimerSeconds: entry.timer ?? null,
            });
        }
    }

    return {
        playerTag: data.tag,
        timestamp: data.timestamp ?? null,
        currentTownHall: null,
        items,
    };
}

module.exports = { parseVillageJson };
