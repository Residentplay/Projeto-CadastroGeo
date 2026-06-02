const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(cors());
app.use(express.static(__dirname));

const db = new sqlite3.Database("./cadastrogeo.db");

// ==========================
// CRIAR TABELAS
// ==========================
db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS cadastros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lote_id TEXT UNIQUE,
      endereco TEXT,
      bairro TEXT,
      latitude TEXT,
      longitude TEXT,
      nome TEXT,
      cpf TEXT,
      nascimento TEXT,
      sexo TEXT,
      escolaridade TEXT,
      telefone TEXT,
      nis TEXT,
      moradores TEXT,
      menores TEXT,
      idosos TEXT,
      renda TEXT,
      fonte_renda TEXT,
      tipo_moradia TEXT,
      material TEXT,
      agua TEXT,
      esgoto TEXT,
      energia TEXT,
      observacoes TEXT,
      colaborador TEXT,
      status TEXT,
      data_cadastro TEXT
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_lote_id
    ON cadastros(lote_id)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lotes (
      id TEXT PRIMARY KEY,
      nome TEXT,
      status TEXT,
      geojson TEXT
    )
  `);

});

// ==========================
// LISTAR LOTES
// ==========================
app.get("/lotes", (req, res) => {

  db.all(
    "SELECT * FROM lotes",
    [],
    (err, rows) => {

      if (err) {
        return res.status(500).json({ erro: err.message });
      }

      res.json(rows);

    }
  );

});

// ==========================
// BUSCAR LOTE POR ID
// ==========================
app.get("/lotes/:id", (req, res) => {

  db.get(
    "SELECT * FROM lotes WHERE id = ?",
    [req.params.id],
    (err, row) => {

      if (err) {
        return res.status(500).json({ erro: err.message });
      }

      res.json(row || {});

    }
  );

});

// ==========================
// SALVAR LOTES
// ==========================
app.post("/lotes", (req, res) => {

  console.log("POST /lotes recebido");
  console.log(req.body);

  const lotes = req.body;

  console.log("RECEBIDO:", JSON.stringify(lotes, null, 2));

  if (!Array.isArray(lotes)) {
    return res.status(400).json({
      erro: "O corpo deve ser um array."
    });
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lotes (
      id,
      nome,
      status,
      geojson
    )
    VALUES (?, ?, ?, ?)
  `);

  lotes.forEach(lote => {

    stmt.run([
      lote.id,
      lote.nome || "",
      lote.status || "livre",
      JSON.stringify(lote.geojson || lote)
    ]);

  });

  stmt.finalize(err => {

    if (err) {
      return res.status(500).json({
        erro: err.message
      });
    }

    console.log("BANCO APÓS SALVAR:", rows);

    res.json({
      ok: true,
      total: lotes.length
    });

  });

});

// ==========================
// SALVAR CADASTRO
// ==========================
app.post("/cadastro", (req, res) => {

  const c = req.body;

  

      db.run(
        `
        INSERT OR REPLACE INTO cadastros (
          lote_id,
          endereco,
          bairro,
          latitude,
          longitude,
          nome,
          cpf,
          nascimento,
          sexo,
          escolaridade,
          telefone,
          nis,
          moradores,
          menores,
          idosos,
          renda,
          fonte_renda,
          tipo_moradia,
          material,
          agua,
          esgoto,
          energia,
          observacoes,
          colaborador,
          status,
          data_cadastro
        )
        VALUES (
          ?,?,?,?,?,?,?,?,?,?,
          ?,?,?,?,?,?,?,?,?,?,
          ?,?,?,?,?,?
        )
        `,
        [
          c.lote_id,
          c.endereco,
          c.bairro,
          c.latitude,
          c.longitude,
          c.nome,
          c.cpf,
          c.nascimento,
          c.sexo,
          c.escolaridade,
          c.telefone,
          c.nis,
          c.moradores,
          c.menores,
          c.idosos,
          c.renda,
          c.fonte_renda,
          c.tipo_moradia,
          c.material,
          c.agua,
          c.esgoto,
          c.energia,
          c.observacoes,
          c.colaborador,
          c.status,
          c.data_cadastro
        ],
        function(err) {

      if (err) {
        return res.status(500).json({
          erro: err.message
        });
      }

      res.json({
        success: true,
        id: this.lastID
      });

    }
  );

});

// ==========================
// LISTAR CADASTROS
// ==========================
app.get("/cadastros", (req, res) => {

  db.all(
    "SELECT * FROM cadastros",
    [],
    (err, rows) => {

      if (err) {
        return res.status(500).json({
          erro: err.message
        });
      }

      res.json(rows);

    }
  );

});

// ==========================
// BUSCAR CADASTRO POR LOTE
// ==========================
app.get("/cadastro/:lote_id", (req, res) => {

  db.get(
    "SELECT * FROM cadastros WHERE lote_id = ?",
    [req.params.lote_id],
    (err, row) => {

      if (err) {
        return res.status(500).json({
          erro: err.message
        });
      }

      res.json(row || {});

    }
  );

});

// ==========================
// PÁGINA PRINCIPAL
// ==========================
app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "cadastro_social.html")
  );

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});