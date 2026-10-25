// Sincroniza la biblioteca de planes con la base de Supabase usando la API (sin conexión directa
// a PostgreSQL). Corre antes de `next build` en Vercel, donde están NEXT_PUBLIC_SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY. Sin esas variables (CI, builds locales) no hace nada.
//
// - Idempotente: si la content_version ya está completa con la misma huella, no cambia nada.
// - Si la versión existe con OTRA huella, no toca nada y avisa (hay que subir content_version).
// - Solo inserta (ON CONFLICT DO NOTHING): nunca modifica ni borra contenido ni datos de usuarios.
// - Nunca hace fallar el build: ante un error avisa en el log (sin claves) y sigue.
// - Solo en producción: en las vistas previas de Vercel (VERCEL_ENV=preview) no corre, para que
//   una rama de prueba no publique contenido en la base real.
//
// Requiere que las migraciones de la biblioteca ya estén aplicadas (pnpm db:migrate).
import { libraryTables, parseLibrary, rowObject } from "../src/import-sql";
import { readLibraryJson } from "./paths";

const CHUNK = 400;
const TIMEOUT_MS = 30_000;

function env(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "");
}

const log = (m: string) => console.log(`[biblioteca] ${m}`);

async function main() {
  if (env("VERCEL_ENV") === "preview") {
    log("sincronización omitida: es una vista previa de Vercel (solo se publica desde producción).");
    return;
  }
  const rawUrl = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const origin = /^(https?:\/\/[^/\s?#]+)/i.exec(rawUrl)?.[1];
  if (!origin || !key) {
    log("sincronización omitida: no hay URL de Supabase o clave de servicio en este entorno.");
    return;
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const api = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${origin}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res;
  };

  const { library, checksum } = parseLibrary(readLibraryJson());
  const v = library.content_version;
  const tables = libraryTables(library, checksum);
  const expectedDays = tables.find((t) => t.table === "library_days")!.rows.length;

  const existing = (await (await api(`library_versions?select=checksum,is_current&content_version=eq.${encodeURIComponent(v)}`)).json()) as {
    checksum: string;
    is_current: boolean;
  }[];
  if (existing[0] && existing[0].checksum !== checksum) {
    log(`AVISO: la versión ${v} ya está en la base con otro contenido. No se tocó nada: subí content_version en el JSON.`);
    return;
  }
  const countRes = await api(`library_days?select=week&content_version=eq.${encodeURIComponent(v)}&limit=1`, { headers: { Prefer: "count=exact" } });
  const count = Number(countRes.headers.get("content-range")?.split("/")[1] ?? "0");
  if (existing[0]?.is_current && count === expectedDays) {
    log(`al día: versión ${v} completa (${count} días).`);
    return;
  }

  for (const t of tables) {
    const onConflict = t.conflict.replaceAll(" ", "");
    for (let i = 0; i < t.rows.length; i += CHUNK) {
      const body = t.rows.slice(i, i + CHUNK).map((r) => rowObject(t, r));
      await api(`${t.table}?on_conflict=${onConflict}`, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(body),
      });
    }
  }
  // La versión importada pasa a ser la vigente (en dos pasos por el índice único).
  await api(`library_versions?is_current=eq.true&content_version=neq.${encodeURIComponent(v)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ is_current: false }),
  });
  await api(`library_versions?content_version=eq.${encodeURIComponent(v)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ is_current: true }),
  });
  log(`sincronizada: versión ${v} (${library.plans.length} planes, ${expectedDays} días).`);
}

main().catch((e) => {
  // Solo el mensaje: nunca la clave ni la URL completa.
  console.warn(`[biblioteca] no se pudo sincronizar: ${(e as Error).message}`);
});
