const sql = require("../db");

exports.addUser = async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: "Please provide username, password, and role." });
  }

  try {
    // 🔥 Changed the table name here from AppUsers to Users
    await sql.query`
      INSERT INTO Users (username, password, role)
      VALUES (${username}, ${password}, ${role})
    `;

    res.status(201).json({ message: "User added successfully!" });
  } catch (error) {
    console.error("Error adding user:", error);
    
    // Error number 2627 in MSSQL means Unique Constraint Violation (Username exists)
    if (error.number === 2627) {
      return res.status(400).json({ error: "Username already exists!" });
    }
    
    res.status(500).json({ error: "Failed to add user to database." });
  }
};