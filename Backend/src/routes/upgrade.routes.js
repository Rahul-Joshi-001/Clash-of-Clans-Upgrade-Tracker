const express = require("express");
const { calculateUpgradeCosts } = require("../controllers/upgrade.controller");

const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/calculate", authenticateToken, calculateUpgradeCosts);

module.exports = router;
