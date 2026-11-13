/**
 * Runnie responde solo, sin servicios externos (costo cero): reconoce de qué trata la pregunta y
 * arma la respuesta con la información de la app (las mismas preguntas frecuentes y explicaciones que
 * muestra la pantalla) y con los datos del plan de la persona. Funciones puras: se prueban en
 * test/runnie.test.ts.
 */
import { formatClock, paceForPct, rpeTable } from "@runner360/plan-library";
import { faq } from "@/i18n/es-AR/faq";
import { RPE_LABELS } from "@/lib/session-finish";
import { WELLNESS_ADVICE, type WellnessLevel } from "@/lib/wellness";
import { HISTORY_MAX_MESSAGES, MESSAGE_MAX_CHARS, type ChatTurn } from "./shared";

export type RunnieContext = {
  name: string | null;
  today: string;
  premium: boolean;
  plan: null | {
    title: string;
    distance: string;
    level: string;
    duration: string;
    daysPerWeek: number;
    startDate: string;
    raceDate: string | null;
    status: string;
    currentWeek: number | null;
    totalWeeks: number;
    openWeeks: number;
    /** Resumen de hoy ("Pasadas", "Descanso", "Plan en pausa"…). */
    today: string | null;
    /** Test vigente en texto ("3 km en 12:00 (cargado el …)") y en números. */
    test: string | null;
    testRaw: { meters: number; seconds: number } | null;
    /** La sesión de hoy, bloque por bloque, con los tiempos del test (null si hoy no corre). */
    session: string[] | null;
    /** La fuerza de hoy, con su dosis. */
    strength: string | null;
    /** Rutina de fuerza del plan (A, B o C). */
    routine: string | null;
    /** Lo que ya guardó hoy. */
    saved: string | null;
  };
  /** Wellness y sesiones (solo si dio el consentimiento de datos de salud). */
  health?: {
    wellnessToday: string | null;
    wellnessLevel: WellnessLevel | null;
    wellnessWeek: number | null;
    recent: string[];
    load: string | null;
  };
  /** Notas publicadas en Aprender. */
  articles?: { slug: string; title: string; summary: string | null }[];
};

/** Minúsculas, sin tildes ni signos: "¿Qué me toca HOY?" → "que me toca hoy". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const faqAnswer = (id: string) => faq.items.find((i) => i.id === id)?.answer ?? "";
const bullets = (lines: string[]) => lines.map((l) => `- ${l}`).join("\n");
const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

const SAFETY =
  "Si tenés dolor, una molestia que no se va, mareos, falta de aire fuera de lo normal o palpitaciones, pará y consultá a un profesional de la salud. Ante dolor en el pecho o un desmayo, andá a una guardia o llamá a emergencias. No sigas entrenando con dolor: es mejor perder un día que una temporada. Yo no puedo diagnosticar ni indicar tratamientos.";

const LOGGING = [
  "Abrí /hoy (o el día en /plan) y completá el wellness: son 5 preguntas rápidas.",
  "En cada trabajo de la sesión, al lado del tiempo prescripto, anotá tu tiempo (solo los números: los dos puntos se ponen solos) y confirmalo con el tilde. Si no anotás nada, se toma el tiempo prescripto.",
  "Al pie de la sesión elegí el RPE (cuánto te costó, de 1 a 10) y, si querés, tu frecuencia cardíaca media y máxima.",
  "Tocá Guardar. La distancia, la duración y los parciales se calculan solos y los ves en /progreso y en /entrenamientos.",
];

/** Qué puede preguntarle la persona (para cuando no entiendo la pregunta). */
const TOPICS = [
  "qué te toca entrenar hoy y a qué ritmo",
  "tu test y los porcentajes (Test/%)",
  "cómo anotar tus tiempos y guardar la sesión",
  "el wellness y el RPE",
  "la fuerza",
  "las pulsaciones",
  "el PDF de la semana",
  "tu plan, la semana gratis y la suscripción",
  "cómo instalar la app",
];

type Intent = { id: string; patterns: [RegExp, number][]; reply: (c: RunnieContext, q: string) => string };

