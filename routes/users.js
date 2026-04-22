// ============================================
// routes/users.js
// Rotas de cadastro e login por email/senha
// ============================================
const express  = require("express");
const bcrypt   = require("bcrypt");
const router   = express.Router();
const db       = require("../database/db");

const SALT_ROUNDS = 10;

// --------------------------------------------
// POST /api/auth/register
// Cria uma nova conta (dev ou empresa)
// --------------------------------------------
router.post("/register", async (req, res) => {
  const { type, email, password } = req.body;

  if (!type || !email || !password) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  if (!["dev", "empresa"].includes(type)) {
    return res.status(400).json({ error: "Tipo de conta inválido." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "A senha deve ter no mínimo 8 caracteres." });
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email.toLowerCase().trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Este e-mail já está cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query(
      "INSERT INTO users (email, password_hash, type) VALUES (?, ?, ?)",
      [email.toLowerCase().trim(), passwordHash, type]
    );

    const userId = result.insertId;

    if (type === "dev") {
      const { nome, sobrenome, github_login, nivel } = req.body;

      if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

      await db.query(
        `INSERT INTO user_dev_profiles (user_id, nome, sobrenome, github_login, nivel)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, nome, sobrenome ?? null, github_login ?? null, nivel ?? "iniciante"]
      );

    } else {
      const { razao_social, nome_fantasia, cnpj, setor, tamanho, site } = req.body;

      if (!razao_social) return res.status(400).json({ error: "Razão social é obrigatória." });
      if (!cnpj)         return res.status(400).json({ error: "CNPJ é obrigatório." });

      const cnpjDigits = cnpj.replace(/\D/g, "");
      if (cnpjDigits.length !== 14) {
        return res.status(400).json({ error: "CNPJ inválido." });
      }

      const [cnpjExists] = await db.query(
        "SELECT id FROM user_company_profiles WHERE cnpj = ?",
        [cnpjDigits]
      );
      if (cnpjExists.length > 0) {
        return res.status(409).json({ error: "Este CNPJ já está cadastrado." });
      }

      await db.query(
        `INSERT INTO user_company_profiles
           (user_id, razao_social, nome_fantasia, cnpj, setor, tamanho, site)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, razao_social, nome_fantasia ?? null, cnpjDigits, setor, tamanho, site ?? null]
      );
    }

    // Monta a sessão após cadastro
    req.session.user = {
      id:    userId,
      email: email.toLowerCase().trim(),
      type,
    };

    // Busca perfil complementar para colocar o nome na sessão
    if (type === "dev") {
      const { nome, sobrenome, github_login, nivel } = req.body;
      req.session.user.name         = `${nome} ${sobrenome ?? ""}`.trim();
      req.session.user.github_login = github_login ?? null;
      req.session.user.nivel        = nivel ?? "iniciante";
    } else {
      const { razao_social, nome_fantasia } = req.body;
      req.session.user.name = nome_fantasia || razao_social;
    }

    // ✅ Devs vão para /dashboard; empresas para /empresa/dashboard (futuro)
    const redirect = type === "dev" ? "/dashboard" : "/empresa/dashboard";
    res.status(201).json({ success: true, redirect });

  } catch (err) {
    console.error("Erro no cadastro:", err.message);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

// --------------------------------------------
// POST /api/auth/login
// Autentica um usuário por email e senha
// --------------------------------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const user = rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    // Monta a sessão
    req.session.user = {
      id:    user.id,
      email: user.email,
      type:  user.type,
    };

    // Busca dados complementares
    if (user.type === "dev") {
      const [profile] = await db.query(
        "SELECT * FROM user_dev_profiles WHERE user_id = ?",
        [user.id]
      );
      if (profile.length > 0) {
        req.session.user.name         = `${profile[0].nome} ${profile[0].sobrenome ?? ""}`.trim();
        req.session.user.github_login = profile[0].github_login;
        req.session.user.nivel        = profile[0].nivel;
      }
    } else {
      const [profile] = await db.query(
        "SELECT * FROM user_company_profiles WHERE user_id = ?",
        [user.id]
      );
      if (profile.length > 0) {
        req.session.user.name         = profile[0].nome_fantasia ?? profile[0].razao_social;
        req.session.user.razao_social = profile[0].razao_social;
      }
    }

    // ✅ Devs vão para /dashboard; empresas para /empresa/dashboard (futuro)
    const redirect = user.type === "dev" ? "/dashboard" : "/empresa/dashboard";
    res.json({ success: true, redirect });

  } catch (err) {
    console.error("Erro no login:", err.message);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

module.exports = router;