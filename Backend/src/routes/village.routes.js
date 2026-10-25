const express = require("express");
const {
  matchVillageItems,
  getSavedVillage,
} = require("../controllers/village.controller");
const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/match", authenticateToken, matchVillageItems);
router.get("/saved", authenticateToken, getSavedVillage);

module.exports = router;