function todayReply(c: RunnieContext): string {
  const p = c.plan;
  if (!p) return "Todavía no elegiste un plan. Elegí uno en /planes según tu distancia, tu nivel y los días que podés entrenar, y desde el lunes que elijas te muestro qué te toca cada día.";
  const parts: string[] = [];
  if (p.status === "paused") return `Tu plan está en pausa. ${p.today ?? ""} Cuando estés en condiciones, lo retomás desde /hoy.`.replace(/\s+/g, " ").trim();
  if (p.currentWeek === null) return `${p.today ?? "Hoy no tenés sesión del plan."} Mirá tu calendario en /plan.`;
  if (p.session?.length) {
    parts.push(`Hoy, semana ${p.currentWeek} de ${p.totalWeeks}, te toca: ${p.today ?? "una sesión de carrera"}.`, bullets(p.session));
    if (!p.test) parts.push("Si cargás tu test en /calculadora, te muestro el ritmo y el tiempo de cada trabajo.");
  } else {
    parts.push(`Hoy, semana ${p.currentWeek} de ${p.totalWeeks}: ${p.today ?? "no tenés sesión de carrera"}.`);
  }
  if (p.strength) parts.push(`Fuerza de hoy: ${p.strength}.`);
  if (p.saved) parts.push(`Ya guardaste la sesión de hoy (${p.saved}). ¡Bien ahí!`);
  else if (p.session?.length) parts.push("Antes de salir completá el wellness en /hoy y, al terminar, anotá tus tiempos y tocá Guardar.");
  if (p.today && /liberad|suscrib|bloque/i.test(p.today) && !c.premium) parts.push("Para ver las semanas siguientes del plan necesitás la suscripción: /suscripcion.");
  return parts.join("\n\n");
}

function paceReply(c: RunnieContext): string {
  const p = c.plan;
  const how =
    "Los porcentajes del plan son sobre la velocidad de tu test: el 100 % es el ritmo de tu test y un porcentaje más bajo es más lento. Cargás el test en /calculadora (la distancia y el tiempo que hiciste) y la app calcula sola el ritmo y el tiempo de cada trabajo.";
  if (!p) return `${how} Cuando elijas un plan en /planes, en cada sesión vas a ver esos tiempos.`;
  if (!p.test || !p.testRaw) return `${how} Todavía no tenés un test de las últimas 8 semanas, así que hoy no puedo darte tus tiempos exactos.`;
  const t = p.testRaw;
  const ref = [65, 70, 80, 90, 95, 100].map((pct) => `${pct} %: ${formatClock(Math.round(paceForPct(t, pct)))}/km`).join(" · ");
  const parts = [`Tu test: ${p.test}. Con eso, algunos ritmos de referencia: ${ref}.`];
  if (p.session?.length) parts.push("Hoy:", bullets(p.session));
  else parts.push("Hoy no tenés pasadas: los tiempos de cada sesión los ves en /plan y en /hoy.");
  return parts.join("\n\n");
}

function strengthReply(c: RunnieContext): string {
  const p = c.plan;
  const how =
    "Los planes tienen dos sesiones de fuerza por semana que se alternan. Cada una tiene 5 ejercicios: 3 de tren inferior (dos básicos, uno dominante de rodilla y otro de cadera, y un auxiliar) y 2 de tren superior (un empuje y una tracción). Siempre son 4 series por ejercicio, de 3 a 6 repeticiones según el momento del plan; la sesión 1 es la más pesada. Elegí un peso con el que te queden algunas repeticiones en reserva al terminar cada serie (las que todavía podrías hacer). En las semanas de descarga, la puesta a punto y la semana de la competencia se aliviana.";
  const parts = [how];
  if (p?.strength) parts.push(`Hoy te toca: ${p.strength}.`);
  else if (p?.routine) parts.push(`Tu plan usa la rutina ${p.routine}. Los ejercicios con su dosis de la semana los ves en el día que tiene fuerza, en /plan.`);
  parts.push("Aprendé la técnica con poco peso y, si nunca hiciste fuerza, conviene que alguien te guíe las primeras veces.");
  return parts.join("\n\n");
}

