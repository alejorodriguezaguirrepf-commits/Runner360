import { createHash } from "node:crypto";
import { checkInvariants, isSession, raceWeekOf } from "./invariants";
import { librarySchema, type Library } from "./schema";

/**
 * Importación de la biblioteca (solo servidor / CLI: usa node:crypto).
 * Flujo: JSON → esquema estricto → invariantes → SQL idempotente.
 */

export class LibraryValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`La biblioteca de planes no es válida (${problems.length} problema(s)):\n- ${problems.slice(0, 50).join("\n- ")}`);
    this.name = "LibraryValidationError";
  }
}

/** Huella del contenido: independiente de espacios y saltos de línea del archivo. */
export function libraryChecksum(raw: unknown): string {
  return createHash("sha256").update(JSON.stringify(raw)).digest("hex");
}

/** JSON canónico (claves ordenadas): la huella no depende del orden de las claves ni del formato. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Huella de un plan (todo su contenido). Sirve para comprobar que un plan no cambió entre versiones. */
export function planHash(plan: unknown): string {
  return createHash("sha256").update(canonical(plan)).digest("hex");
}

/** Valida forma e invariantes. Lanza LibraryValidationError con todos los problemas encontrados. */
export function parseLibrary(raw: unknown): { library: Library; checksum: string } {
  const parsed = librarySchema.safeParse(raw);
  if (!parsed.success) {
    throw new LibraryValidationError(parsed.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`));
  }
  const problems = checkInvariants(parsed.data);
  if (problems.length > 0) throw new LibraryValidationError(problems);
  return { library: parsed.data, checksum: libraryChecksum(raw) };
}

// ---------------------------------------------------------------- SQL
export type SqlValue = string | number | boolean | null | { json: unknown };

function lit(v: SqlValue): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`Número inválido: ${v}`);
    return String(v);
  }
  if (typeof v === "string") return `'${v.replaceAll("'", "''")}'`;
  return `'${JSON.stringify(v.json).replaceAll("'", "''")}'::jsonb`;
}

function inserts(table: string, columns: string[], rows: SqlValue[][], conflict: string, chunk = 200): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const values = rows
      .slice(i, i + chunk)
      .map((r) => `(${r.map(lit).join(", ")})`)
      .join(",\n  ");
    out.push(`insert into public.${table} (${columns.join(", ")}) values\n  ${values}\non conflict (${conflict}) do nothing;`);
  }
  return out;
}

export type TableSpec = { table: string; columns: string[]; rows: SqlValue[][]; conflict: string };

