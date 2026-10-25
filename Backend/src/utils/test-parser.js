const fs = require("fs");
const path = require("path");
const { parseVillageJson } = require("./parseVillageJson");

const filePath = path.join(__dirname, "../../village.json");

try {
    const rawData = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(rawData);

    const result = parseVillageJson(jsonData);

    console.log("Player tag:", result.playerTag);
    console.log("Parsed items:", result.items.length);
    console.table(result.items.slice(0, 10));
} catch (error) {
    console.error("Parser failed:", error.message);
}