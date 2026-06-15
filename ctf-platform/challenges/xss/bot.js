/**
 * challenges/xss/bot.js
 * Bot admin simulado con Puppeteer.
 * Visita /admin cada 30s con cookies role=admin y flag=<FLAG>.
 * httpOnly: false — CRÍTICO para que document.cookie incluya la flag.
 */
"use strict";

const puppeteer = require("puppeteer-core");

const FLAG = process.env.FLAG;
const BOT_INTERVAL_MS = 30_000; // 30 segundos
const WAIT_AFTER_LOAD_MS = 3_000; // tiempo para que el XSS dispare fetch()

/**
 * Una visita del bot al panel de admin.
 */
async function visitAsAdmin(port) {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Setear cookies ANTES de navegar
    await page.setCookie(
      {
        name: "role",
        value: "admin",
        domain: "localhost",
        path: "/",
        httpOnly: false, // accesible por JS — necesario para el challenge
        sameSite: "Lax",
      },
      {
        name: "flag",
        value: FLAG,
        domain: "localhost",
        path: "/",
        httpOnly: false, // ⚠️ CRÍTICO: false para que document.cookie lo exponga
        sameSite: "Lax",
      }
    );

    await page.goto(`http://localhost:${port}/admin`, {
      waitUntil: "networkidle2",
      timeout: 15_000,
    });

    // Esperar a que el payload XSS (si existe) dispare su fetch()
    await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_LOAD_MS));

    console.log(`[bot] visited /admin at ${new Date().toISOString()}`);
    // NO logear la flag completa — defensa en profundidad
  } catch (err) {
    console.error(`[bot] ERROR: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Inicia el loop del bot.
 * @param {number} port — puerto en el que corre el servidor
 */
function startBot(port) {
  if (!FLAG) {
    console.error("[bot] FLAG env var not set — bot disabled.");
    return;
  }
  console.log(`[bot] Starting. Will visit /admin every ${BOT_INTERVAL_MS / 1000}s.`);
  visitAsAdmin(port); // primera visita inmediata
  setInterval(() => visitAsAdmin(port), BOT_INTERVAL_MS);
}

module.exports = { startBot };
