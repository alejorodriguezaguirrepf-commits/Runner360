#!/usr/bin/env node
/**
 * Lanzador de RUNNER 360 para uso local (Windows, macOS y Linux).
 *
 * Qué hace, en orden:
 *  1. Verifica Node.js y pnpm (si falta pnpm, usa `npx pnpm@10.28.0`).
 *  2. Instala dependencias la primera vez.
 *  3. Prepara la base de datos:
 *     - Si apps/web/.env.local apunta a un Supabase en la nube, lo usa tal cual.
 *     - Si no, con Docker: `supabase start` (Supabase local) y escribe .env.local.
 *     - Si no hay Docker y es Linux con PostgreSQL: scripts/local-backend/start.sh.
 *     - Si no hay ninguna opción: inicia igual, en modo "pendiente de configuración".
 *  4. Compila la web si hace falta (primera vez, cambios de código o de configuración).
 *  5. Inicia el servidor en http://localhost:3000 y abre el navegador.
 *
 * Cerrá la ventana o apretá Ctrl+C para detenerlo.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WEB = join(ROOT, "apps", "web");
const ENV_FILE = join(WEB, ".env.local");
const PORT = process.env.RUNNER360_PORT ?? "3000";
const URL = `http://localhost:${PORT}`;
const IS_WIN = process.platform === "win32";
const SUPABASE_CLI = "npx -y supabase@2.119.0";

const say = (msg) => console.log(`\n\x1b[1m\x1b[32m▶ ${msg}\x1b[0m`);
const warn = (msg) => console.log(`\n\x1b[33m⚠ ${msg}\x1b[0m`);
const fail = (msg) => {
  console.error(`\n\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
};

/** Ejecuta un comando mostrando su salida. Devuelve true si terminó bien. */
function run(cmd, opts = {}) {
  const r = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: opts.quiet ? "pipe" : "inherit", env: { ...process.env, ...opts.env } });
  return { ok: r.status === 0, out: r.stdout?.toString() ?? "" };
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function writeEnv(values) {
  const lines = [
    "# Generado por scripts/launcher/runner360.mjs. No subir al repositorio.",
    `NEXT_PUBLIC_SITE_URL=${URL}`,
    `NEXT_PUBLIC_SUPABASE_URL=${values.url}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${values.anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${values.service ?? ""}`,
    "",
  ];
  writeFileSync(ENV_FILE, lines.join("\n"));
}

async function isUp(url) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2000) });
    return res.status > 0;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  const cmd = IS_WIN ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  spawnSync(cmd, { shell: true, stdio: "ignore" });
}

// ---------------------------------------------------------------- 1. Herramientas
say("RUNNER 360 — preparando el inicio local");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) fail(`Se necesita Node.js 20.9 o superior (tenés ${process.versions.node}). Descargalo en https://nodejs.org`);

let PNPM = "pnpm";
if (!run("pnpm --version", { quiet: true }).ok) {
  warn("pnpm no está instalado; se usará una copia temporal con npx.");
  PNPM = "npx -y pnpm@10.28.0";
}

// ---------------------------------------------------------------- 2. Dependencias
if (!existsSync(join(ROOT, "node_modules")) || !existsSync(join(WEB, "node_modules"))) {
  say("Instalando dependencias (solo la primera vez, puede tardar unos minutos)…");
  if (!run(`${PNPM} install`).ok) fail("No se pudieron instalar las dependencias. Revisá tu conexión a internet.");
}

// ¿Ya está corriendo? Entonces solo abrimos el navegador.
if (await isUp(URL)) {
  say(`RUNNER 360 ya está en marcha. Abriendo ${URL}`);
  openBrowser(URL);
  process.exit(0);
}

// ---------------------------------------------------------------- 3. Base de datos
const current = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, "utf8")) : {};
const configuredUrl = current.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isRemote = /^https:\/\//.test(configuredUrl) && !/localhost|127\.0\.0\.1/.test(configuredUrl);
let stopBackend = null;