function wellnessReply(c: RunnieContext): string {
  const parts = [
    "El wellness es un cuestionario de 5 preguntas (sueño, energía, dolor muscular, estrés y ánimo), cada una de 1 (peor) a 5 (mejor). Aparece al abrir tu sesión del día y hay que completarlo para guardar la sesión. El total va de 5 a 25: 20 o más es muy bien, de 16 a 19 bien, de 12 a 15 regular y menos de 12 bajo.",
  ];
  const h = c.health;
  if (h?.wellnessToday && h.wellnessLevel) parts.push(`Tu wellness de hoy: ${h.wellnessToday}. ${WELLNESS_ADVICE[h.wellnessLevel]}`);
  else if (h) parts.push("Hoy todavía no lo completaste: lo hacés en /hoy.");
  if (h?.wellnessWeek) parts.push(`Tu promedio de los últimos 7 días es ${h.wellnessWeek.toLocaleString("es-AR")}.`);
  return parts.join("\n\n");
}

function progressReply(c: RunnieContext): string {
  const h = c.health;
  const parts: string[] = [];
  if (h?.recent.length) {
    if (h.load) parts.push(`${h.load}.`);
    parts.push("Tus últimas sesiones guardadas:", bullets(h.recent));
  } else if (h) {
    parts.push("No guardaste sesiones en las últimas 4 semanas. Cuando termines cada sesión, anotá tus tiempos y el RPE y tocá Guardar.");
  }
  parts.push("En /progreso ves tu wellness, la carga de cada sesión (RPE × minutos), la carga de la semana frente a tu promedio y los parciales; el historial completo está en /entrenamientos. Una suba brusca de la carga es una señal para ir con cuidado.");
  return parts.join("\n\n");
}

function planReply(c: RunnieContext): string {
  const p = c.plan;
  if (!p) return "Todavía no elegiste un plan. Los ves en /planes: hay de 5K, 10K, 21K y 42K, para distintos niveles, días por semana y duración. Empezás siempre un lunes y la primera semana es gratis.";
  const lines = [
    `Estás haciendo ${p.title} (${p.distance}, ${p.level}, ${p.duration}, ${p.daysPerWeek} días por semana), desde el ${p.startDate}.`,
    p.currentWeek ? `Vas por la semana ${p.currentWeek} de ${p.totalWeeks}.` : `El plan tiene ${p.totalWeeks} semanas.`,
    p.raceDate ? `Tu competencia está prevista para el ${p.raceDate}.` : "",
    p.openWeeks >= p.totalWeeks ? "Tenés todas las semanas liberadas." : `Tenés liberadas ${p.openWeeks} de ${p.totalWeeks} semanas${c.premium ? "" : "; para seguir después necesitás la suscripción (/suscripcion)"}.`,
    p.status === "paused" ? "El plan está en pausa." : "",
  ];
  return `${lines.filter(Boolean).join(" ")}\n\nEn /plan ves el calendario completo; desde ahí también podés mover días o descargar la semana en PDF.`;
}

function articleFor(q: string, articles: RunnieContext["articles"]): { slug: string; title: string } | null {
  const words = new Set(
    normalize(q)
      .split(" ")
      .filter((w) => w.length >= 5)
      .map((w) => w.slice(0, 5)),
  );
  if (!words.size || !articles?.length) return null;
  let best: { slug: string; title: string; score: number } | null = null;
  for (const a of articles) {
    const text = normalize(`${a.title} ${a.summary ?? ""}`)
      .split(" ")
      .map((w) => w.slice(0, 5));
    const score = new Set(text.filter((w) => words.has(w))).size;
    if (score >= 2 && (!best || score > best.score)) best = { slug: a.slug, title: a.title, score };
  }
  return best;
}

