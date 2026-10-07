#!/usr/bin/env node
/**
 * Asistente para conectar RUNNER 360 con un proyecto de Supabase en la nube.
 * Pide la URL y las claves, las verifica contra Supabase y escribe apps/web/.env.local.
 * Las claves solo se guardan en tu computadora (ese archivo nunca se sube al repositorio).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_FILE = join(ROOT, "apps", "web", ".env.local");
const PORT = process.env.RUNNER360_PORT ?? "3000";
const ok = (m) => console.log(`\x1b[32m  ✔ ${m}\x1b[0m`);
const bad = (m) => console.log(`\x1b[31m  ✖ ${m}\x1b[0m`);
const info = (m) => console.log(`\x1b[33m  ⚠ ${m}\x1b[0m`);

/** Las claves nuevas (sb_…) van solo en `apikey`; las clásicas (JWT eyJ…) también como Bearer. */
function headers(key) {
  const h = { apikey: key };
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

async function get(url, key) {
  try {
    const res = await fetch(url, { headers: headers(key), signal: AbortSignal.timeout(15000) });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

// Cola de líneas: no se pierden respuestas aunque se peguen varias juntas.
const rl = createInterface({ input: process.stdin });
const pending = [];
const waiting = [];
rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : pending.push(line)));
let closed = false;
rl.on("close", () => {
  closed = true;
  while (waiting.length) waiting.shift()(null);
});
const ask = async (q) => {
  process.stdout.write(q);
  if (closed && !pending.length) {
    console.log("\nSe cerró la ventana de entrada. Volvé a ejecutar el asistente.");
    process.exit(1);
  }
  const line = pending.length ? pending.shift() : await new Promise((r) => waiting.push(r));
  if (line === null) {
    console.log("\nSe cerró la ventana de entrada. Volvé a ejecutar el asistente.");
    process.exit(1);
  }
  if (!process.stdin.isTTY) process.stdout.write("\n");
  return line.trim();
};

console.log("\n\x1b[1mRUNNER 360 — Conectar con Supabase en la nube\x1b[0m");
console.log("Copiá los datos desde supabase.com → tu proyecto → Project Settings → API Keys / Data API.\n");

let url = "";
for (;;) {
  url = (await ask("1) Project URL (ej. https://abcd1234.supabase.co): ")).replace(/\/+$/, "");
  if (/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) break;
  bad("La URL debe tener la forma https://xxxxx.supabase.co (sin nada después).");
}

let anon = "";
for (;;) {
  anon = await ask("2) Publishable key (o 'anon public'): ");
  if (anon.length < 20) {
    bad("Esa clave parece incompleta. Copiala de nuevo.");
    continue;
  }
  if (anon.startsWith("sb_secret_")) {
    bad("Esa es la clave SECRETA. Acá va la publicable (sb_publishable_… o anon).");
    continue;
  }
  const r = await get(`${url}/rest/v1/subscription_products?select=code`, anon);
  if (r.status === 200 && Array.isArray(r.body)) {
    ok("Conexión correcta.");
    if (r.body.some((p) => p.code === "premium_monthly")) ok("La estructura de la base (paso 1-estructura.sql) está cargada.");
    else info("No se encontraron los productos: ¿ejecutaste supabase/nube/1-estructura.sql?");
    break;
  }
  if (r.status === 0) bad(`No se pudo conectar a ${url}. Revisá la URL y tu conexión a internet.`);
  else if (r.status === 401 || r.status === 403) bad("Supabase rechazó la clave. Verificá que sea la publicable de ESTE proyecto.");
  else if (r.status === 404 || (r.body && JSON.stringify(r.body).includes("PGRST205"))) {
    bad("La clave funciona, pero falta la estructura de la base.");
    console.log("    Ejecutá supabase/nube/1-estructura.sql en el SQL Editor y volvé a pegar la clave.");
  } else bad(`Respuesta inesperada de Supabase (${r.status}).`);
}

let service = "";
for (;;) {
  service = await ask("3) Secret key (o 'service_role'). Opcional, Enter para omitir: ");
  if (!service) {
    info("Sin la clave secreta no funcionan la eliminación automática de cuentas ni los pagos. Podés agregarla después.");
    break;
  }
  if (service === anon || service.startsWith("sb_publishable_")) {
    bad("Esa es la clave publicable. Acá va la secreta (sb_secret_… o service_role).");
    continue;
  }
  const admin = await get(`${url}/auth/v1/admin/users?per_page=1`, service);
  if (admin.status === 200) {
    ok("Clave secreta válida.");
    const plans = await get(`${url}/rest/v1/training_plans?select=slug&slug=like.demo-*`, service);
    if (plans.status === 200 && Array.isArray(plans.body)) {
      if (plans.body.length >= 15) ok(`Planes DEMO cargados (${plans.body.length}).`);
      else info("No están los planes DEMO: ejecutá supabase/nube/2-planes-demo.sql en el SQL Editor.");
    }
    break;
  }
  bad("Supabase rechazó la clave secreta. Copiala de nuevo (o Enter para omitir).");
}
rl.close();

if (existsSync(ENV_FILE)) {
  writeFileSync(`${ENV_FILE}.anterior`, readFileSync(ENV_FILE));
  info("Había una configuración previa: quedó guardada como apps/web/.env.local.anterior");
}
writeFileSync(
  ENV_FILE,
  [
    "# Generado por scripts/launcher/configurar-nube.mjs. No subir al repositorio.",
    `NEXT_PUBLIC_SITE_URL=http://localhost:${PORT}`,
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    "",
  ].join("\n"),
);
console.log("\n\x1b[1m\x1b[32mListo. RUNNER 360 quedó conectado a tu proyecto de Supabase.\x1b[0m");
console.log("Ahora abrí RUNNER 360 con el ícono del escritorio. La primera vez compila (1–2 minutos).\n");
