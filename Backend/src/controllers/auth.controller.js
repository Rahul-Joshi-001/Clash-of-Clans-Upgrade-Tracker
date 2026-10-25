const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getPool } = require("../config/db");

async function register(req, res) {
  let connection;
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const pool = getPool();
    connection = await pool.getConnection();

    const existing = await connection.execute(
      "SELECT USER_ID FROM USERS WHERE EMAIL = :email",
      { email: normalizedEmail }
    );
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await connection.execute(
      `INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH) VALUES (:username, :email, :passwordHash)`,
      { username: username.trim(), email: normalizedEmail, passwordHash }
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      userId: Number(result.lastRowId)
    });
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }
    console.error("Registration error:", error.message);
    return res.status(500).json({ success: false, message: "Registration failed" });
  } finally {
    if (connection) await connection.close();
  }
}

async function login(req, res) {
  let connection;
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const pool = getPool();
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT USER_ID, USERNAME, EMAIL, PASSWORD_HASH FROM USERS WHERE EMAIL = :email`,
      { email: email.trim().toLowerCase() }
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const user = result.rows[0];
    if (!(await bcrypt.compare(password, user.PASSWORD_HASH))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
    const token = jwt.sign({ userId: user.USER_ID, email: user.EMAIL }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user.USER_ID, username: user.USERNAME, email: user.EMAIL }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, message: "Login failed" });
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { register, login };