/** Filas a importar por tabla, en orden de dependencias. Lo usan el SQL y la sincronización por API. */
export function libraryTables(library: Library, checksum: string): TableSpec[] {
  const v = library.content_version;
  return [
    {
      table: "library_versions",
      columns: [
        "content_version", "schema_version", "language", "checksum", "source", "model_runner_assumptions", "category_legend",
        "zone_map", "load_monitoring", "practical_rules", "safety", "individual_adaptation", "glossary", "bibliography",
      ],
      rows: [[
        v, library.schema_version, library.language, checksum, { json: library.source }, { json: library.model_runner_assumptions },
        { json: library.category_legend }, { json: library.zone_map }, { json: library.load_monitoring }, { json: library.practical_rules },
        { json: library.safety }, { json: library.individual_adaptation }, { json: library.glossary }, { json: library.references },
      ]],
      conflict: "content_version",
    },
    {
      table: "library_intensities",
      columns: ["content_version", "position", "name", "zone", "rpe", "talk_test", "feel", "use_for"],
      rows: library.intensity_scale.map((i, n) => [v, n + 1, i.name, i.zone, i.rpe, i.talk_test, i.feel, i.use]),
      conflict: "content_version, name",
    },
    {
      table: "library_session_types",
      columns: ["content_version", "position", "code", "name", "description", "purpose"],
      rows: library.session_catalog.map((t, n) => [v, n + 1, t.code, t.name, t.description, t.purpose]),
      conflict: "content_version, code",
    },
    {
      table: "library_strength_exercises",
      columns: ["content_version", "routine", "position", "exercise", "target", "sets_reps"],
      rows: (["A", "B", "C"] as const).flatMap((r) => library.strength_routines[r].map((e, n): SqlValue[] => [v, r, n + 1, e.exercise, e.target, e.sets_reps])),
      conflict: "content_version, routine, position",
    },
    {
      table: "library_plans",
      columns: [
        "content_version", "id", "number", "chapter", "distance_label", "distance_km", "level", "duration_label", "duration_weeks",
        "days_per_week", "race_week", "title", "runner_profile", "entry_requirements", "min_weekly_km", "main_goal", "secondary_goals",
        "strength_routine", "weekly_template", "phases", "notes", "validation",
      ],
      rows: library.plans.map((p) => [
        v, p.id, p.number, p.chapter, p.distance, p.distance_km, p.level, p.duration_label, p.duration_weeks, p.days_per_week,
        raceWeekOf(p), p.title, p.runner_profile, { json: p.entry_requirements }, p.min_weekly_km, p.main_goal, { json: p.secondary_goals },
        p.strength_routine, p.weekly_template, { json: p.phases }, { json: p.notes }, { json: p.validation },
      ]),
      conflict: "content_version, id",
    },
    {
      table: "library_weeks",
      columns: [
        "content_version", "plan_id", "week", "phase", "week_type", "week_type_label", "weekly_goal", "progression_criterion",
        "distance_km_est", "duration_min_est", "running_sessions", "strength_sessions", "zone_pct", "includes_race",
      ],
      rows: library.plans.flatMap((p) =>
        p.weeks.map((w): SqlValue[] => [
          v, p.id, w.week, w.phase, w.week_type, w.week_type_label, w.weekly_goal, w.progression_criterion, w.totals.distance_km_est,
          w.totals.duration_min_est, w.totals.running_sessions, w.totals.strength_sessions, { json: w.totals.zone_pct }, w.totals.includes_race,
        ]),
      ),
      conflict: "content_version, plan_id, week",
    },
    {
      table: "library_days",
      columns: [
        "content_version", "plan_id", "week", "day_index", "day_label", "is_rest", "strength_only", "code", "session_type", "category",
        "short_label", "physiological_goal", "warmup", "main_set", "cooldown", "duration_min_est", "distance_km_est", "intensity",
        "technical_notes", "strength_after", "is_quality", "minutes_by_intensity",
      ],
      rows: library.plans.flatMap((p) =>
        p.weeks.flatMap((w) =>
          w.days.map((d): SqlValue[] =>
            isSession(d)
              ? [
                  v, p.id, w.week, d.day_index, d.day, false, false, d.code, d.type, d.category, d.short_label, d.physiological_goal,
                  d.warmup, d.main_set, d.cooldown, d.duration_min_est, d.distance_km_est, d.intensity, d.technical_notes,
                  d.strength_after, d.is_quality, { json: d.minutes_by_intensity },
                ]
              : [v, p.id, w.week, d.day_index, d.day, true, d.strength_only, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
          ),
        ),
      ),
      conflict: "content_version, plan_id, week, day_index",
    },
  ];
}

/** Fila como objeto para la API (los jsonb van como objetos). */
export function rowObject(spec: TableSpec, row: SqlValue[]): Record<string, unknown> {
  return Object.fromEntries(spec.columns.map((c, i) => {
    const v = row[i]!;
    return [c, v !== null && typeof v === "object" ? v.json : v];
  }));
}

/**
 * SQL de importación SIN begin/commit (quien lo ejecuta abre la transacción).
 * Idempotente: si la content_version ya existe con la misma huella no cambia nada; si existe con
 * otra huella, aborta (el contenido de una versión es inmutable: hay que subir content_version).
 * Las inscripciones existentes no se tocan: quedan en su versión.
 */
export function buildImportSql(library: Library, checksum: string): string {
  const v = library.content_version;
  const s: string[] = [];

  s.push(`-- Biblioteca de planes ${v} (huella ${checksum})`);
  s.push(
    `do $guard$\nbegin\n  if exists (select 1 from public.library_versions where content_version = ${lit(v)} and checksum <> ${lit(checksum)}) then\n` +
      `    raise exception 'La content_version % ya fue importada con otro contenido: subí content_version en el JSON', ${lit(v)};\n` +
      `  end if;\nend\n$guard$;`,
  );
  for (const t of libraryTables(library, checksum)) s.push(...inserts(t.table, t.columns, t.rows, t.conflict));

  // La versión importada pasa a ser la vigente (en dos pasos: el índice único no admite dos vigentes).
  s.push(`update public.library_versions set is_current = false where is_current and content_version <> ${lit(v)};`);
  s.push(`update public.library_versions set is_current = true where content_version = ${lit(v)} and not is_current;`);
  return s.join("\n\n") + "\n";
}
