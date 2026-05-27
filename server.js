const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const db = new sqlite3.Database("./cadastrogeo.db");

// CRIAR TABELA
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
});

db.run(`
CREATE TABLE IF NOT EXISTS casas (
  id TEXT PRIMARY KEY,
  endereco TEXT,
  bairro TEXT,
  lat REAL,
  lng REAL
)
`);

// SALVAR CADASTRO
app.post("/cadastro", (req, res) => {
  const c = req.body;

  db.run(`
    INSERT OR REPLACE INTO cadastros (
      casa_id,endereco,bairro,latitude,longitude,
      nome,cpf,nascimento,sexo,escolaridade,
      telefone,nis,moradores,menores,idosos,
      renda,fonte_renda,tipo_moradia,material,
      agua,esgoto,energia,observacoes,
      colaborador,status,data_cadastro
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
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
      return res.status(500).json(err);
    }

    res.json({
      success: true,
      id: this.lastID
    });
  });
});

app.post('/lotes', async (req, res) => {

  const casas = req.body;

  try{

    for(const casa of casas){

      await db.run(`
        INSERT OR IGNORE INTO casas (
          id,
          endereco,
          bairro,
          lat,
          lng
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        casa.id,
        casa.label,
        casa.bairro,
        casa.lat,
        casa.lng
      ]);

    }

    res.json({
      ok:true,
      msg:'Lotes salvos com sucesso!'
    });

  }catch(err){

    console.error(err);

    res.status(500).json({
      erro:'Erro ao salvar lotes'
    });

  }

});

// LISTAR TODOS
app.get("/cadastros", (req, res) => {
  db.all("SELECT * FROM cadastros", [], (err, rows) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json(rows);
  });
});

// BUSCAR CASA
app.get("/cadastro/:casa_id", (req, res) => {
  db.get(
    "SELECT * FROM cadastros WHERE casa_id = ?",
    [req.params.casa_id],
    (err, row) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json(row || {});
    }
  );
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});