const INTENTS: Intent[] = [
  {
    id: "salud",
    patterns: [[/\b(me )?duel[ea]n?\b|\bdolor(es)?\b|\blesion|\bmareo|\bmareado|\bpecho\b|\bdesmay|\bpalpitac|\bfalta de aire|\bno puedo respirar|\btorc[ei]|\besguince|\bcontractura|\bfiebre|\benferm|\bmedicament|\bpastilla|\bantiinflamatori|\bdiagnost/, 6]],
    reply: () => SAFETY,
  },
  {
    id: "hoy",
    patterns: [
      [/\bhoy\b/, 2],
      [/\bme toca\b|\btoca\b/, 3],
      [/\bque (entreno|corro)\b/, 3],
      [/\bque hago\b/, 1],
      [/\bsesion\b|\bentrenamiento\b/, 1],
    ],
    reply: todayReply,
  },
  {
    id: "ritmo",
    patterns: [
      [/\britmo|\bpasadas?\b|\bparcial|\bvelocidad|\bporcentaje|\d+ ?%|\bpace\b|\ba que tiempo|\bcuanto tengo que tardar|\bque tiempo\b|\bcada km|\bpor km\b/, 3],
      [/\bseries\b|\bpasada\b|\bintervalo/, 1],
    ],
    reply: paceReply,
  },
  {
    id: "test",
    patterns: [[/\btest\b|\bcalculadora\b|\btest ?\/ ?%/, 4]],
    reply: (c) => {
      const mine = c.plan?.test ? `Tu test vigente: ${c.plan.test}.` : "Todavía no tenés un test de las últimas 8 semanas.";
      return `En /calculadora (Test/%) cargás tu test: la distancia y el tiempo que hiciste. La app calcula sola los parciales del 50 % al 100 % en 100, 150, 200, 300, 400, 500, 600, 700, 800, 1000, 1500, 2000, 3000 y 5000 m, y podés agregar otra distancia. El 100 % es el ritmo de tu test; el porcentaje es sobre la velocidad.\n\nEl plan usa el test para mostrarte el tiempo de cada trabajo mientras tenga menos de 8 semanas; después cargá uno nuevo. ${mine}`;
    },
  },
  {
    id: "registro",
    patterns: [
      [/\bregistr|\banot[oa]r?\b|\banoto\b|\bguard[oa]r?\b|\bguardo\b|\bfinaliz|\btermin[eo] (la |mi )?sesion|\btilde\b|\bcargar? (mis |los )?tiempos|\bcompletar? (mis |los )?tiempos/, 4],
    ],
    reply: () => `Así guardás tu sesión, todo en la misma pantalla:\n\n${bullets(LOGGING)}`,
  },
  {
    id: "wellness",
    patterns: [[/\bwellness\b|\bcuestionario|\bencuesta|\brecuperacion|\bcomo me siento|\bbienestar/, 4]],
    reply: wellnessReply,
  },
  {
    id: "rpe",
    patterns: [[/\brpe\b|\besfuerzo percibido|\bescala de esfuerzo|\bborg\b|\bque tan (duro|exigente)/, 4]],
    reply: () => {
      const scale = Object.entries(RPE_LABELS)
        .map(([n, l]) => `${n}: ${l.toLowerCase()}`)
        .join(" · ");
      const bands = rpeTable(50)
        .map((b) => `${b.range} → RPE ${b.rpe}`)
        .join(" · ");
      return `El RPE es cuánto te costó la sesión, de 1 a 10: ${scale}. Lo elegís al pie de la sesión antes de guardar, y con eso la app calcula la carga (RPE × minutos).\n\nEn el plan, cada porcentaje tiene un RPE esperado: ${bands}.`;
    },
  },
  {
    id: "pulsaciones",
    patterns: [[/\bpulsac|\bfrecuencia cardiaca|\bfc\b|\blatidos?\b|\bppm\b|\bpulso\b|\bcorazon/, 4]],
    reply: () =>
      "En /pulsaciones medís tus pulsaciones con el celular: subí el brillo de la pantalla al máximo y apoyá la yema del dedo sobre la cámara de adelante. La app cuenta tus latidos durante 6 segundos y los multiplica por 10. Es una estimación para entrenar, no un dato médico; lo ideal es medirlas en reposo, a la mañana.\n\nAl guardar una sesión también podés anotar tu frecuencia cardíaca media y máxima (por ejemplo, la de tu reloj).",
  },
  {
    id: "fuerza",
    patterns: [
      [/\bfuerza\b|\bgimnasio|\bgym\b|\bpesas?\b|\bsentadilla|\bpeso muerto|\bmusculacion|\brepeticiones en reserva|\ben reserva\b/, 4],
      [/\bejercicios?\b|\brutina\b|\brepeticion/, 2],
    ],
    reply: strengthReply,
  },
  {
    id: "pdf",
    patterns: [[/\bpdf\b|\bimprimi|\bimprimir|\bdescargar? (la |mi )?semana/, 4]],
    reply: () =>
      "Podés descargar tu semana en PDF para guardarla o imprimirla: en /plan, elegí la semana y tocá el botón de descarga (también está en /hoy). Sale con los días de entrenamiento tal como los ves en la pantalla.",
  },
  {
    id: "plan",
    patterns: [
      [/\bmi plan\b|\bque semana\b|\ben que semana|\bcuantas semanas|\bcuanto falta|\bfaltan?\b/, 3],
      [/\bliberad|\bsin semanas|\bse (me )?termin|\bbloquead|\bcandado|\bno puedo ver/, 4],
      [/\bsemana\b|\bplan\b/, 1],
    ],
    reply: planReply,
  },
  {
    id: "cambios",
    patterns: [[/\bcambi(ar|o)\b|\bmover\b|\bmuevo\b|\bpausa|\bpausar|\babandon|\botro plan|\bdias de la semana|\breprogram/, 3]],
    reply: () =>
      "En /plan tocá «Mover días» para cambiar en qué días de la semana entrenás (la competencia no se puede mover). Para empezar otro plan, primero abandoná el actual desde Mi plan (tu historial se conserva) y después elegí uno nuevo en /planes. El plan se pausa cuando el check-in semanal lo indica (por ejemplo, ante dolor), y lo retomás desde /hoy.",
  },
  {
    id: "gratis",
    patterns: [[/\bgratis\b|\bgratuit|\bsin pagar|\bsemana gratis|\bprimera semana|\bfree\b/, 4]],
    reply: () =>
      `${faqAnswer("gratis")} Elegís cualquier plan de /planes y tenés liberada la primera semana completa, día por día. Para seguir entrenando después, te suscribís en /suscripcion.`,
  },
  {
    id: "cobro",
    patterns: [[/\bcobr|\bdebit|\bmercado ?pago|\bpago\b|\bpagar\b|\btarjeta|\brenov|\brechaz/, 4]],
    reply: () =>
      `${faqAnswer("cobro")}\n\nCada débito mensual aprobado libera el mes siguiente del plan (4 semanas). Si un débito se rechaza, conservás el acceso 5 días mientras se reintenta el cobro: actualizá el medio de pago en Mercado Pago. Con el plan anual ves el plan completo desde el primer día y, al terminarlo, elegís otro sin volver a pagar; te avisamos 15 días antes de que venza. Los precios actuales están en /suscripcion.`,
  },
  {
    id: "cancelar",
    patterns: [[/\bcancel|\bdar de baja|\bdesuscrib|\bdejar de pagar/, 5]],
    reply: () => faqAnswer("cancelar"),
  },
  {
    id: "suscripcion",
    patterns: [[/\bsuscrip|\bsuscrib|\bpremium\b|\bplan anual|\bmensual\b|\banual\b/, 3]],
    reply: (c) =>
      `${c.premium ? "Tenés acceso pago activo." : "Hoy usás el plan gratis."} Con la suscripción mensual (débito automático por Mercado Pago) se libera cada mes del plan, y con el plan anual (un pago por 12 meses) lo ves completo desde el primer día. Las dos suman Hidratación y Competencias. Precios y detalles en /suscripcion.`,
  },
  {
    id: "disenio",
    patterns: [[/\bquien (disena|diseno|arma|armo|hace|hizo|crea|creo) (los |el )?plan|\blicenciad|\bquien esta detras|\bautor\b/, 5]],
    reply: () => faqAnswer("quien-disena"),
  },
  {
    id: "experiencia",
    patterns: [[/\bexperiencia\b|\bprincipiante|\bdesde cero|\bnunca corri|\bempezar a correr|\barrancar a correr|\bpor donde empiezo/, 4]],
    reply: () => `${faqAnswer("experiencia-previa")} Mirá los planes en /planes y fijate el perfil de corredor de cada uno.`,
  },
  {
    id: "entrenador",
    patterns: [[/\breemplaz\w* (a )?(un |mi )?entrenador|\bnecesito (un )?entrenador|\bentrenador personal/, 5]],
    reply: () => faqAnswer("reemplaza-entrenador"),
  },
  {
    id: "instalar",
    patterns: [[/\binstal|\bdescargar? la app|\bbajar la app|\biphone|\bandroid|\bplay ?store|\bapp ?store|\bpantalla de inicio|\bicono/, 4]],
    reply: () =>
      "RUNNER 360 se instala desde el navegador. En iPhone: abrí runner360.ar en Safari, tocá Compartir y después «Agregar a inicio» (si la abriste desde Instagram u otra app, primero abrila en Safari). En Android: desde Chrome, menú ⋮ → «Instalar app». Los pasos con imágenes están en /instalar.",
  },
  {
    id: "correos",
    patterns: [[/\bmails?\b|\bcorreos?\b|\bemails?\b|\bnewsletter|\bspam\b/, 4]],
    reply: () =>
      "La app manda un correo de aliento cada 15 días a quienes están suscriptos y una invitación semanal a quienes no lo están. Para dejar de recibirlos, desactivalos en /perfil (sección Correos) o tocá el enlace que viene al pie de cada correo.",
  },
  {
    id: "hidratacion",
    patterns: [[/\bhidrat|\bagua\b|\bliquido|\bbebida|\bisotonic|\bsudor/, 4]],
    reply: () =>
      "En /hidratacion (con suscripción) llevás el seguimiento de tu hidratación y tenés recomendaciones, y en /aprender hay notas sobre el tema. Si tenés una condición de salud o dudas sobre suplementos, consultalo con un profesional.",
  },
  {
    id: "progreso",
    patterns: [[/\bprogreso|\bcarga\b|\bcomo vengo|\bestadistic|\bhistorial|\bmejorando|\bavance\b|\bmis sesiones/, 4]],
    reply: progressReply,
  },
  {
    id: "carrera",
    patterns: [[/\bdia (antes|previo)|\bantes de (la )?(carrera|competencia)|\bdia de (la )?(carrera|competencia)|\bcompetir\b|\bpuesta a punto|\btaper/, 4]],
    reply: (c) =>
      `Las últimas semanas del plan son de puesta a punto: baja el volumen para que llegues descansado, y la fuerza se aliviana. El día de la competencia, no estrenes nada (ni zapatillas, ni ropa, ni comida) y largá controlado, sin pasarte del ritmo que entrenaste.${c.plan?.raceDate ? ` Tu competencia está prevista para el ${c.plan.raceDate}.` : ""} En /competencias (con suscripción) cargás tus carreras y ves tus tiempos objetivo.`,
  },
  {
    id: "suave",
    patterns: [[/\btrote suave|\brodaje|\bsuave\b|\bregenerativ|\bbase aerobica|\bfondo\b/, 3]],
    reply: (c) => {
      const t = c.plan?.testRaw;
      const pace = t ? ` Con tu test, el 70 % es ${formatClock(Math.round(paceForPct(t, 70)))}/km.` : " Si cargás tu test en /calculadora, te digo a qué ritmo es para vos.";
      return `El trote suave es cómodo: podés hablar en frases completas mientras corrés. En el plan son los tramos con porcentajes bajos (por ejemplo 65 o 70 %, RPE 3 a 5).${pace} Respetar los días suaves es lo que te permite llegar bien a los días intensos.`;
    },
  },
  {
    id: "calentar",
    patterns: [[/\bcalentamiento|\bentrada en calor|\bcalentar|\bvuelta a la calma|\belongac|\bestir|\bmovilidad/, 4]],
    reply: () =>
      "Cada sesión del plan trae su entrada en calor (trote suave y movilidad, a veces con algunas aceleraciones cortas) y su vuelta a la calma (trote o caminata suave). Hacelas siempre: preparan el cuerpo para el trabajo principal y ayudan a recuperar. Los tiempos y porcentajes de cada una están en tu sesión en /hoy.",
  },
  {
    id: "descanso",
    patterns: [[/\bdescans|\bdia libre|\bentrenar todos los dias|\bdescanso activo/, 4]],
    reply: () =>
      "Los días de descanso son parte del plan: el cuerpo se adapta al entrenamiento mientras se recupera. Respetalos aunque te sientas bien. Si un día tenés la recuperación baja en el wellness, bajá la intensidad o acortá la sesión. Si perdiste una sesión, no la recuperes al día siguiente: seguí con la próxima del plan (y si era una de calidad, hacé la siguiente, no las dos juntas).",
  },
  {
    id: "manana",
    patterns: [[/\bmanana\b|\bpasado manana|\bresto de la semana|\bproxima sesion|\bproximo entrenamiento|\besta semana\b/, 4]],
    reply: (c) =>
      c.plan
        ? "Lo que te toca mañana y el resto de la semana lo ves en /plan, día por día, con los tiempos de cada trabajo. Desde ahí también podés descargar la semana en PDF."
        : "Todavía no elegiste un plan. Elegí uno en /planes y vas a ver tu semana día por día en /plan.",
  },
  {
    id: "precio",
    patterns: [[/\bprecio|\bcuesta\b|\bcuanto sale|\bcuanto vale|\bvalor\b|\bcuanto pago|\bcuanto cobran/, 5]],
    reply: () =>
      "Los precios actuales de la suscripción mensual y del plan anual están siempre actualizados en /suscripcion. Se pagan por débito automático a través de Mercado Pago (el anual, en un solo pago por 12 meses). La primera semana de cualquier plan es gratis.",
  },
  {
    id: "fatiga",
    patterns: [[/\bcansad|\bagotad|\bfatiga|\bsin energia|\bpoca energia|\bdormi mal|\bno dormi|\bpoco sueno|\bestresad|\bsin ganas|\bentreno igual|\bdesganad/, 5]],
    reply: (c) => {
      const h = c.health;
      const parts = [
        h?.wellnessToday && h.wellnessLevel
          ? `Tu wellness de hoy: ${h.wellnessToday}. ${WELLNESS_ADVICE[h.wellnessLevel]}`
          : `Completá el wellness de hoy en /hoy: te ayuda a decidir. Como guía: ${WELLNESS_ADVICE.fair.charAt(0).toLowerCase()}${WELLNESS_ADVICE.fair.slice(1)} ${WELLNESS_ADVICE.low}`,
        "Escuchar al cuerpo también es entrenar: un día más suave no arruina el plan, y el cansancio que se arrastra varios días es una señal para descansar.",
      ];
      if (c.plan?.today && c.plan.currentWeek) parts.push(`Hoy te toca: ${c.plan.today}.`);
      return parts.join("\n\n");
    },
  },
  {
    id: "mejorar",
    patterns: [[/\bmas rapido|\bmejorar|\bbajar (mi |el )?tiempo|\bmi marca|\bprogresar|\brendir mas|\bser mas veloz/, 4]],
    reply: (c) =>
      `La mejora viene de la constancia: seguir el plan semana a semana, respetar los días suaves y los descansos, hacer las sesiones de fuerza y dormir bien. Los días intensos rinden más cuando los suaves son realmente suaves.\n\nCuando pasen 8 semanas de tu test, cargá uno nuevo en /calculadora: así tus ritmos se actualizan con tu nivel de hoy.${c.plan ? "" : " Si todavía no elegiste un plan, empezá por /planes."}`,
  },
  {
    id: "sesiones",
    patterns: [[/\bfartlek|\bintervalo|\bcambios de ritmo|\bque significa|\bque quiere decir|\bcomo (leo|se lee|entiendo) (la |mi )?sesion|\bpausa (trotando|caminando)|\bentrada en calor y/, 4]],
    reply: () =>
      "Cada sesión tiene entrada en calor, parte principal y vuelta a la calma. Por ejemplo, «4 × 1000 m al 95 %, pausa 2 min trotando» significa: 4 repeticiones de 1000 m al 95 % de la velocidad de tu test, con 2 minutos de trote suave entre cada una. «15 min al 70 %» es correr 15 minutos a ese porcentaje. Si cargaste tu test, al lado de cada trabajo ves el ritmo y el tiempo que tenés que hacer.",
  },
  {
    id: "elegir",
    patterns: [
      [/\bque plan (elijo|me conviene|hago)|\bcual plan|\bque plan es mejor|\belegir (un )?plan|\bplanes? (de|para) (5|10|21|42)|\bmaraton|\b(5|10|21|42) ?k\b/, 4],
    ],
    reply: () =>
      "Hay planes de 5K, 10K, 21K (media maratón) y 42K (maratón), para distintos niveles, días por semana y duración. En /planes, cada uno muestra para quién es (perfil del corredor), qué necesitás para empezarlo y cuántos días por semana entrenás. Elegí el que corresponde a tu nivel de hoy, no al que te gustaría tener: es la forma de progresar sin lesionarte.",
  },
  {
    id: "quien",
    patterns: [[/\bquien sos|\bque sos\b|\bsos (un |una )?(robot|ia|bot|persona|humano)|\binteligencia artificial|\bcomo funcionas|\bcomo te llamas/, 5]],
    reply: () =>
      "Soy Runnie, el asistente de RUNNER 360. Respondo con la información de la app y de tu plan: lo que te toca hoy, tus ritmos, cómo guardar tus sesiones y tus dudas sobre la app. No reemplazo a un entrenador ni a un profesional de la salud.",
  },
  {
    id: "gracias",
    patterns: [[/^(muchas )?gracias\b|\bgenial\b|\bbarbaro\b|\bjoya\b|\bperfecto\b|\bbuenisimo\b/, 2]],
    reply: () => "¡De nada! Cualquier otra duda, acá estoy. ¡A disfrutar el entrenamiento!",
  },
  {
    id: "saludo",
    patterns: [[/^(hola|buen dia|buenos dias|buenas( tardes| noches)?|hey|que tal|como estas)\b/, 2]],
    reply: (c) => {
      const n = firstName(c.name);
      return `¡Hola${n ? `, ${n}` : ""}! Soy Runnie. Preguntame por ejemplo:\n\n${bullets(TOPICS.slice(0, 5))}`;
    },
  },
];

