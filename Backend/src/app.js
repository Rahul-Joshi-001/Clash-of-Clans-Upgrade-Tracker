const express = require("express");
const cors = require("cors");

const villageRouter = require("./routes/village.routes");
const authRouter = require("./routes/auth.routes");
const upgradeRouter = require("./routes/upgrade.routes");

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://clash-track.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/village", villageRouter);
app.use("/api/upgrade", upgradeRouter);

module.exports = app;