const express = require("express");
const path = require("path");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { rateLimit } = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const API_URL = "https://projeto-cadastrogeo.onrender.com";
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

const {
  getSignedUrl
} = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}-${req.body.usuario || "sem-usuario"}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    erro: "Muitas tentativas de login. Tente novamente mais tarde."
  }
});


if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET ausente ou muito fraco.");
}



const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});



const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024
  }
});



async function autenticarToken(req, res, next) {

  const authHeader = req.headers.authorization;

  let token = req.cookies?.token;

  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      erro: "Token não informado."
    });
  }

  let usuarioToken;

  try {

    usuarioToken = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

  } catch (erro) {

    return res.status(401).json({
      erro: "Token inválido ou expirado."
    });

  }

  try {

    const resultado = await pg.query(
      `
      SELECT
        usuario,
        papel,
        ativo
      FROM usuarios
      WHERE usuario = $1
      LIMIT 1
      `,
      [usuarioToken.usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        erro: "Usuário não encontrado."
      });
    }

    const usuarioBanco = resultado.rows[0];

    if (!usuarioBanco.ativo) {
      return res.status(401).json({
        erro: "Usuário inativo."
      });
    }

    req.usuario = {
      usuario: usuarioBanco.usuario,
      papel: usuarioBanco.papel
    };

    next();

  } catch (erro) {

    console.error("Erro ao validar usuário no banco:", erro);

    return res.status(500).json({
      erro: "Erro interno do servidor."
    });

  }
}

function somenteEngenheiro(req, res, next) {

  if (!req.usuario) {
    return res.status(401).json({
      erro: "Usuário não autenticado."
    });
  }

  if (req.usuario.papel !== "engenheiro") {
    return res.status(403).json({
      erro: "Acesso permitido somente para engenheiro."
    });
  }

  next();
}


function engenheiroOuColaborador(req, res, next) {

  if (!req.usuario) {
    return res.status(401).json({
      erro: "Usuário não autenticado."
    });
  }

  if (
    req.usuario.papel !== "engenheiro" &&
    req.usuario.papel !== "colaborador"
  ) {
    return res.status(403).json({
      erro: "Você não tem permissão para realizar esta ação."
    });
  }

  next();
}



