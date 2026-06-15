/**
 * challenges/xss/server.js
 * Challenge: The Guestbook (Stored XSS)
 *
 * Vulnerabilidad intencional: comentarios almacenados y renderizados sin sanitizar.
 * El bot admin visita /admin con una cookie flag — objetivo: exfiltrar esa cookie.
 */
"use strict";

const express = require("express");
const path = require("path");
const { startBot } = require("./bot");

const app = express();
const PORT = 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── Estado en memoria ─────────────────────────────────────────────────────────
const comments = [];
const MAX_COMMENTS = 50; // FIFO — evita OOM trivial

// ── Rutas ─────────────────────────────────────────────────────────────────────

// GET / → sirve index.html (manejado por express.static)

/**
 * POST /comment — almacena el comentario SIN sanitizar.
 * ⚠️ VULNERABILIDAD INTENCIONAL — no añadir DOMPurify ni escape aquí.
 */
app.post("/comment", (req, res) => {
  const content = req.body.content || "";
  if (content.trim()) {
    comments.push(content);
    if (comments.length > MAX_COMMENTS) {
      comments.shift(); // descarta el más antiguo
    }
  }
  res.redirect("./");
});

/**
 * GET /comments — devuelve comentarios como HTML sin escapar.
 * El cliente los inyecta con innerHTML → XSS stored se dispara aquí.
 * ⚠️ VULNERABILIDAD INTENCIONAL
 */
app.get("/comments", (req, res) => {
  if (comments.length === 0) {
    return res.send('<p style="color:#8b949e;font-size:0.85rem;">Sin comentarios aún.</p>');
  }
  const html = comments
    .map((c) => `<div class="comment">${c}</div>`) // sin escape — intencional
    .join("\n");
  res.send(html);
});

/**
 * GET /admin — solo accesible con cookie role=admin.
 * Renderiza los comentarios igual que /comments.
 * El bot llega aquí con su cookie flag=<FLAG> (httpOnly: false).
 */
app.get("/admin", (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");

  if (cookies.role !== "admin") {
    return res.status(403).send(`
      <html><body style="background:#0d0d0d;color:#f85149;font-family:monospace;padding:2rem;">
        <h2>403 — Acceso denegado</h2>
        <p>Solo el admin puede ver esta página.</p>
      </body></html>
    `);
  }

  // Renderiza los comentarios — el XSS se ejecutará en el contexto del bot
  const commentsHtml = comments.length > 0
    ? comments.map((c) => `<div class="c">${c}</div>`).join("\n") // ⚠️ sin escape
    : "<p>Sin comentarios.</p>";

  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Admin Panel</title></head>
    <body style="background:#0d0d0d;color:#c9d1d9;font-family:monospace;padding:2rem;">
      <h1 style="color:#58a6ff;">Admin Panel</h1>
      <h2>Comentarios de usuarios:</h2>
      ${commentsHtml}
    </body></html>
  `);
});

// GET /health — healthcheck para Docker y para el backend Django (Fase 2)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseCookies(header) {
  return header.split(";").reduce((acc, part) => {
    const [k, ...v] = part.trim().split("=");
    if (k) acc[k.trim()] = v.join("=").trim();
    return acc;
  }, {});
}

// ── Arrancar servidor + bot ───────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Escuchando en http://0.0.0.0:${PORT}`);
  // Dar 3s al servidor para estar listo antes de que el bot empiece
  setTimeout(() => startBot(PORT), 3000);
});
