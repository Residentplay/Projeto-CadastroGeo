const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./cadastrogeo.db");

db.all(
  "PRAGMA table_info(cadastros)",
  [],
  (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }

    console.table(rows);
  }
);