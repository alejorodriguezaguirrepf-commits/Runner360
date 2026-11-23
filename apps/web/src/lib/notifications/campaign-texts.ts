/**
 * Correos de motivación (puros, para poder probarlos):
 * - invitación semanal a suscribirse para quienes no tienen suscripción;
 * - aliento cada 15 días para quienes están suscriptos;
 * - felicitación el día del cumpleaños.
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

/** Asunto de la invitación semanal a suscribirse (siempre el mismo). */
export const INVITE_SUBJECT = "SUSCRIPCIÓN A RUNNER 360";

const INVITES: Variant[] = [
  {
    subject: INVITE_SUBJECT,
    title: "Tu próximo objetivo está más cerca de lo que pensás",
    body: [
      "Cada kilómetro suma, y con un plan suma mucho más.",
      "Con la suscripción a RUNNER 360 tenés tu plan completo semana a semana, los tiempos de cada pasada según tu test, y la fuerza para correr mejor.",
      "¿Damos el primer paso juntos?",
    ],
    cta: "Quiero suscribirme",
  },
  {
    subject: INVITE_SUBJECT,
    title: "Los 5K, los 10K o tu primera maratón: todo arranca con una decisión",
    body: [
      "No hace falta ser profesional para entrenar como uno: hace falta un buen plan y ganas (¡y eso ya lo tenés!).",
      "Suscribite y desbloqueá todas las semanas de tu plan, el registro de cada sesión y el seguimiento de tu progreso.",
    ],
    cta: "Ver la suscripción",
  },
  {
    subject: INVITE_SUBJECT,
    title: "Menos dudas, más kilómetros",
    body: [
      "Saber qué hacer cada día cambia todo: llegás con energía, progresás sin lesionarte y disfrutás cada salida.",
      "Con RUNNER 360 cada sesión te dice cuánto, a qué ritmo y cuándo descansar. Vos solo tenés que ponerte las zapatillas.",
    ],
    cta: "Empezar mi plan",
  },
  {
    subject: INVITE_SUBJECT,
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

type Rendered = { subject: string; text: string; html: string };

/**
 * Precios y links de pago de la invitación (el link lleva directo a Mercado Pago, sin iniciar sesión).
 * Precios como se muestran en la app ("$ 25.000"); `savings`: ahorro del anual ("$ 50.000").
 */
export type InviteOffer = {
  monthly: { price: string; payUrl: string };
  yearly: { price: string; payUrl: string; savings: string | null };
  loginUrl: string;
};

/** Bloque principal de la invitación: los dos planes con su botón de pago. */
function offerHtml(o: InviteOffer): string {
  const card = (name: string, price: string, period: string, note: string, url: string, cta: string, primary: boolean) =>
    `<td width="50%" valign="top" style="padding:6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${primary ? "#18a999" : "#e3e8ef"};border-radius:14px"><tr><td style="padding:18px 16px;text-align:center">
<p style="margin:0;font-size:13px;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;color:#5b6b80">${escape(name)}</p>
<p style="margin:8px 0 2px;font-size:24px;font-weight:bold;color:#101c2c;white-space:nowrap">${escape(price)}</p>
<p style="margin:0 0 6px;font-size:13px;color:#5b6b80">${escape(period)}</p>
<p style="margin:0 0 14px;font-size:13px;line-height:1.4;color:#101c2c;min-height:36px">${escape(note)}</p>
<a href="${escape(url)}" style="display:block;background:${primary ? "#18a999" : "#101c2c"};color:${primary ? "#101c2c" : "#ffffff"};text-decoration:none;font-weight:bold;padding:13px 10px;border-radius:12px;font-size:15px">${escape(cta)}</a>
</td></tr></table></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px"><tr>
${card("Plan mensual", o.monthly.price, "por mes", "Débito automático. Cancelás cuando quieras.", o.monthly.payUrl, "Pagar el mensual", true)}
${card("Plan anual", o.yearly.price, "por año, en un pago", o.yearly.savings ? `Ahorrás ${o.yearly.savings} frente a 12 meses.` : "Tu plan completo desde el primer día.", o.yearly.payUrl, "Pagar el anual", false)}
</tr></table>`;
}

function offerText(o: InviteOffer): string[] {
  return [
    `Plan mensual: ${o.monthly.price} por mes (débito automático, cancelás cuando quieras). Pagar: ${o.monthly.payUrl}`,
    `Plan anual: ${o.yearly.price} por año, en un pago${o.yearly.savings ? ` (ahorrás ${o.yearly.savings})` : ""}. Pagar: ${o.yearly.payUrl}`,
    "",
  ];
}

/** Arma el correo (texto y HTML) con el estilo de RUNNER 360. Con `offer`, los planes y el pago van primero. */
function render(input: { subject: string; hi: string; title: string; body: string[]; cta: string; link: string; footer: string; unsubscribeUrl: string; offer?: InviteOffer }): Rendered {
  const { hi, title, body, cta, link, footer, unsubscribeUrl, offer } = input;
  const close = offer ? [`¿Preferís entrar a la app? Iniciá sesión: ${offer.loginUrl}`] : [`${cta}: ${link}`];
  const text = [hi, "", title, "", ...(offer ? offerText(offer) : []), ...body.flatMap((p) => [p, ""]), ...close, "", "—", footer, `Para dejar de recibir estos correos: ${unsubscribeUrl}`].join("\n");
  const html = `<!doctype html><html lang="es-AR"><body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#101c2c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#101c2c;padding:20px 28px;color:#18a999;font-weight:bold;font-size:18px;letter-spacing:.5px">RUNNER 360</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 8px;font-size:16px">${escape(hi)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escape(title)}</h1>
${offer ? offerHtml(offer) : ""}
${body.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${escape(p)}</p>`).join("\n")}
${
  offer
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#5b6b80">¿Preferís entrar a la app? <a href="${escape(offer.loginUrl)}" style="color:#0a7266">Iniciá sesión</a> y suscribite desde ahí.</p>`
    : `<p style="margin:24px 0 8px"><a href="${escape(link)}" style="display:inline-block;background:#18a999;color:#101c2c;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:12px;font-size:16px">${escape(cta)}</a></p>`
}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #e3e8ef;font-size:12px;color:#5b6b80;line-height:1.5">
${escape(footer)} <a href="${escape(unsubscribeUrl)}" style="color:#0a7266">Dejar de recibir estos correos</a>.<br>RUNNER 360 · runner360.ar
</td></tr></table></td></tr></table></body></html>`;
  return { subject: input.subject, text, html };
}

export function campaignEmail(input: { kind: CampaignKind; name: string | null; today: string; siteUrl: string; unsubscribeUrl: string; offer?: InviteOffer | null }): Rendered {
  const i = variantIndex(input.kind, input.today);
  const v = (input.kind === "invite" ? INVITES : ENCOURAGES)[i]!;
  const hi = firstName(input.name) ? `¡Hola, ${firstName(input.name)}!` : "¡Hola!";
  const footer =
    input.kind === "invite"
      ? "Recibís este correo porque tenés una cuenta en RUNNER 360."
      : "Recibís este correo porque tenés una suscripción en RUNNER 360.";
  const offer = input.kind === "invite" && input.offer ? input.offer : undefined;
  return render({ ...v, hi, link: `${input.siteUrl}${CTA_PATH[input.kind][i]}`, footer, unsubscribeUrl: input.unsubscribeUrl, offer });
}

const BIRTHDAYS: Omit<Variant, "subject">[] = [
  {
    title: "¡Que tengas un muy feliz cumpleaños!",
    body: [
      "Todo el equipo de RUNNER 360 te manda un abrazo enorme en tu día.",
      "Que este nuevo año venga lleno de kilómetros disfrutados, metas cumplidas y muchas ganas de salir a correr.",
      "Hoy el mejor entrenamiento es festejar: date un gusto, celebrá con tu gente y, si tenés ganas, regalate una salida suave para arrancar el año con energía.",
    ],
    cta: "Ver mi plan",
  },
  {
    title: "¡Hoy se festeja!",
    body: [
      "Un año más de vida es un año más de historias para contar, y nos alegra que el running sea parte de las tuyas.",
      "Te deseamos un cumpleaños hermoso y un año lleno de buenas salidas, carreras para disfrutar y logros que te hagan sonreír.",
      "¡Gracias por entrenar con RUNNER 360!",
    ],
    cta: "Entrar a RUNNER 360",
  },
  {
    title: "¡Feliz cumple! 🎂",
    body: [
      "Hoy es tu día y queremos ser parte del festejo.",
      "Que cada kilómetro de este nuevo año te acerque a lo que te propongas, y que nunca falten las ganas de ponerte las zapatillas.",
      "Disfrutá muchísimo tu día. ¡Nos vemos en el próximo entrenamiento!",
    ],
    cta: "Ver mi plan",
  },
  {
    title: "¡Un año más sumando kilómetros!",
    body: [
      "En RUNNER 360 no queríamos dejar pasar tu cumpleaños sin saludarte.",
      "Te deseamos salud, alegría y un año lleno de entrenamientos que te hagan sentir bien. La constancia ya la tenés; ahora, a disfrutar el camino.",
      "¡Que lo pases genial!",
    ],
    cta: "Entrar a RUNNER 360",
  },
];

/** Felicitación de cumpleaños (sin la edad). La versión cambia cada año. */
export function birthdayEmail(input: { name: string | null; today: string; siteUrl: string; unsubscribeUrl: string }): Rendered {
  const year = Number(input.today.slice(0, 4));
  const v = BIRTHDAYS[((year % BIRTHDAYS.length) + BIRTHDAYS.length) % BIRTHDAYS.length]!;
  const name = firstName(input.name);
  return render({
    ...v,
    subject: name ? `¡Feliz cumpleaños, ${name}! 🎉` : "¡Feliz cumpleaños! 🎉",
    hi: name ? `¡Hola, ${name}!` : "¡Hola!",
    link: `${input.siteUrl}/inicio`,
    footer: "Recibís este saludo porque tenés una cuenta en RUNNER 360 y cargaste tu fecha de nacimiento.",
    unsubscribeUrl: input.unsubscribeUrl,
  });
}