if (isRemote) {
  say(`Usando Supabase en la nube: ${configuredUrl}`);
} else if (run("docker info", { quiet: true }).ok) {
  say("Iniciando Supabase local con Docker (la primera vez descarga imágenes)…");
  if (!run(`${SUPABASE_CLI} start`).ok) fail("No se pudo iniciar Supabase local. Verificá que Docker Desktop esté abierto.");
  const status = parseEnv(run(`${SUPABASE_CLI} status -o env`, { quiet: true }).out);
  const url = status.API_URL;
  const anon = status.ANON_KEY || status.PUBLISHABLE_KEY;
  const service = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
  if (!url || !anon) fail("No se pudieron leer las claves de Supabase local (supabase status).");
  writeEnv({ url, anon, service });
  console.log("   Base local lista. Para apagarla más tarde: npx supabase stop");
} else if (!IS_WIN && process.platform === "linux" && existsSync("/usr/lib/postgresql")) {
  say("Docker no está disponible: iniciando el backend local sin Docker (PostgreSQL + Auth + API)…");
  if (!run("bash scripts/local-backend/start.sh").ok) fail("No se pudo iniciar el backend local. Ver .local-backend/logs/");
  const keys = parseEnv(readFileSync(join(ROOT, ".local-backend", "keys.env"), "utf8"));
  writeEnv({ url: "http://127.0.0.1:54321", anon: keys.ANON_KEY, service: keys.SERVICE_ROLE_KEY });
  stopBackend = () => run("bash scripts/local-backend/stop.sh", { quiet: true });
} else if (configuredUrl) {
  say(`Usando la configuración existente: ${configuredUrl}`);
} else {
  warn(
    "No hay base de datos configurada.\n" +
      "  Opción 1: instalá Docker Desktop y volvé a abrir RUNNER 360 (se configura solo).\n" +
      "  Opción 2: creá un proyecto en supabase.com y completá apps/web/.env.local (ver README).\n" +
      "  La app se abrirá igual, pero el registro y el ingreso estarán deshabilitados.",
  );
}

// ---------------------------------------------------------------- 4. Compilación
const envText = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const head = run("git rev-parse HEAD", { quiet: true }).out.trim();
const dirty = run("git status --porcelain -- apps packages", { quiet: true }).out;
const stamp = createHash("sha256").update(envText).update(head).update(dirty).digest("hex");
const stampFile = join(WEB, ".next", "runner360-build-stamp");
const built = existsSync(join(WEB, ".next", "BUILD_ID")) && existsSync(stampFile) && readFileSync(stampFile, "utf8") === stamp;
if (!built) {
  say("Compilando la aplicación (solo cuando hay cambios, ~1 minuto)…");
  if (!run(`${PNPM} --filter web build`).ok) fail("La compilación falló. Revisá los mensajes de arriba.");
  writeFileSync(stampFile, stamp);
}

// ---------------------------------------------------------------- 5. Servidor
say(`Iniciando RUNNER 360 en ${URL}`);
// En macOS/Linux el servidor corre en su propio grupo de procesos para poder cerrarlo completo.
const server = spawn(`${PNPM} --filter web start -p ${PORT}`, { cwd: ROOT, shell: true, stdio: "inherit", detached: !IS_WIN });

const shutdown = () => {
  console.log("\nDeteniendo RUNNER 360…");
  if (IS_WIN) spawnSync(`taskkill /pid ${server.pid} /T /F`, { shell: true, stdio: "ignore" });
  else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
  stopBackend?.();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP", shutdown);
server.on("exit", (code) => {
  stopBackend?.();
  if (code && code !== 0) fail(`El servidor se cerró con código ${code}.`);
  process.exit(0);
});

for (let i = 0; i < 120 && !(await isUp(URL)); i++) await new Promise((r) => setTimeout(r, 500));
if (await isUp(URL)) {
  say(`¡Listo! RUNNER 360 está abierto en ${URL}`);
  console.log("   Dejá esta ventana abierta mientras uses la app. Para cerrarla: Ctrl+C o cerrar la ventana.");
  if (!process.env.RUNNER360_NO_BROWSER) openBrowser(URL);
} else {
  warn(`El servidor tarda en responder. Probá abrir ${URL} manualmente.`);
}
