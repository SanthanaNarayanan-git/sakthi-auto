const sql = require("mssql");

const config = {
  user: "appuser",
  password: "AppUser@123",
  server: "localhost",
  database: "FormDb",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

sql.connect(config)
  .then(() => console.log("✅ MSSQL Connected"))
  .catch(err => console.error("❌ DB Error:", err));

module.exports = sql;
