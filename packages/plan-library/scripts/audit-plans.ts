// Auditoría de los planes: repeticiones entre semanas, distancias de pasadas, velocidad en segundos,
// partes principales en tiempo y volumen/intensidad por nivel. Escribe un informe en Markdown.
// Uso: pnpm --filter @runner360/plan-library audit [ruta-del-json] [ruta-del-informe]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isSession } from "../src/invariants";
import { librarySchema, type Library, type LibraryPlan, type LibrarySessionDay } from "../src/schema";
import { modelSpeeds } from "../src/distance";
import { ALLOWED_REP_METERS, averageWeeklyKm, repDistances, repeatedQuality, timedReps, timedRunning } from "../src/quality-rules";
import { LIBRARY_JSON, readLibraryJson } from "./paths";

const [jsonPath = LIBRARY_JSON, outPath] = process.argv.slice(2);
const lib: Library = librarySchema.parse(readLibraryJson(jsonPath));

const INTENSITY_KEY: Record<string, string> = { Recuperación: "rec", Suave: "suave", Moderado: "mod", Umbral: "umb", Intenso: "int", Velocidad: "vel" };
const REFERENCE: Record<string, number> = { rec: 8.5, suave: 9.5, mod: 10.5, umb: 11, int: 11.8, vel: 13 };
const DEMANDING = ["Umbral", "Intenso", "Velocidad"];
const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

function demandingKm(plan: LibraryPlan, d: LibrarySessionDay): number {
  const sp = { ...REFERENCE, ...(modelSpeeds(lib.model_runner_assumptions, plan.chapter) ?? {}) };
  return DEMANDING.reduce((a, name) => a + ((d.minutes_by_intensity[name] ?? 0) / 60) * (sp[INTENSITY_KEY[name]!] ?? 0), 0);
}

const normalize = (s: string) => s.replace(/\d+([.,]\d+)?/g, "N");

/** Casi iguales: misma estructura (sin números) y volumen principal parecido (±10 %). */
function nearRepeated(plan: LibraryPlan): number {
  let n = 0;
  for (let i = 1; i < plan.weeks.length; i++) {
    const prev = plan.weeks[i - 1]!.days.filter(isSession).filter((d) => d.is_quality && d.category !== "race");
    for (const d of plan.weeks[i]!.days.filter(isSession).filter((x) => x.is_quality && x.category !== "race")) {
      const twin = prev.find((p) => p.main_set !== d.main_set && normalize(p.main_set) === normalize(d.main_set));
      if (twin && Math.abs(twin.distance_km_est - d.distance_km_est) / d.distance_km_est <= 0.1) n++;
    }
  }
  return n;
}

const lines: string[] = [];
const out = (s = "") => lines.push(s);

out(`# Auditoría de planes — contenido ${lib.content_version}`);
out();
out(`Generado por \`packages/plan-library/scripts/audit-plans.ts\`. ${lib.plans.length} planes.`);
out();

// 1. Repeticiones
out("## 1. Sesiones de calidad iguales o casi iguales a la semana anterior");
out();
out("| Plan | Distancia · nivel · días | Semanas | Iguales | Casi iguales |");
out("|---|---|---|---|---|");
let totalSame = 0;
let totalNear = 0;
for (const p of lib.plans) {
  const same = repeatedQuality(p).length;
  const near = nearRepeated(p);
  totalSame += same;
  totalNear += near;
  out(`| ${p.id} | ${p.distance} · ${p.level} · ${p.days_per_week} | ${p.duration_weeks} | ${same} | ${near} |`);
}
out(`| **Total** | | | **${totalSame}** | **${totalNear}** |`);
out();

// 2. Pasadas fuera de la lista
const allowed = new Set<number>(ALLOWED_REP_METERS);
const offList = new Map<string, { count: number; plans: Set<string> }>();
const timed = new Map<string, { count: number; plans: Set<string>; seconds: boolean }>();
const timedMain = new Map<string, { count: number; plans: Set<string> }>();
for (const p of lib.plans)
  for (const w of p.weeks)
    for (const d of w.days.filter(isSession)) {
      for (const field of ["warmup", "main_set", "cooldown"] as const) {
        for (const r of repDistances(d[field]))
          if (!allowed.has(r.meters)) {
            const e = offList.get(r.raw) ?? { count: 0, plans: new Set() };
            e.count++;
            e.plans.add(p.id);
            offList.set(r.raw, e);
          }
        for (const r of timedReps(d[field])) {
          const key = `${field === "main_set" ? "Principal" : field === "warmup" ? "Calentamiento" : "Vuelta a la calma"}: ${r.raw}`;
          const e = timed.get(key) ?? { count: 0, plans: new Set(), seconds: r.seconds };
          e.count++;
          e.plans.add(p.id);
          timed.set(key, e);
        }
      }
      if (timedRunning(d.main_set).length) {
        const key = normalize(d.main_set).replace(/N/g, "#");
        const e = timedMain.get(key) ?? { count: 0, plans: new Set() };
        e.count++;
        e.plans.add(p.id);
        timedMain.set(key, e);
      }
    }
