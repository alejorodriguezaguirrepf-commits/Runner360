import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  Droplets,
  Flag,
  Gauge,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { formatMoney, FEATURE_LABELS, RACE_DISTANCE_LABELS, RACE_DISTANCES, type Feature } from "@runner360/shared";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPublicCatalog } from "@/lib/data/pricing";

const DISTANCE_COPY: Record<(typeof RACE_DISTANCES)[number], string> = {
  "5k": "Tu primera carrera o una marca más rápida.",
  "10k": "El clásico de las calles: resistencia y ritmo.",
  "15k": "Un paso más hacia el fondo.",
  "21k": "La media maratón, con preparación progresiva.",
  "42k": "La maratón: 42,195 km con planificación seria.",
};

const FAQ = [
  {
    q: "¿Los planes están diseñados por un profesional?",
    a: "RUNNER 360 está dirigido por un profesional de Ciencias del Entrenamiento. Durante la beta, los planes visibles son de demostración y se identifican como DEMO / NO VALIDADO. Los planes definitivos se publican solo después de una revisión profesional registrada en la plataforma.",
  },
  {
    q: "¿Puedo empezar si nunca corrí?",
    a: "Sí. Si tu base actual no alcanza para un plan específico, la app te recomienda una fase introductoria de caminata y trote antes de exigirte más.",
  },
  {
    q: "¿La app reemplaza a un médico o a un entrenador?",
    a: "No. RUNNER 360 no realiza diagnósticos. Si tenés lesiones, condiciones médicas o dudas, consultá a un profesional de la salud antes de entrenar.",
  },
  {
    q: "¿Qué pasa con mis datos?",
    a: "Tus registros son privados: solo vos podés verlos. Los antecedentes de salud se guardan únicamente con tu consentimiento expreso y podés exportar o eliminar tu cuenta cuando quieras.",
  },
  {
    q: "¿Cómo se paga la suscripción?",
    a: "Los pagos están en etapa de integración. Cuando estén habilitados vas a poder suscribirte de forma mensual o anual. Mientras tanto podés usar la versión gratuita.",
  },
];

function intervalLabel(i: "month" | "year") {
  return i === "month" ? "por mes" : "por año";
}

// Los precios se administran en la base: se revalidan cada 5 minutos.
export const revalidate = 300;

