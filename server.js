const express = require("express");
const path = require("path");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(cors());
app.use(express.static(__dirname));

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

     await pg.query(`
      CREATE TABLE IF NOT EXISTS cadastros (
        id SERIAL PRIMARY KEY,
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

      await pg.query(`
        CREATE TABLE IF NOT EXISTS fotos (
          id SERIAL PRIMARY KEY,
          casa_id TEXT NOT NULL,
          nome_arquivo TEXT,
          tipo TEXT,
          dados TEXT NOT NULL,
          data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);


  console.log("Tabela PostgreSQL 'cadastros' verificada/criada."); 

  } catch (erro) {

    console.error(
      "Erro ao iniciar PostgreSQL:",
      erro.message
    );

  }

  await pg.query(`
  CREATE TABLE IF NOT EXISTS atribuicoes (
    id SERIAL PRIMARY KEY,
    casa_id TEXT NOT NULL,
    colaborador TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    prioridade INTEGER DEFAULT 0,
    data_atribuicao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_conclusao TIMESTAMP
  )
`);

await pg.query(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    papel TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE
  )
`);

console.log("Tabela PostgreSQL 'usuarios' verificada/criada.");

await pg.query(`
INSERT INTO usuarios
(nome, usuario, senha, papel)
VALUES
('Carlos Engenheiro','engenheiro','admin123','engenheiro'),
('João Silva','colaborador1','campo123','colaborador'),
('Ana Oliveira','assistente1','social123','assistente')
ON CONFLICT (usuario) DO NOTHING;
`);

}



iniciarPostgreSQL();

// ==========================
// CRIAR TABELAS
// ==========================


// ==========================
// LISTAR LOTES
// ==========================
app.get("/lotes", async (req, res) => {

  try {

    const resultado = await pg.query(`
      SELECT *
      FROM lotes
      ORDER BY nome
    `);

    console.log("GET /lotes retornou:");
    console.log(JSON.stringify(resultado.rows, null, 2));

    res.json(resultado.rows);

  } catch (erro) {

    console.error("Erro ao buscar lotes no PostgreSQL:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.get("/minhas-missoes/:colaborador", async (req, res) => {

  try {

    const { colaborador } = req.params;

    const resultado = await pg.query(

      `
      SELECT

        a.casa_id,
        a.prioridade,
        a.data_atribuicao,

        c.endereco,
        c.bairro,
        c.latitude,
        c.longitude,
        c.status

      FROM atribuicoes a

      LEFT JOIN cadastros c
        ON c.casa_id = a.casa_id

      WHERE a.colaborador = $1

      ORDER BY a.data_atribuicao

      `,

      [colaborador]

    );

    res.json(resultado.rows);

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

// ==========================
// BUSCAR LOTE POR ID
// ==========================
app.get("/lotes/:id", async (req, res) => {

  try {

    const resultado = await pg.query(
      `
      SELECT *
      FROM lotes
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Lote não encontrado."
      });
    }

    res.json(resultado.rows[0]);

  } catch (erro) {

    console.error("Erro ao buscar lote:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

// ==========================
// SALVAR LOTES
// ==========================
app.post("/lotes", async (req, res) => {

  const lotes = req.body;

  if (!Array.isArray(lotes)) {
    return res.status(400).json({
      erro: "O corpo deve ser um array."
    });
  }

  try {

    for (let i = 0; i < lotes.length; i++) {

      const lote = lotes[i];

      const id =
        lote.id ||
        `lote_${Date.now()}_${i}`;

      const nome =
        lote.nome ||
        `Lote ${i + 1}`;

      const status =
        lote.status ||
        "livre";

      await pg.query(
        `
        INSERT INTO lotes (
          id,
          nome,
          status,
          geojson
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id)
        DO UPDATE SET
          nome = EXCLUDED.nome,
          status = EXCLUDED.status,
          geojson = EXCLUDED.geojson
        `,
        [
          id,
          nome,
          status,
          lote.geojson || lote
        ]
      );

    }

    res.json({
      ok: true,
      total: lotes.length
    });

  } catch (erro) {

    console.error(
      "Erro ao salvar lotes no PostgreSQL:",
      erro
    );

    res.status(500).json({
      erro: erro.message
    });

  }

});

// ==========================
// LISTAR CASAS
// ==========================
app.get("/casas", async (req, res) => {

  try {

    const resultado = await pg.query(`
      SELECT *
      FROM casas
      ORDER BY numero
    `);

    res.json(resultado.rows);

  } catch (erro) {

    console.error("Erro ao buscar casas:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

// ==========================
// BUSCAR CASA POR ID
// ==========================
app.get("/casas/:id", async (req, res) => {

  try {

    const resultado = await pg.query(
      `
      SELECT *
      FROM casas
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Casa não encontrada."
      });
    }

    res.json(resultado.rows[0]);

  } catch (erro) {

    console.error("Erro ao buscar casa:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

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
app.post("/cadastro", async (req, res) => {

  const c = req.body;

  try {

    const resultado = await pg.query(
      `
      INSERT INTO cadastros (
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
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26
      )
      ON CONFLICT (casa_id)
      DO UPDATE SET
        endereco = EXCLUDED.endereco,
        bairro = EXCLUDED.bairro,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        nome = EXCLUDED.nome,
        cpf = EXCLUDED.cpf,
        nascimento = EXCLUDED.nascimento,
        sexo = EXCLUDED.sexo,
        escolaridade = EXCLUDED.escolaridade,
        telefone = EXCLUDED.telefone,
        nis = EXCLUDED.nis,
        moradores = EXCLUDED.moradores,
        menores = EXCLUDED.menores,
        idosos = EXCLUDED.idosos,
        renda = EXCLUDED.renda,
        fonte_renda = EXCLUDED.fonte_renda,
        tipo_moradia = EXCLUDED.tipo_moradia,
        material = EXCLUDED.material,
        agua = EXCLUDED.agua,
        esgoto = EXCLUDED.esgoto,
        energia = EXCLUDED.energia,
        observacoes = EXCLUDED.observacoes,
        colaborador = EXCLUDED.colaborador,
        status = EXCLUDED.status,
        data_cadastro = EXCLUDED.data_cadastro
      RETURNING id
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
      ]
    );

    res.json({
      success: true,
      id: resultado.rows[0].id
    });

  } catch (erro) {

    console.error("Erro ao salvar cadastro no PostgreSQL:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.post("/usuario", async (req, res) => {

  try {

    const {
      nome,
      usuario,
      senha,
      papel
    } = req.body;

    await pg.query(
      `
      INSERT INTO usuarios
      (
        nome,
        usuario,
        senha,
        papel
      )
      VALUES ($1,$2,$3,$4)
      `,
      [
        nome,
        usuario,
        senha,
        papel
      ]
    );

    res.json({
      ok:true
    });

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.post("/login", async (req, res) => {

  try {

    const {
      usuario,
      senha
    } = req.body;

    const resultado = await pg.query(

      `
      SELECT
        nome,
        usuario,
        papel,
        ativo
      FROM usuarios
      WHERE usuario = $1
        AND senha = $2
      `,

      [
        usuario,
        senha
      ]

    );

    if (resultado.rows.length === 0) {

      return res.status(401).json({
        erro: "Usuário ou senha inválidos."
      });

    }

    res.json(resultado.rows[0]);

  } catch (erro) {

    console.error("Erro no login:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.post("/fotos", async (req, res) => {

  try {

    const {
      casa_id,
      nome_arquivo,
      tipo,
      dados
    } = req.body;

    await pg.query(
      `
      INSERT INTO fotos (
        casa_id,
        nome_arquivo,
        tipo,
        dados
      )
      VALUES ($1, $2, $3, $4)
      `,
      [
        casa_id,
        nome_arquivo,
        tipo,
        dados
      ]
    );

    res.json({
      ok: true
    });

  } catch (erro) {

    console.error("Erro ao salvar foto:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.post("/atribuir-casa", async (req, res) => {

  try {

    const {
      casa_id,
      colaborador
    } = req.body;

    await pg.query(
      `
      INSERT INTO atribuicoes (
        casa_id,
        colaborador
      )
      VALUES ($1, $2)
      `,
      [
        casa_id,
        colaborador
      ]
    );

    res.json({
      ok: true
    });

  } catch (erro) {

    console.error("Erro ao atribuir casa:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.get("/usuarios", async (req, res) => {

  try {

    const resultado = await pg.query(`
      SELECT
        nome,
        usuario,
        senha,
        papel,
        ativo
      FROM usuarios
      ORDER BY nome
    `);

    res.json(resultado.rows);

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.get("/colaboradores", async (req, res) => {

  try {

    const resultado = await pg.query(`
      SELECT
        username,
        name
      FROM users
      WHERE role = 'colaborador'
      ORDER BY name
    `);

    res.json(resultado.rows);

  } catch (erro) {

    console.error("Erro ao listar colaboradores:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

app.get("/fotos/:casa_id", async (req, res) => {

  try {

    const resultado = await pg.query(
      `
      SELECT
        id,
        casa_id,
        nome_arquivo,
        tipo,
        dados,
        data_envio
      FROM fotos
      WHERE casa_id = $1
      ORDER BY id
      `,
      [req.params.casa_id]
    );

    res.json(resultado.rows);

  } catch (erro) {

    console.error("Erro ao carregar fotos:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});

// ==========================
// LISTAR CADASTROS
// ==========================
app.get("/cadastros", async (req, res) => {

  try {

    const resultado = await pg.query(`
      SELECT *
      FROM cadastros
      ORDER BY nome
    `);

    res.json(resultado.rows);

  } catch (erro) {

    console.error("ERRO COMPLETO GET /cadastros:", erro);

      res.status(500).json({
        erro: String(erro),
        codigo: erro.code || null
      });

  }

});

// ==========================
// BUSCAR CADASTRO POR CASA
// ==========================
app.get("/cadastro/:casa_id", async (req, res) => {

  try {

    const resultado = await pg.query(
      `
      SELECT *
      FROM cadastros
      WHERE casa_id = $1
      `,
      [req.params.casa_id]
    );

    res.json(resultado.rows[0] || {});

  } catch (erro) {

    console.error("Erro ao buscar cadastro por casa:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

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