const planList = (s: Set<string>) => [...s].map((x) => x.replace("plan-", "")).join(", ");

out("## 2. Pasadas con distancias fuera de la lista permitida");
out();
out(`Permitidas: ${ALLOWED_REP_METERS.join(", ")} m.`);
out();
out("| Pasada | Veces | Planes |");
out("|---|---|---|");
for (const [raw, e] of [...offList].sort((a, b) => b[1].count - a[1].count)) out(`| ${raw} | ${e.count} | ${planList(e.plans)} |`);
if (offList.size === 0) out("| (ninguna) | | |");
out();

out("## 3. Trabajos dosificados por tiempo (velocidad en segundos y repeticiones por minutos)");
out();
out("| Dónde y cómo | Tipo | Veces | Planes |");
out("|---|---|---|---|");
for (const [raw, e] of [...timed].sort((a, b) => b[1].count - a[1].count))
  out(`| ${raw} | ${e.seconds ? "segundos" : "minutos"} | ${e.count} | ${planList(e.plans)} |`);
if (timed.size === 0) out("| (ninguno) | | | |");
out();
out(`Partes principales con carrera en minutos (en lugar de km): **${[...timedMain.values()].reduce((a, e) => a + e.count, 0)} sesiones** en ${timedMain.size} formatos distintos.`);
out();

// 4. Volumen e intensidad
out("## 4. Volumen e intensidad por plan");
out();
out("Km de ritmo exigente = minutos en Umbral, Intenso y Velocidad × velocidad del corredor modelo del capítulo.");
out();
out("| Plan | Distancia | Nivel | Días | Km/sem promedio | Km/sem pico | Calidad/sem promedio | Calidad/sem máx. | Km exigentes/sem |");
out("|---|---|---|---|---|---|---|---|---|");
for (const p of lib.plans) {
  const weekly = p.weeks.map((w) => w.totals.distance_km_est);
  const q = p.weeks.map((w) => w.days.filter(isSession).filter((d) => d.is_quality).length);
  const dem = p.weeks.map((w) => w.days.filter(isSession).reduce((a, d) => a + demandingKm(p, d), 0));
  out(
    `| ${p.id} | ${p.distance} | ${p.level} | ${p.days_per_week} | ${fmt1(averageWeeklyKm(p))} | ${fmt1(Math.max(...weekly))} | ${fmt1(q.reduce((a, b) => a + b, 0) / q.length)} | ${Math.max(...q)} | ${fmt1(dem.reduce((a, b) => a + b, 0) / dem.length)} |`,
  );
}
out();
out("### Comparación por distancia y nivel (promedio de los planes)");
out();
out("| Distancia | Nivel | Planes | Km/sem promedio | Calidad/sem | Km exigentes/sem |");
out("|---|---|---|---|---|---|");
const groups = new Map<string, LibraryPlan[]>();
for (const p of lib.plans) groups.set(`${p.distance}|${p.level}`, [...(groups.get(`${p.distance}|${p.level}`) ?? []), p]);
for (const [key, ps] of groups) {
  const [distance, level] = key.split("|");
  const avg = (f: (p: LibraryPlan) => number) => fmt1(ps.reduce((a, p) => a + f(p), 0) / ps.length);
  out(
    `| ${distance} | ${level} | ${ps.map((p) => p.id.replace("plan-", "")).join(", ")} | ${avg(averageWeeklyKm)} | ${avg((p) => p.weeks.reduce((a, w) => a + w.days.filter(isSession).filter((d) => d.is_quality).length, 0) / p.weeks.length)} | ${avg((p) => p.weeks.reduce((a, w) => a + w.days.filter(isSession).reduce((s, d) => s + demandingKm(p, d), 0), 0) / p.weeks.length)} |`,
  );
}
out();
out("### Km semanales por plan");
out();
for (const p of lib.plans) out(`- **${p.id}** (${p.distance} ${p.level}, ${p.days_per_week} días): ${p.weeks.map((w) => fmt1(w.totals.distance_km_est)).join(" · ")}`);
out();

const text = lines.join("\n") + "\n";
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  console.log(`Informe: ${outPath}`);
} else console.log(text);
