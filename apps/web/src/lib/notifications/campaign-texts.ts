/**
 * Correos de motivación (puros, para poder probarlos):
 * - invitación semanal a suscribirse para quienes no tienen suscripción;
 * - aliento cada 15 días para quienes están suscriptos.
 * Textos alegres y en voz neutra (sin suponer género). Cada envío rota entre varias versiones.
 */

export type CampaignKind = "invite" | "encourage";
export const CADENCE_DAYS: Record<CampaignKind, number> = { invite: 7, encourage: 14 };

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);

/** Qué correo le toca hoy a una persona (o ninguno). */
export function dueCampaign(c: { premium: boolean; last_invite: string | null; last_encourage: string | null }, today: string): CampaignKind | null {
  const kind: CampaignKind = c.premium ? "encourage" : "invite";
  const last = kind === "invite" ? c.last_invite : c.last_encourage;
  return !last || daysBetween(last, today) >= CADENCE_DAYS[kind] ? kind : null;
}

type Variant = { subject: string; title: string; body: string[]; cta: string };

const INVITES: Variant[] = [
  {
    subject: "¿Arrancamos esta semana? 🏃",
    title: "Tu próximo objetivo está más cerca de lo que pensás",
    body: [
      "Cada kilómetro suma, y con un plan suma mucho más.",
      "Con la suscripción a RUNNER 360 tenés tu plan completo semana a semana, los tiempos de cada pasada según tu test, y la fuerza para correr mejor.",
      "¿Damos el primer paso juntos?",
    ],
    cta: "Quiero suscribirme",
  },
  {
    subject: "Tu próxima carrera empieza hoy ✨",
    title: "Los 5K, los 10K o tu primera maratón: todo arranca con una decisión",
    body: [
      "No hace falta ser profesional para entrenar como uno: hace falta un buen plan y ganas (¡y eso ya lo tenés!).",
      "Suscribite y desbloqueá todas las semanas de tu plan, el registro de cada sesión y el seguimiento de tu progreso.",
    ],
    cta: "Ver la suscripción",
  },
  {
    subject: "Correr con un plan es otra cosa 💪",
    title: "Menos dudas, más kilómetros",
    body: [
      "Saber qué hacer cada día cambia todo: llegás con energía, progresás sin lesionarte y disfrutás cada salida.",
      "Con RUNNER 360 cada sesión te dice cuánto, a qué ritmo y cuándo descansar. Vos solo tenés que ponerte las zapatillas.",
    ],
    cta: "Empezar mi plan",
  },
  {
    subject: "Una semana más cerca de tu meta 🎯",
    title: "¿Y si esta semana es la semana?",
    body: [
      "Las mejores marcas no aparecen de casualidad: se construyen de a poco, con constancia y un plan pensado para vos.",
      "Suscribite a RUNNER 360 y entrená con planes diseñados por un licenciado en Ciencias del Entrenamiento.",
    ],
    cta: "Suscribirme",
  },
];

const ENCOURAGES: Variant[] = [
  {
    subject: "¡Seguís sumando! 💪",
    title: "Lo que hacés hoy es la carrera de mañana",
    body: [
      "Cada sesión que completás es un paso más hacia tu objetivo. Seguí así: la constancia es tu mejor entrenamiento.",
      "Acordate de completar el wellness antes de entrenar y de guardar tus tiempos al terminar: así ves cómo progresás.",
    ],
    cta: "Ver mi plan",
  },
  {
    subject: "Constancia que se nota ✨",
    title: "Dos semanas más de entrenamiento: ¡bien ahí!",
    body: [
      "Los días buenos se disfrutan y los difíciles también cuentan. Escuchá a tu cuerpo, respetá los descansos y seguí adelante.",
      "Tu plan de esta semana ya te está esperando.",
    ],
    cta: "Entrenar hoy",
  },
  {
    subject: "Tu plan te espera 🏃",
    title: "Vamos por la próxima sesión",
    body: [
      "Correr es mejor cuando tiene un propósito, y vos lo tenés. Mirá qué toca esta semana y salí a disfrutarlo.",
      "Si tenés una duda, Runnie está para ayudarte cuando quieras.",
    ],
    cta: "Ver qué toca hoy",
  },
  {
    subject: "Lo estás haciendo genial 🎉",
    title: "Gracias por entrenar con RUNNER 360",
    body: [
      "Cada kilómetro que corrés es un logro. Mirá tu progreso: seguro que ya se nota la diferencia.",
      "Seguí sumando semanas, que la meta está cada vez más cerca.",
    ],
    cta: "Ver mi progreso",
  },
];

const CTA_PATH: Record<CampaignKind, string[]> = {
  invite: ["/suscripcion", "/suscripcion", "/planes", "/suscripcion"],
  encourage: ["/plan", "/hoy", "/hoy", "/progreso"],
};

/** Versión que toca: rota según la cantidad de días desde 2026-01-05 (cada semana o cada 15 días). */
export function variantIndex(kind: CampaignKind, today: string): number {
  const n = Math.floor(daysBetween("2026-01-05", today) / CADENCE_DAYS[kind]);
  return ((n % 4) + 4) % 4;
}

const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

export function campaignEmail(input: { kind: CampaignKind; name: string | null; today: string; siteUrl: string; unsubscribeUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const i = variantIndex(input.kind, input.today);
  const v = (input.kind === "invite" ? INVITES : ENCOURAGES)[i]!;
  const link = `${input.siteUrl}${CTA_PATH[input.kind][i]}`;
  const hi = firstName(input.name) ? `¡Hola, ${firstName(input.name)}!` : "¡Hola!";
  const footer =
    input.kind === "invite"
      ? "Recibís este correo porque tenés una cuenta en RUNNER 360."
      : "Recibís este correo porque tenés una suscripción en RUNNER 360.";
  const text = [hi, "", v.title, "", ...v.body.flatMap((p) => [p, ""]), `${v.cta}: ${link}`, "", "—", footer, `Para dejar de recibir estos correos: ${input.unsubscribeUrl}`].join("\n");
  const html = `<!doctype html><html lang="es-AR"><body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#101c2c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#101c2c;padding:20px 28px;color:#18a999;font-weight:bold;font-size:18px;letter-spacing:.5px">RUNNER 360</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 8px;font-size:16px">${escape(hi)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escape(v.title)}</h1>
${v.body.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${escape(p)}</p>`).join("\n")}
<p style="margin:24px 0 8px"><a href="${escape(link)}" style="display:inline-block;background:#18a999;color:#101c2c;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:12px;font-size:16px">${escape(v.cta)}</a></p>
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #e3e8ef;font-size:12px;color:#5b6b80;line-height:1.5">
${escape(footer)} <a href="${escape(input.unsubscribeUrl)}" style="color:#0a7266">Dejar de recibir estos correos</a>.<br>RUNNER 360 · runner360.ar
</td></tr></table></td></tr></table></body></html>`;
  return { subject: v.subject, text, html };
}