/** Puntaje de cada tema para la pregunta (para las pruebas y para elegir la respuesta). */
export function scoreIntents(question: string): { id: string; score: number }[] {
  const q = normalize(question);
  return INTENTS.map((i) => ({ id: i.id, score: i.patterns.reduce((s, [re, w]) => s + (re.test(q) ? w : 0), 0) })).sort((a, b) => b.score - a.score);
}

const MIN_SCORE = 2;

/** La respuesta de Runnie a la última pregunta de la persona. */
export function answer(question: string, c: RunnieContext): string {
  const scores = scoreIntents(question);
  const top = scores[0]!;
  const byId = (id: string) => INTENTS.find((i) => i.id === id)!;
  const article = articleFor(question, c.articles);
  const more = article ? `\n\nEn Aprender hay una nota que te puede servir: «${article.title}» /aprender/${article.slug}` : "";
  if (top.score < MIN_SCORE) {
    return `No estoy seguro de haber entendido.${article ? "" : " Puedo ayudarte con:"}${article ? more : `\n\n${bullets(TOPICS)}`}\n\nSi es otra cosa, escribinos al correo de contacto que está al pie de runner360.ar.`;
  }
  // Ante una señal de salud, primero el aviso; si además preguntó otra cosa, se responde después.
  if (top.id === "salud") {
    const next = scores.find((s) => s.id !== "salud" && s.score >= 3);
    return next ? `${SAFETY}\n\n${byId(next.id).reply(c, question)}` : SAFETY;
  }
  const reply = byId(top.id).reply(c, question);
  return `${reply}${top.id === "saludo" || top.id === "gracias" ? "" : more}`;
}

/**
 * Limpia la conversación que manda el navegador: solo turnos válidos, los últimos
 * HISTORY_MAX_MESSAGES, recortados a MESSAGE_MAX_CHARS, empezando por la persona y terminando
 * con su pregunta nueva. null si no hay una pregunta válida.
 */
export function sanitizeHistory(input: unknown): ChatTurn[] | null {
  if (!Array.isArray(input)) return null;
  const turns: ChatTurn[] = [];
  for (const raw of input.slice(-HISTORY_MAX_MESSAGES * 2)) {
    if (!raw || typeof raw !== "object") continue;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, MESSAGE_MAX_CHARS);
    if (!text) continue;
    // Dos turnos seguidos del mismo lado: se queda el último.
    if (turns.at(-1)?.role === role) turns.pop();
    turns.push({ role, content: text });
  }
  const recent = turns.slice(-HISTORY_MAX_MESSAGES);
  while (recent.length && recent[0]!.role !== "user") recent.shift();
  if (!recent.length || recent.at(-1)!.role !== "user") return null;
  return recent;
}
