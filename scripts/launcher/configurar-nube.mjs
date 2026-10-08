#!/usr/bin/env node
/**
 * Asistente para conectar RUNNER 360 con un proyecto de Supabase en la nube.
 *  1. Pide la URL y las claves y las verifica contra Supabase.
 *  2. Si la base está vacía, la instala conectándose directo a PostgreSQL con la contraseña
 *     del proyecto (sin pasar por el SQL Editor del panel, que puede modificar el SQL).
 *  3. Escribe apps/web/.env.local.
 * Las claves y la contraseña solo se usan en tu computadora: la contraseña no se guarda.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_FILE = join(ROOT, "apps", "web", ".env.local");
const SQL_STRUCTURE = join(ROOT, "supabase", "nube", "1-estructura.sql");
const SQL_DEMO = join(ROOT, "supabase", "nube", "2-planes-demo.sql");
const PORT = process.env.RUNNER360_PORT ?? "3000";
const ok = (m) => console.log(`\x1b[32m  ✔ ${m}\x1b[0m`);
const bad = (m) => console.log(`\x1b[31m  ✖ ${m}\x1b[0m`);
const info = (m) => console.log(`\x1b[33m  ⚠ ${m}\x1b[0m`);
const title = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

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

// ------------------------------------------------------------ Entrada (cola de líneas)
// No se pierden respuestas aunque se peguen varias juntas.
const rl = createInterface({ input: process.stdin });
const pending = [];
const waiting = [];
let closed = false;
rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : pending.push(line)));
rl.on("close", () => {
  closed = true;
  while (waiting.length) waiting.shift()(null);
});
const ask = async (q) => {
  process.stdout.write(q);
  const line = pending.length ? pending.shift() : closed ? null : await new Promise((r) => waiting.push(r));
  if (line === null) {
    console.log("\nSe cerró la ventana de entrada. Volvé a ejecutar el asistente.");
    process.exit(1);
  }
  if (!process.stdin.isTTY) process.stdout.write("\n");
  return line.trim();
};

// ------------------------------------------------------------ Conexión directa a PostgreSQL
async function loadPg() {
  const req = createRequire(join(ROOT, "package.json"));
  const tryLoad = async () => (await import(pathToFileURL(req.resolve("pg")).href)).default;
  try {
    return await tryLoad();
  } catch {
    info("Instalando el componente de conexión a la base (una sola vez)…");
    const pnpm = spawnSync("pnpm --version", { shell: true, stdio: "ignore" }).status === 0 ? "pnpm" : "npx -y pnpm@10.28.0";
    spawnSync(`${pnpm} install`, { cwd: ROOT, shell: true, stdio: "inherit" });
    return await tryLoad();
  }
}

function explainDbError(e) {
  const code = e?.code ?? "";
  const msg = String(e?.message ?? e);
  if (code === "28P01" || /password authentication failed/i.test(msg)) return "Contraseña incorrecta. Si no la recordás: Project Settings → Database → Reset database password.";
  if (code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "ENETUNREACH" || code === "EHOSTUNREACH")
    return "No se pudo llegar al servidor. Usá la cadena del 'Session pooler' (no la 'Direct connection').";
  if (/tenant or user not found/i.test(msg)) return "El usuario de la cadena no corresponde. Copiá de nuevo la cadena del 'Session pooler'.";
  return msg;
}

async function installDatabase(pg) {
  title("Instalación de la base de datos");
  console.log("En Supabase tocá el botón 'Connect' (arriba, en la página del proyecto) →");
  console.log("pestaña 'Connection String' → tipo 'URI' → método 'Session pooler' → copiá la cadena.");
  console.log("Tiene la forma: postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres\n");
  for (;;) {
    const uri = await ask("4) Cadena de conexión (Session pooler): ");
    if (!/^postgres(ql)?:\/\//.test(uri)) {
      bad("Debe empezar con postgresql://");
      continue;
    }
    let connectionString = uri;
    if (/\[YOUR-PASSWORD\]/i.test(uri)) {
      const password = await ask("5) Contraseña de la base (la que elegiste al crear el proyecto): ");
      connectionString = uri.replace(/\[YOUR-PASSWORD\]/i, encodeURIComponent(password));
    }
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
    // Supabase exige SSL; su certificado no está en el almacén público, por eso no se valida la cadena
    // de certificados (equivale a sslmode=require).
    const client = new pg.Client({ connectionString, ssl: local ? false : { rejectUnauthorized: false } });
    try {
      await client.connect();
    } catch (e) {
      bad(explainDbError(e));
      continue;
    }
    try {
      const state = async () =>
        (
          await client.query(
            `select to_regclass('public.profiles') is not null as has_profiles,
                    to_regclass('public.app_features') is not null as has_all,
                    (select count(*) from pg_class where relname = 'training_plans' and relnamespace = 'public'::regnamespace) as has_plans_table`,
          )
        ).rows[0];
      let s = await state();
      if (s.has_profiles && !s.has_all) {
        bad("La base tiene una instalación incompleta de un intento anterior.");
        console.log("    Lo más simple es crear un proyecto nuevo en Supabase y repetir el asistente.");
        process.exit(1);
      }
      if (!s.has_all) {
        console.log("  Instalando estructura, seguridad y configuración inicial…");
        await client.query(readFileSync(SQL_STRUCTURE, "utf8"));
        ok("Estructura instalada.");
        s = await state();
      } else ok("La estructura ya estaba instalada.");
      const demo = Number((await client.query("select count(*) from public.training_plans where slug like 'demo-%'")).rows[0].count);
      if (demo < 15) {
        console.log("  Cargando los 15 planes DEMO…");
        await client.query(readFileSync(SQL_DEMO, "utf8"));
      }
      const check = (
        await client.query(
          `select (select count(*) from public.training_plan_versions where status = 'published') as plans,
                  (select count(*) from public.subscription_products) as products`,
        )
      ).rows[0];
      ok(`Planes publicados: ${check.plans}. Productos: ${check.products}.`);
      // Avisa a la API de Supabase que hay tablas nuevas.
      await client.query("notify pgrst, 'reload schema'");
      return true;
    } catch (e) {
      bad(`Falló la instalación: ${explainDbError(e)}`);
      console.log("    Copiá este mensaje y enviáselo a quien te ayuda con la instalación.");
      process.exit(1);
    } finally {
      await client.end().catch(() => {});
    }
  }
}

// ------------------------------------------------------------ Flujo principal
title("RUNNER 360 — Conectar con Supabase en la nube");
console.log("Copiá los datos desde supabase.com → tu proyecto → Project Settings → API Keys / Data API.\n");

let url = "";
for (;;) {
  // Acepta también la URL copiada con rutas extra (p. ej. https://xxxx.supabase.co/rest/v1/).
  url = (await ask("1) Project URL (ej. https://abcd1234.supabase.co): ")).replace(/^(https?:\/\/[^/\s]+).*$/i, "$1");
  if (/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) break;
  bad("La URL debe tener la forma https://xxxxx.supabase.co (sin nada después).");
}

let anon = "";
let structureReady = false;
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
    structureReady = r.body.some((p) => p.code === "premium_monthly");
    break;
  }
  if (r.status === 404 || (r.body && JSON.stringify(r.body).includes("PGRST205"))) {
    ok("Conexión correcta (la base todavía está vacía; la instalamos en un momento).");
    break;
  }
  if (r.status === 0) bad(`No se pudo conectar a ${url}. Revisá la URL y tu conexión a internet.`);
  else if (r.status === 401 || r.status === 403) bad("Supabase rechazó la clave. Verificá que sea la publicable de ESTE proyecto.");
  else bad(`Respuesta inesperada de Supabase (${r.status}).`);
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
    break;
  }
  bad("Supabase rechazó la clave secreta. Copiala de nuevo (o Enter para omitir).");
}

let demoReady = false;
if (structureReady && service) {
  const plans = await get(`${url}/rest/v1/training_plans?select=slug&slug=like.demo-*`, service);
  demoReady = plans.status === 200 && Array.isArray(plans.body) && plans.body.length >= 15;
}
if (structureReady && (demoReady || !service)) {
  ok("La base de datos ya está instalada.");
} else {
  await installDatabase(await loadPg());
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
console.log(
  process.platform === "win32"
    ? "A continuación se crea el ícono en el escritorio y se abre RUNNER 360. La primera vez compila (unos minutos).\n"
    : "Ahora abrí RUNNER 360 con el ícono del escritorio. La primera vez compila (1–2 minutos).\n",
);
process.exit(0);
