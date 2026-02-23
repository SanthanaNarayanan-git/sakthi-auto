const express = require("express");
const router = express.Router();
const sql = require("mssql");

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await sql.query`
      SELECT username, role
      FROM Users
      WHERE username = ${username}
        AND password = ${password}
    `;

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.recordset[0];

    // ✅ Send EXACTLY what frontend needs
    res.json({
      username: user.username,
      role: user.role
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
