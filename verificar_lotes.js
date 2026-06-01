const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./cadastrogeo.db");

db.all("SELECT * FROM lotes", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }

  console.log("Quantidade de lotes:", rows.length);
  console.table(rows);
});