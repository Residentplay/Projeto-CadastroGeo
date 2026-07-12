const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(cors());
app.use(express.static(__dirname));

const db = new sqlite3.Database("./cadastrogeo.db");

const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

async function iniciarPostgreSQL() {

  if (!process.env.DATABASE_URL) {
    console.log(
      "DATABASE_URL não configurada. PostgreSQL será iniciado apenas no Render."
    );
    return;
  }

  try {

    const conexao = await pg.query("SELECT NOW()");

    console.log(
      "PostgreSQL conectado:",
      conexao.rows[0]
    );

    await pg.query(`
      CREATE TABLE IF NOT EXISTS lotes (
        id TEXT PRIMARY KEY,
        nome TEXT,
        status TEXT DEFAULT 'livre',
        geojson JSONB NOT NULL
      )
    `);

    console.log(
      "Tabela PostgreSQL 'lotes' verificada/criada."
    );

    await pg.query(`
  CREATE TABLE IF NOT EXISTS casas (
    id TEXT PRIMARY KEY,
    lote_id TEXT,
    numero TEXT,
    status TEXT DEFAULT 'livre',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geojson JSONB NOT NULL
  )
`);

console.log("Tabela PostgreSQL 'casas' verificada/criada.");

  } catch (erro) {

    console.error(
      "Erro ao iniciar PostgreSQL:",
      erro.message
    );

  }

}

iniciarPostgreSQL();

// ==========================
// CRIAR TABELAS
// ==========================
db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS cadastros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      casa_id TEXT UNIQUE,
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
    CREATE INDEX IF NOT EXISTS idx_casa_id
    ON cadastros(casa_id)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lotes (
      id TEXT PRIMARY KEY,
      nome TEXT,
      status TEXT,
      geojson TEXT
    )
  `);

  // NOVA TABELA
  db.run(`
    CREATE TABLE IF NOT EXISTS casas (
      id TEXT PRIMARY KEY,
      lote_id TEXT,
      numero TEXT,
      status TEXT,
      latitude REAL,
      longitude REAL,
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

      console.log("GET /lotes retornou:");
      console.log(JSON.stringify(rows, null, 2));

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

  const lotes = req.body;

  console.log(
    "RECEBIDO:",
    JSON.stringify(lotes, null, 2)
  );

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

  lotes.forEach((lote, i) => {

    console.log("SALVANDO LOTE:", lote);

    const id =
      lote.id ||
      ("lote_" + Date.now() + "_" + i);

    const nome =
      lote.nome ||
      ("Lote " + (i + 1));

    const status =
      lote.status ||
      "livre";

      

    stmt.run(
      [
        id,
        nome,
        status,
        JSON.stringify(lote)
      ],
      err => {

        if(err){

          console.error(
            "Erro ao salvar lote:",
            err
          );

        }

      }
    );

  });

  stmt.finalize(err => {

    if(err){

      console.error(err);

      return res.status(500).json({
        erro: err.message
      });

    }

    db.all(
      "SELECT * FROM lotes",
      [],
      (err, rows) => {

        if(err){

          console.error(err);

          return res.status(500).json({
            erro: err.message
          });

        }

        console.log(
          "BANCO APÓS SALVAR:"
        );

        console.log(rows);

        res.json({
          ok: true,
          total: lotes.length
        });

      }
    );

  });

});

// ==========================
// LISTAR CASAS
// ==========================
app.get("/casas", (req, res) => {

  db.all(
    "SELECT * FROM casas",
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
// BUSCAR CASA POR ID
// ==========================
app.get("/casas/:id", (req, res) => {

  db.get(
    "SELECT * FROM casas WHERE id = ?",
    [req.params.id],
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
// SALVAR CASAS
// ==========================
app.post("/casas", async (req, res) => {

  const casas = req.body;

  if (!Array.isArray(casas)) {
    return res.status(400).json({
      erro: "O corpo deve ser um array de casas."
    });
  }

  try {

    for (const casa of casas) {

      await pg.query(
        `
        INSERT INTO casas (
          id,
          lote_id,
          numero,
          status,
          latitude,
          longitude,
          geojson
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id)
        DO UPDATE SET
          lote_id = EXCLUDED.lote_id,
          numero = EXCLUDED.numero,
          status = EXCLUDED.status,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          geojson = EXCLUDED.geojson
        `,
        [
          casa.id,
          casa.lote_id || null,
          casa.numero || casa.label || "Casa",
          casa.status || "livre",
          Number(casa.latitude ?? casa.lat),
          Number(casa.longitude ?? casa.lng),
          casa
        ]
      );

    }

    res.json({
      ok: true,
      quantidade: casas.length
    });

  } catch (erro) {

    console.error("Erro ao salvar casas no PostgreSQL:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

// ==========================
// SALVAR CADASTRO
// ==========================
app.post("/cadastro", (req, res) => {

  const c = req.body;

  

      db.run(
        `
        INSERT OR REPLACE INTO cadastros (
          casa_id,
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
          c.casa_id,
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
// BUSCAR CADASTRO POR CASA
// ==========================
app.get("/cadastro/:casa_id", (req, res) => {

  db.get(
    "SELECT * FROM cadastros WHERE casa_id = ?",
    [req.params.casa_id],
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