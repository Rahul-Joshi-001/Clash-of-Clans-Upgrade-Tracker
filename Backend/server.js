require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const app = require("./src/app");
const { connectDB } = require("./src/config/db");

async function start() {
  const dataDirectory = path.join(__dirname, "data");
  fs.mkdirSync(dataDirectory, { recursive: true });

  // Use a per-install secret so the local app works without asking users to configure .env.
  if (!process.env.JWT_SECRET) {
    const secretPath = path.join(dataDirectory, ".jwt-secret");
    if (fs.existsSync(secretPath)) {
      process.env.JWT_SECRET = fs.readFileSync(secretPath, "utf8").trim();
    } else {
      const secret = crypto.randomBytes(48).toString("hex");
      fs.writeFileSync(secretPath, secret, { mode: 0o600 });
      process.env.JWT_SECRET = secret;
    }
  }

  await connectDB();
  app.use(express.static(path.join(__dirname, "public")));

  const port = Number(process.env.PORT || 3000);
  app.listen(port, "127.0.0.1", () => {
    console.log(`ClashTrack backend is running at http://127.0.0.1:${port}`);
  });
}

start().catch((error) => {
  console.error("Could not start ClashTrack backend:", error.message);
  process.exit(1);
});
