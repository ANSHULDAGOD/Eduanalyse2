require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const OpenAI = require("openai");

// ─── App Setup ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ FIXED FOR RENDER
const BASE_URL =
  process.env.BASE_URL || "https://eduanalyse2.onrender.com";

// ─── Paths ─────────────────────────────────────────────────
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PASSWORD_FILE = path.join(__dirname, "password.json");

[OUTPUTS_DIR, UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── OpenAI ────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── In-Memory Store ───────────────────────────────────────
let reportStore = [];

// ─── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/outputs", express.static(path.join(__dirname, "outputs")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "eduanalyze-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

// ─── Multer ────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.random();
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ─── Auth Middleware ───────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// ─── Debug Routes ──────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// ✅ FIX: So you don’t see “Cannot GET”
app.get("/api/process", (req, res) => {
  res.send("❌ Use POST request for /api/process");
});

// ─── Auth Routes ───────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { password } = req.body;
  const pwdFile = JSON.parse(fs.readFileSync(PASSWORD_FILE, "utf8"));
  const match = await bcrypt.compare(password, pwdFile.hash);

  if (!match) return res.status(401).json({ error: "Invalid password" });

  req.session.authenticated = true;
  res.json({ success: true });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ─── MAIN ROUTE ────────────────────────────────────────────
app.post(
  "/api/process",
  requireAuth,
  upload.fields([
    { name: "questionPaper", maxCount: 1 },
    { name: "answerSheets", maxCount: 50 },
    { name: "excelFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      res.json({
        success: true,
        message: "Processing route working ✅",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── Health ────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    reports: reportStore.length,
  });
});

// ─── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});