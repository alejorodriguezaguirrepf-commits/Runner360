// Informe antes/después entre dos versiones de la biblioteca: volumen semanal por plan, sesiones de
// calidad y ejemplos de sesiones modificadas.
// Uso: pnpm --filter @runner360/plan-library compare <json anterior> [json nuevo] [informe.md]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isSession } from "../src/invariants";
import { averageWeeklyKm, checkQualityRules, repeatedQuality } from "../src/quality-rules";
import { librarySchema, type Library, type LibraryPlan, type LibrarySessionDay } from "../src/schema";
import { LIBRARY_JSON } from "./paths";

const [beforePath, afterPath = LIBRARY_JSON, outPath] = process.argv.slice(2);
if (!beforePath) throw new Error("Uso: compare-plans.ts <json anterior> [json nuevo] [informe.md]");
const read = (p: string): Library => librarySchema.parse(JSON.parse(readFileSync(p, "utf8")));
const before = read(beforePath);
const after = read(afterPath);

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");
const quality = (p: LibraryPlan) => p.weeks.map((w) => w.days.filter((d) => isSession(d) && d.is_quality).length);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (a: number, b: number) => `${b >= a ? "+" : ""}${Math.round((b / a - 1) * 100)} %`;

const lines: string[] = [];
const out = (s = "") => lines.push(s);

out(`# Planes: antes (${before.content_version}) y después (${after.content_version})`);
out();
out("Generado por `packages/plan-library/scripts/compare-plans.ts`. Km estimados con el corredor modelo de cada capítulo.");
out();
const problemsBefore = checkQualityRules(before).length;
const problemsAfter = checkQualityRules(after).length;
out(`Problemas que detecta el validador (\`checkQualityRules\`): **${problemsBefore}** antes → **${problemsAfter}** después.`);
out();

out("## 1. Volumen semanal y sesiones de calidad por plan");
out();
out("| Plan | Distancia · nivel · días | Km/sem antes | Km/sem después | Cambio | Pico antes → después | Calidad/sem antes → después | Máx. calidad/sem |");
out("|---|---|---|---|---|---|---|---|");
for (const b of before.plans) {
  const a = after.plans.find((p) => p.id === b.id)!;
  const pb = Math.max(...b.weeks.map((w) => w.totals.distance_km_est));
  const pa = Math.max(...a.weeks.map((w) => w.totals.distance_km_est));
  out(
    `| ${b.id} | ${b.distance} · ${b.level} · ${b.days_per_week} | ${fmt1(averageWeeklyKm(b))} | ${fmt1(averageWeeklyKm(a))} | ${pct(averageWeeklyKm(b), averageWeeklyKm(a))} | ${fmt1(pb)} → ${fmt1(pa)} | ${fmt1(avg(quality(b)))} → ${fmt1(avg(quality(a)))} | ${Math.max(...quality(b))} → ${Math.max(...quality(a))} |`,
  );
}
out();

out("### Promedio por distancia y nivel");
out();
out("| Distancia | Nivel | Km/sem antes | Km/sem después |");
out("|---|---|---|---|");
const groups = new Map<string, string[]>();
for (const p of before.plans) groups.set(`${p.distance}|${p.level}`, [...(groups.get(`${p.distance}|${p.level}`) ?? []), p.id]);
for (const [key, ids] of groups) {
  const [distance, level] = key.split("|");
  const m = (lib: Library) => avg(ids.map((id) => averageWeeklyKm(lib.plans.find((p) => p.id === id)!)));
  out(`| ${distance} | ${level} | ${fmt1(m(before))} | ${fmt1(m(after))} |`);
}
out();

out("### Km semanales por plan (antes → después)");
out();
for (const b of before.plans) {
  const a = after.plans.find((p) => p.id === b.id)!;
  out(`- **${b.id}** (${b.distance} ${b.level}, ${b.days_per_week} días)`);
  out(`  - antes: ${b.weeks.map((w) => fmt1(w.totals.distance_km_est)).join(" · ")}`);
  out(`  - después: ${a.weeks.map((w) => fmt1(w.totals.distance_km_est)).join(" · ")}`);
}
out();

out("## 2. Sesiones que se repetían igual a la semana anterior");
out();
out("| Plan | Semana | Antes (igual a la semana anterior) | Después (semana anterior → esta) |");
out("|---|---|---|---|");
const keyOf = (p: LibraryPlan, week: number, mainSet: string) => {
  const w = p.weeks[week - 1]!;
  return w.days.findIndex((d) => isSession(d) && d.main_set === mainSet);
};
for (const b of before.plans)
  for (const r of repeatedQuality(b)) {
    const a = after.plans.find((p) => p.id === b.id)!;
    const i = keyOf(b, r.week, r.mainSet);
    const now = a.weeks[r.week - 1]!.days[i] as LibrarySessionDay;
    const prevIdx = keyOf(b, r.week - 1, r.mainSet);
    const prev = a.weeks[r.week - 2]!.days[prevIdx] as LibrarySessionDay;
    out(`| ${b.id} | ${r.week} | ${r.mainSet} | ${prev.main_set} → **${now.main_set}** |`);
  }
out();

out("## 3. Ejemplos de sesiones modificadas");
out();
const examples: { plan: string; week: number; code: string; from: string; to: string }[] = [];
const seen = new Set<string>();
for (const b of before.plans) {
  const a = after.plans.find((p) => p.id === b.id)!;
  b.weeks.forEach((w, wi) =>
    w.days.forEach((d, di) => {
      const n = a.weeks[wi]!.days[di]!;
      if (!isSession(d) || !isSession(n) || d.main_set === n.main_set) return;
      const key = `${b.chapter}|${n.code}|${d.main_set.replace(/\d+([.,]\d+)?/g, "N")}`;
      if (seen.has(key)) return;
      seen.add(key);
      examples.push({ plan: b.id, week: w.week, code: d.code === n.code ? d.code : `${d.code} → ${n.code}`, from: d.main_set, to: n.main_set });
    }),
  );
}
out("| Plan | Semana | Sesión | Antes | Después |");
out("|---|---|---|---|---|");
for (const e of examples) out(`| ${e.plan} | ${e.week} | ${e.code} | ${e.from} | ${e.to} |`);
out();

const text = lines.join("\n") + "\n";
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  console.log(`Informe: ${outPath}`);
} else console.log(text);