const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));
app.use(cors({
  origin: [
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "https://projeto-cadastrogeo.onrender.com"
  ],
  credentials: true
}));
app.use(express.static(__dirname));
app.use(cookieParser());

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
          nome_arquivo TEXT NOT NULL,
          tipo TEXT,
          tamanho BIGINT,
          url TEXT NOT NULL,
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
  CREATE TABLE IF NOT EXISTS levantamentos_drone (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    data_voo TIMESTAMP,
    criado_por TEXT,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

await pg.query(`
  CREATE TABLE IF NOT EXISTS fotos_drone (
    id SERIAL PRIMARY KEY,
    nome_arquivo TEXT NOT NULL,
    url TEXT NOT NULL,
    tamanho BIGINT,
    data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

}



iniciarPostgreSQL();

// ==========================
// CRIAR TABELAS
// ==========================


// ==========================
// LISTAR LOTES
// ==========================
app.get("/lotes", autenticarToken, async (req, res) => {

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

app.get("/minhas-missoes/:colaborador", autenticarToken, async (req, res) => {

  try {

    const colaborador = req.usuario.usuario;

    const resultado = await pg.query(
      `
      SELECT
        a.casa_id,
        a.status AS status_missao,
        a.prioridade,
        a.data_atribuicao,

        cs.numero,
        cs.latitude,
        cs.longitude,

        c.endereco,
        c.bairro,
        c.nome,
        c.status AS status_cadastro

      FROM atribuicoes a

      INNER JOIN casas cs
        ON cs.id = a.casa_id

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
app.get("/lotes/:id", autenticarToken, async (req, res) => {

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
app.post(
  "/lotes",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

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
app.get("/casas", autenticarToken, async (req, res) => {

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
app.get("/casas/:id", autenticarToken, async (req, res) => {

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
app.post(
  "/casas",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

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
app.post(
  "/cadastro",
  autenticarToken,
  engenheiroOuColaborador,
  async (req, res) => {

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

app.post("/status-missao", autenticarToken, async (req, res) => {

  try {

    const { casa_id, status } = req.body;

    if (status === "em_andamento") {

      const resultado = await pg.query(
        `
        SELECT colaborador
        FROM atribuicoes
        WHERE casa_id = $1
        LIMIT 1
        `,
        [casa_id]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({
          erro: "Atribuição não encontrada."
        });
      }

      const colaborador = resultado.rows[0].colaborador;

      await pg.query(
        `
        UPDATE atribuicoes
        SET status = 'pendente'
        WHERE colaborador = $1
          AND status = 'em_andamento'
          AND casa_id <> $2
        `,
        [colaborador, casa_id]
      );

    }

    await pg.query(
      `
      UPDATE atribuicoes
      SET
        status = $1,
        data_conclusao = CASE
          WHEN $1 = 'concluida' THEN CURRENT_TIMESTAMP
          ELSE NULL
        END
      WHERE casa_id = $2
      `,
      [status, casa_id]
    );

    res.json({
      ok: true
    });

  } catch (erro) {

    console.error(erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});




app.post(
  "/usuario",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

  try {

    const {
      nome,
      usuario,
      senha,
      papel
    } = req.body;

    const senhaCriptografada = await bcrypt.hash(senha, 10);

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
        senhaCriptografada,
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




app.put(
  "/usuario/:id",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

  try {

    const { id } = req.params;

    const {
      nome,
      usuario,
      senha,
      papel
    } = req.body;

    let resultado;

    if (senha) {

      const senhaCriptografada = await bcrypt.hash(senha, 10);

      resultado = await pg.query(
        `
        UPDATE usuarios
        SET
          nome = $1,
          usuario = $2,
          senha = $3,
          papel = $4
        WHERE id = $5
        RETURNING id
        `,
        [
          nome,
          usuario,
          senhaCriptografada,
          papel,
          id
        ]
      );

    } else {

      resultado = await pg.query(
        `
        UPDATE usuarios
        SET
          nome = $1,
          usuario = $2,
          papel = $3
        WHERE id = $4
        RETURNING id
        `,
        [
          nome,
          usuario,
          papel,
          id
        ]
      );

    }

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    res.json({
      ok: true
    });

  } catch (erro) {

    console.error("Erro ao atualizar usuário:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});




app.post("/login", loginLimiter, async (req, res) => {

  try {

    if (!req.is("application/json")) {
      return res.status(415).json({
        erro: "Formato de requisição inválido."
      });
    }

    if (
      typeof req.body.usuario !== "string" ||
      typeof req.body.senha !== "string"
    ) {
      return res.status(400).json({
        erro: "Dados de login inválidos."
      });
    }

    const usuario = req.body.usuario?.trim();
    const senha = req.body.senha;

    if (usuario?.length > 100 || senha?.length > 200) {
      return res.status(400).json({
        erro: "Dados de login inválidos."
      });
    }


    if (!usuario || !senha) {
      return res.status(400).json({
        erro: "Usuário e senha são obrigatórios."
      });
    }

    const resultado = await pg.query(
      `
      SELECT
        nome,
        usuario,
        senha,
        papel,
        ativo
      FROM usuarios
      WHERE usuario = $1
      `,
      [usuario]
    );

    if (resultado.rows.length === 0) {

      return res.status(401).json({
        erro: "Usuário ou senha inválidos."
      });

    }

    const usuarioEncontrado = resultado.rows[0];

    const senhaValida = await bcrypt.compare(
      senha,
      usuarioEncontrado.senha
    );

    if (!senhaValida) {
      return res.status(401).json({
        erro: "Usuário ou senha inválidos."
      });
    }

    if (!usuarioEncontrado.ativo) {
      return res.status(401).json({
        erro: "Usuário ou senha inválidos."
      });
    }


    const token = jwt.sign(
      {
        usuario: usuarioEncontrado.usuario,
        papel: usuarioEncontrado.papel
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "4h"
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 4 * 60 * 60 * 1000
    });

    res.set("Cache-Control", "no-store");


    res.json({
      nome: usuarioEncontrado.nome,
      usuario: usuarioEncontrado.usuario,
      papel: usuarioEncontrado.papel,
      ativo: usuarioEncontrado.ativo,
    });

  } catch (erro) {

    console.error("Erro no login:", erro);

    res.status(500).json({
      erro: "Erro interno do servidor."
    });

  }

});

app.delete(
  "/usuario/:id",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

  try {

    const { id } = req.params;

    const resultado = await pg.query(
      `
      DELETE FROM usuarios
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    res.json({
      ok: true
    });

  } catch (erro) {

    console.error("Erro ao excluir usuário:", erro);

    res.status(500).json({
      erro: erro.message
    });

  }

});


app.post("/logout", (req, res) => {

  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });

  res.json({
    ok: true
  });

});


app.post(
  "/fotos",
  autenticarToken,
  upload.single("foto"),
  async (req, res) => {

    try {

      const { casa_id } = req.body;
      const arquivo = req.file;

      if (!casa_id || !arquivo) {
        return res.status(400).json({
          erro: "Casa e foto são obrigatórias."
        });
      }

      const nomeSeguro =
        `${Date.now()}-${arquivo.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const chave =
        `casas/${casa_id}/${nomeSeguro}`;

      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: chave,
          Body: arquivo.buffer,
          ContentType: arquivo.mimetype
        })
      );

      await pg.query(
        `
        INSERT INTO fotos (
          casa_id,
          nome_arquivo,
          tipo,
          tamanho,
          url
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          casa_id,
          arquivo.originalname,
          arquivo.mimetype,
          arquivo.size,
          chave
        ]
      );

      res.json({
        ok: true,
        nome: arquivo.originalname
      });

    } catch (erro) {

      console.error("Erro ao enviar foto:", erro);

      res.status(500).json({
        erro: "Erro ao enviar foto."
      });

    }

  }
);


app.post(
  "/drone/fotos",
  autenticarToken,
  somenteEngenheiro,
  upload.array("fotos", 100),
  async (req, res) => {

    try {

      const arquivos = req.files || [];

      if (!arquivos.length) {
        return res.status(400).json({
          erro: "Nenhuma foto selecionada."
        });
      }

      for (const arquivo of arquivos) {

        const nomeSeguro =
          `${Date.now()}-${arquivo.originalname.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          )}`;

        const chave =
          `drone/${nomeSeguro}`;

        await r2.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: chave,
            Body: arquivo.buffer,
            ContentType: arquivo.mimetype
          })
        );

        await pg.query(
          `
          INSERT INTO fotos_drone (
            nome_arquivo,
            url,
            tamanho
          )
          VALUES ($1, $2, $3)
          `,
          [
            arquivo.originalname,
            chave,
            arquivo.size
          ]
        );

      }

      res.json({
        ok: true,
        quantidade: arquivos.length
      });

    } catch (erro) {

      console.error(
        "Erro ao enviar fotos do drone:",
        erro
      );

      res.status(500).json({
        erro: "Erro ao enviar fotos do drone."
      });

    }

  }
);


app.post(
  "/atribuir-casa",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

  try {

    const {
      casa_id,
      colaborador
    } = req.body;

    const jaAtribuida = await pg.query(
      `
      SELECT colaborador
      FROM atribuicoes
      WHERE casa_id = $1
        AND status <> 'concluida'
      LIMIT 1
      `,
      [casa_id]
    );

    if (jaAtribuida.rows.length > 0) {

      return res.status(409).json({
        erro: "Esta casa já está atribuída a " +
          jaAtribuida.rows[0].colaborador
      });

    }

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

app.get(
  "/usuarios",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

  try {

    const resultado = await pg.query(`
      SELECT
        id,
        nome,
        usuario,
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

app.get("/colaboradores", autenticarToken, async (req, res) => {

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

app.get("/fotos/:casaId", autenticarToken, async (req, res) => {

  try {

    const resultado = await pg.query(
      `
      SELECT
        id,
        casa_id,
        nome_arquivo,
        tipo,
        tamanho,
        url,
        data_envio
      FROM fotos
      WHERE casa_id = $1
      ORDER BY id
      `,
      [req.params.casaId]
    );

    const fotos = await Promise.all(
      resultado.rows.map(async foto => {

        const comando = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: foto.url
        });

        const urlTemporaria = await getSignedUrl(
          r2,
          comando,
          {
            expiresIn: 3600
          }
        );

        return {
          ...foto,
          url_temporaria: urlTemporaria
        };

      })
    );

    res.json(fotos);

  } catch (erro) {

    console.error("Erro ao carregar fotos:", erro);

    res.status(500).json({
      erro: "Erro interno do servidor."
    });

  }

});

// ==========================
// LISTAR CADASTROS
// ==========================
app.get("/cadastro", autenticarToken, async (req, res) => {

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
app.get("/cadastro/:casa_id", autenticarToken, async (req, res) => {

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

app.get("/dashboard", autenticarToken, async (req, res) => {

  try{

    const totalMissoes = await pg.query(`
      SELECT COUNT(*) AS total
      FROM atribuicoes
    `);

    const totalColaboradores = await pg.query(`
      SELECT COUNT(*) AS total
      FROM usuarios
      WHERE papel = 'colaborador'
        AND ativo = true
    `);

    const totalCasas = await pg.query(`
      SELECT COUNT(*) AS total
      FROM casas
    `);

    const pendentes = await pg.query(`
      SELECT COUNT(*) AS total
      FROM atribuicoes
      WHERE status = 'pendente'
    `);

    const andamento = await pg.query(`
      SELECT COUNT(*) AS total
      FROM atribuicoes
      WHERE status = 'em_andamento'
    `);

    const concluidas = await pg.query(`
      SELECT COUNT(*) AS total
      FROM atribuicoes
      WHERE status = 'concluida'
    `);

    res.json({

      totalColaboradores: Number(
        totalColaboradores.rows[0].total
      ),

      totalCasas: Number(totalCasas.rows[0].total),

      totalMissoes: Number(totalMissoes.rows[0].total),

      pendentes: Number(pendentes.rows[0].total),

      andamento: Number(andamento.rows[0].total),

      concluidas: Number(concluidas.rows[0].total)

    });

  }catch(err){

    console.error(err);

    res.status(500).json({
      erro: err.message
    });

  }

});


app.get("/dashboard/equipe", autenticarToken, async (req, res) => {

  try{

    const resultado = await pg.query(`

      SELECT

        colaborador,

        SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,

        SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) AS andamento,

        SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) AS concluidas

      FROM atribuicoes

      WHERE colaborador IN (
        SELECT usuario
        FROM usuarios
        WHERE papel = 'colaborador'
          AND ativo = TRUE
      )

      GROUP BY colaborador

      ORDER BY colaborador

    `);

    res.json(resultado.rows);

  }catch(err){

    console.error(err);

    res.status(500).json({
      erro: err.message
    });

  }

});


app.get("/dashboard/ranking", autenticarToken, async (req, res) => {

  try {

    const resultado = await pg.query(`
      SELECT
        a.colaborador,
        COUNT(*) AS total
      FROM atribuicoes a
      INNER JOIN usuarios u
        ON u.usuario = a.colaborador
      WHERE u.papel = 'colaborador'
        AND u.ativo = TRUE
        AND a.status = 'concluida'
      GROUP BY a.colaborador
      ORDER BY COUNT(*) DESC, a.colaborador
    `);

    res.json(resultado.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      erro: err.message
    });

  }

});


app.get("/dashboard/casas-atuais", autenticarToken, async (req, res) => {

  try{

    const resultado = await pg.query(`

      SELECT

        a.colaborador,

        a.casa_id,

        a.status,

        c.numero,

        c.lote_id

      FROM atribuicoes a

      INNER JOIN casas c
      ON c.id = a.casa_id

      WHERE colaborador IN (
        SELECT usuario
        FROM usuarios
        WHERE papel = 'colaborador'
          AND ativo = TRUE
      )
      AND a.status = 'em_andamento'

      ORDER BY a.colaborador

    `);

    res.json(resultado.rows);

  }catch(err){

    console.error(err);

    res.status(500).json({
      erro: err.message
    });

  }

});


app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "cadastro_social.html")
  );

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});



app.post(
  "/relatorios/fechar-dia",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

  try{

    const hoje = new Date();

    const ano = hoje.getFullYear();

    const mes = hoje.getMonth() + 1;

    const dia = hoje.getDate();

    const dataRelatorio =
      `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;

    const existe = await pg.query(
      `
      SELECT 1
      FROM relatorios_diarios
      WHERE data_relatorio = $1
      LIMIT 1
      `,
      [dataRelatorio]
    );

    if(existe.rows.length){

      return res.status(409).json({
        erro: "O relatório de hoje já foi gerado."
      });

    }

    const colaboradores = await pg.query(`
      SELECT
        usuario,
        nome
      FROM usuarios
      WHERE papel = 'colaborador'
        AND ativo = TRUE
      ORDER BY nome
    `);

    for (const colaborador of colaboradores.rows) {

      const contagem = await pg.query(
        `
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
          COUNT(*) FILTER (WHERE status = 'em_andamento') AS andamento,
          COUNT(*) FILTER (WHERE status = 'concluida') AS concluidas
        FROM atribuicoes
        WHERE colaborador = $1
        `,
        [colaborador.usuario]
      );

      console.log(
        "RESUMO:",
        colaborador.usuario,
        contagem.rows[0]
      );

      const resumo = contagem.rows[0];

      await pg.query(
        `
        INSERT INTO relatorios_diarios (
          data_relatorio,
          ano,
          mes,
          dia,
          colaborador,
          nome_colaborador,
          total,
          pendentes,
          andamento,
          concluidas
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          dataRelatorio,
          ano,
          mes,
          dia,
          colaborador.usuario,
          colaborador.nome,
          Number(resumo.total),
          Number(resumo.pendentes),
          Number(resumo.andamento),
          Number(resumo.concluidas)
        ]
      );

    }

    console.log(
      "COLABORADORES DO RELATÓRIO:",
      colaboradores.rows
    );

    res.json({
      ok: true
    });

  }catch(err){

    console.error(err);

    res.status(500).json({
      erro: err.message
    });

  }

});


app.post(
  "/drone/levantamentos",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

    try {

      const {
        nome,
        descricao,
        data_voo
      } = req.body;

      if (!nome || !nome.trim()) {
        return res.status(400).json({
          erro: "Nome do levantamento é obrigatório."
        });
      }

      const resultado = await pg.query(
        `
        INSERT INTO levantamentos_drone (
          nome,
          descricao,
          data_voo,
          criado_por
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          nome.trim(),
          descricao || null,
          data_voo || null,
          req.usuario.usuario
        ]
      );

      res.json(resultado.rows[0]);

    } catch (erro) {

      console.error(
        "Erro ao criar levantamento drone:",
        erro
      );

      res.status(500).json({
        erro: erro.message
      });

    }

  }
);


app.get("/relatorios", autenticarToken, async (req, res) => {

  try {

    const resultado = await pg.query(`
      SELECT
        id,
        data_relatorio,
        ano,
        mes,
        dia,
        colaborador,
        nome_colaborador,
        total,
        pendentes,
        andamento,
        concluidas
      FROM relatorios_diarios
      ORDER BY data_relatorio DESC, concluidas DESC
    `);

    res.json(resultado.rows);

  } catch (err) {

    console.error("Erro ao buscar relatórios:", err);

    res.status(500).json({
      erro: err.message
    });

  }

});

app.get("/relatorios/mensal", autenticarToken, async (req, res) => {

  try{

    const { ano, mes } = req.query;

    const resultado = await pg.query(
      `
      SELECT
        colaborador,
        nome_colaborador,
        SUM(total) AS total,
        SUM(pendentes) AS pendentes,
        SUM(andamento) AS andamento,
        SUM(concluidas) AS concluidas
      FROM relatorios_diarios
      WHERE ano = $1
        AND mes = $2
      GROUP BY colaborador, nome_colaborador
      ORDER BY nome_colaborador
      `,
      [
        Number(ano),
        Number(mes)
      ]
    );

    res.json(resultado.rows);

  }catch(err){

    console.error(err);

    res.status(500).json({
      erro:"Erro ao consultar relatório mensal."
    });

  }

});


app.get("/relatorios/anual", autenticarToken, async (req, res) => {

  try{

    const { ano } = req.query;

    const resultado = await pg.query(
      `
      SELECT
        colaborador,
        nome_colaborador,
        SUM(total) AS total,
        SUM(pendentes) AS pendentes,
        SUM(andamento) AS andamento,
        SUM(concluidas) AS concluidas
      FROM relatorios_diarios
      WHERE ano = $1
      GROUP BY colaborador, nome_colaborador
      ORDER BY nome_colaborador
      `,
      [
        Number(ano)
      ]
    );

    res.json(resultado.rows);

  }catch(err){

    console.error(err);

    res.status(500).json({
      erro:"Erro ao consultar relatório anual."
    });

  }

});


app.get(
  "/debug/atribuicoes/:colaborador",
  autenticarToken,
  somenteEngenheiro,
  async (req, res) => {

    try {

      const resultado = await pg.query(
        `
        SELECT
          id,
          casa_id,
          colaborador,
          status,
          data_atribuicao,
          data_conclusao
        FROM atribuicoes
        WHERE colaborador = $1
        ORDER BY id
        `,
        [req.params.colaborador]
      );

      res.json(resultado.rows);

    } catch (erro) {

      res.status(500).json({
        erro: erro.message
      });

    }

  }
);