export default async function LandingPage() {
  const catalog = await getPublicCatalog();
  const free = catalog?.find((p) => p.tier === "free");
  const premium = catalog?.find((p) => p.tier === "premium");

  return (
    <>
      <SiteHeader />
      <main id="contenido">
        {/* 1. Hero */}
        <section className="on-dark relative overflow-hidden bg-navy text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 md:grid-cols-[1.2fr_1fr] md:items-center md:pb-24 md:pt-20">
            <div>
              <Badge tone="lime">Beta · producto en desarrollo</Badge>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Tu próximo objetivo empieza con un plan.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/80">
                Entrená para tus primeros 5K, mejorá tus marcas o prepará tu próxima maratón con un plan adaptado a vos.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/registro" size="lg">
                  Comenzar gratis
                </ButtonLink>
                <ButtonLink href="#planes" size="lg" variant="ghost" className="border border-white/25 text-white hover:bg-white/10">
                  Conocer los planes
                </ButtonLink>
              </div>
            </div>
            <div aria-hidden className="relative hidden md:block">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm text-white/60">Ejemplo de vista · DEMO</p>
                <p className="mt-2 text-xl font-semibold">Rodaje fácil</p>
                <p className="text-sm text-white/70">40 min · Intensidad suave · RPE 3-4</p>
                <div className="mt-6 grid grid-cols-7 gap-2">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <div key={i} className={`rounded-lg py-3 text-center text-xs font-semibold ${[1, 3, 5].includes(i) ? "bg-lime text-navy" : "bg-white/10 text-white/60"}`}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="mt-6 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-2/5 rounded-full bg-lime" />
                </div>
                <p className="mt-2 text-xs text-white/60">Progreso del plan (ilustrativo)</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Propuesta de valor */}
        <section aria-labelledby="valor" className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="valor" className="text-3xl font-bold tracking-tight text-navy">Entrená con método, no a ciegas</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { Icon: Target, t: "Un plan para tu objetivo", d: "Según tu distancia, tu nivel, tus días disponibles y tu fecha de competencia." },
              { Icon: ShieldCheck, t: "Seguridad primero", d: "Si tu base no alcanza o indicás antecedentes de salud, te recomendamos una fase introductoria o una consulta profesional." },
              { Icon: BarChart3, t: "Progreso medible", d: "Kilómetros, tiempo, ritmo y cumplimiento calculados a partir de tus registros reales." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-line bg-white p-6">
                <Icon className="size-6 text-navy" aria-hidden />
                <h3 className="mt-4 font-semibold text-navy">{t}</h3>
                <p className="mt-2 text-sm text-muted">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Cómo funciona */}
        <section id="como-funciona" aria-labelledby="como" className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="como" className="text-3xl font-bold tracking-tight text-navy">Cómo funciona</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-4">
              {[
                { Icon: UserRound, t: "Contanos sobre vos", d: "Completá un cuestionario breve: objetivo, experiencia y disponibilidad." },
                { Icon: ClipboardList, t: "Recibí tu plan", d: "Te asignamos un plan publicado compatible con tu perfil." },
                { Icon: CalendarDays, t: "Seguí tu calendario", d: "Cada sesión con objetivo, duración, intensidad y estructura." },
                { Icon: Activity, t: "Registrá y progresá", d: "Cargá tus entrenamientos y mirá tu evolución semana a semana." },
              ].map(({ Icon, t, d }, i) => (
                <li key={t} className="rounded-2xl bg-surface p-6">
                  <span className="text-sm font-bold text-navy-600">Paso {i + 1}</span>
                  <Icon className="mt-3 size-6 text-navy" aria-hidden />
                  <h3 className="mt-3 font-semibold text-navy">{t}</h3>
                  <p className="mt-2 text-sm text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4. Distancias */}
        <section aria-labelledby="distancias" className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="distancias" className="text-3xl font-bold tracking-tight text-navy">Distancias disponibles</h2>
          <p className="mt-2 text-muted">Tres niveles para cada distancia: principiante, intermedio y avanzado.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {RACE_DISTANCES.map((d) => (
              <li key={d} className="rounded-2xl border border-line bg-white p-5">
                <p className="text-2xl font-extrabold text-navy">{d.toUpperCase()}</p>
                <p className="mt-1 text-sm font-medium text-navy">{RACE_DISTANCE_LABELS[d]}</p>
                <p className="mt-2 text-sm text-muted">{DISTANCE_COPY[d]}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Funciones + 6. Beneficios */}
        <section aria-labelledby="funciones" className="bg-white py-16">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2">
            <div>
              <h2 id="funciones" className="text-3xl font-bold tracking-tight text-navy">Funciones principales</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { Icon: CalendarDays, t: "Calendario de entrenamiento" },
                  { Icon: Activity, t: "Registro manual de sesiones" },
                  { Icon: Gauge, t: "Calculadora de ritmo y parciales" },
                  { Icon: Droplets, t: "Registro de hidratación" },
                  { Icon: Flag, t: "Competencias y marcas personales" },
                  { Icon: BarChart3, t: "Evolución y estadísticas" },
                ].map(({ Icon, t }) => (
                  <li key={t} className="flex items-center gap-3 rounded-xl bg-surface p-4 text-sm font-medium text-navy">
                    <Icon className="size-5 shrink-0" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-navy">Beneficios del seguimiento</h2>
              <ul className="mt-6 space-y-4 text-sm text-ink">
                {[
                  "Ver con claridad cuánto planificaste y cuánto realizaste cada semana.",
                  "Detectar a tiempo semanas incompletas o esfuerzos mayores a lo previsto.",
                  "Comparar tus marcas reales a lo largo del tiempo, por distancia.",
                  "Llegar a la competencia con un historial ordenado de tu preparación.",
                ].map((b) => (
                  <li key={b} className="flex gap-3">
                    <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 7. Planes y precios */}
        <section id="planes" aria-labelledby="precios" className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="precios" className="text-3xl font-bold tracking-tight text-navy">Planes y precios</h2>
          <p className="mt-2 text-muted">Empezá gratis. Pasate a Premium cuando quieras más.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <PlanCard
              name={free?.name ?? "Free"}
              description={free?.description ?? "Perfil, registro básico de entrenamientos, contenido introductorio y planes de demostración."}
              priceLabel="Gratis"
              features={(free?.features as Feature[] | undefined) ?? ["profile", "basic_log", "demo_plans"]}
              cta={{ href: "/registro", label: "Comenzar gratis" }}
            />
            <PlanCard
              highlighted
              name={premium?.name ?? "Premium"}
              description={premium?.description ?? "Planes publicados, calendario, estadísticas avanzadas, hidratación y competencias."}
              priceLabel={
                premium && premium.prices.length > 0
                  ? premium.prices.map((p) => `${formatMoney(p.amountMinor, p.currency)} ${intervalLabel(p.interval)}`).join(" · ")
                  : "Precio en configuración"
              }
              features={(premium?.features as Feature[] | undefined) ?? ["premium_plans", "calendar", "advanced_stats", "hydration", "competitions"]}
              cta={{ href: "/registro", label: "Crear cuenta" }}
              note="Los pagos se habilitarán al finalizar la integración con los proveedores. Hoy no se realizan cobros."
            />
          </div>
        </section>

        {/* 8. FAQ */}
        <section aria-labelledby="faq" className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 id="faq" className="text-3xl font-bold tracking-tight text-navy">Preguntas frecuentes</h2>
            <div className="mt-8 divide-y divide-line rounded-2xl border border-line">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group p-5">
                  <summary className="cursor-pointer list-none font-semibold text-navy marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {q}
                      <span aria-hidden className="text-xl leading-none transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Registro */}
        <section className="on-dark bg-navy">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">¿Listo para tu próximo objetivo?</h2>
              <p className="mt-2 text-white/75">Creá tu cuenta gratis y completá tu perfil de corredor en pocos minutos.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/registro" size="lg">Comenzar gratis</ButtonLink>
              <ButtonLink href="/ingresar" size="lg" variant="ghost" className="border border-white/25 text-white hover:bg-white/10">
                Ya tengo cuenta
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PlanCard({
  name,
  description,
  priceLabel,
  features,
  cta,
  highlighted,
  note,
}: {
  name: string;
  description: string;
  priceLabel: string;
  features: Feature[];
  cta: { href: string; label: string };
  highlighted?: boolean;
  note?: string;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border p-6 ${highlighted ? "border-navy bg-navy text-white on-dark" : "border-line bg-white"}`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-xl font-bold ${highlighted ? "text-white" : "text-navy"}`}>{name}</h3>
        {highlighted ? <Badge tone="lime">Recomendado</Badge> : null}
      </div>
      <p className={`mt-2 text-sm ${highlighted ? "text-white/75" : "text-muted"}`}>{description}</p>
      <p className={`tabular mt-5 text-2xl font-extrabold ${highlighted ? "text-lime" : "text-navy"}`}>{priceLabel}</p>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className={`size-5 shrink-0 ${highlighted ? "text-lime" : "text-success"}`} aria-hidden />
            {FEATURE_LABELS[f] ?? f}
          </li>
        ))}
      </ul>
      {note ? <p className={`mt-4 text-xs ${highlighted ? "text-white/60" : "text-muted"}`}>{note}</p> : null}
      <Link
        href={cta.href}
        className={`mt-6 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${highlighted ? "bg-lime text-navy hover:bg-lime-600" : "bg-navy text-white hover:bg-navy-700"}`}
      >
        {cta.label}
      </Link>
    </div>
  );
}
