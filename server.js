// ============================================
// server.js
// ============================================
require("dotenv").config();
const express = require("express");
const session = require("express-session");

const app = express();

app.use(express.static("public"));
app.use(express.json());

app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
}));

// ============================================
// PÁGINAS HTML
// ============================================

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/views/index.html");
});

app.get("/vagas", (req, res) => {
  res.sendFile(__dirname + "/public/views/vagas.html");
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/views/login.html");
});

app.get("/cadastro", (req, res) => {
  res.sendFile(__dirname + "/public/views/cadastro.html");
});

// Área do desenvolvedor
app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/public/views/dashboard.html");
});

app.get("/meu-progresso", (req, res) => {
  res.sendFile(__dirname + "/public/views/progresso.html");
});

app.get("/roadmap", (req, res) => {
  res.sendFile(__dirname + "/public/views/roadmap.html");
});

// Área da empresa
app.get("/empresa/dashboard", (req, res) => {
  res.sendFile(__dirname + "/public/views/empresa-dashboard.html");
});

// ============================================
// API
// ============================================
app.get("/api/user", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Não autenticado" });
  const { accessToken, ...safeUser } = req.session.user;
  res.json(safeUser);
});

const authRoutes    = require("./routes/auth");
const userRoutes    = require("./routes/users");
const roadmapRoutes = require("./routes/roadmap");
const empresaRoutes = require("./routes/empresa");

app.use("/auth",        authRoutes);
app.use("/api/auth",    userRoutes);
app.use("/api",         roadmapRoutes);
app.use("/api/empresa", empresaRoutes);

// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));