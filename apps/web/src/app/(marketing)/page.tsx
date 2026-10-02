import { DISTANCE_CODES, DISTANCE_METERS } from "@runner360/training-engine";
import { DISTANCE_LABELS, formatKm } from "@runner360/shared";
import {
  IconBolt,
  IconCalendar,
  IconChart,
  IconCheck,
  IconDrop,
  IconFlag,
  IconRoute,
  IconShield,
  IconTimer,
} from "@/components/ui/icons";
import { Badge, ButtonLink } from "@/components/ui/primitives";
import { getPricedProducts } from "@/lib/data/pricing";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

const DISTANCE_COPY: Record<(typeof DISTANCE_CODES)[number], string> = {
  "5K": "Tu primera carrera o tu mejor marca en la distancia más popular.",
  "10K": "El paso natural para sumar resistencia y velocidad.",
  "15K": "Un desafío intermedio para consolidar el fondo.",
  "21K": "La media maratón, con progresión gradual y semanas de descarga.",
  "42K": "La maratón: preparación larga, ordenada y con criterios de seguridad.",
};

const FEATURES = [
  { icon: IconCalendar, title: "Calendario personal", text: "Tus sesiones ubicadas en los días que elegiste, con objetivo, duración, intensidad y estructura." },
  { icon: IconTimer, title: "Registro de entrenamientos", text: "Distancia, tiempo, ritmo, parciales, frecuencia cardíaca y esfuerzo percibido." },
  { icon: IconChart, title: "Evolución", text: "Kilómetros semanales, tiempo acumulado, cumplimiento del plan y consistencia." },
  { icon: IconDrop, title: "Hidratación", text: "Registrá lo que tomás y consultá recomendaciones educativas generales." },
  { icon: IconFlag, title: "Competencias", text: "Objetivos, resultados reales, parciales y marcas personales." },
  { icon: IconShield, title: "Privacidad", text: "Tus datos son tuyos: acceso restringido, exportación y eliminación de cuenta." },
];

const FAQ = [
  {
    q: "¿Quién diseña los planes?",
    a: "La metodología la administra y valida un profesional de Ciencias del Entrenamiento desde el panel de la plataforma. Mientras la beta está en desarrollo, los planes visibles son de demostración y están marcados como DEMO / NO VALIDADO.",
  },
  {
    q: "¿Necesito experiencia previa?",
    a: "No. Si estás empezando, el sistema te propone una fase introductoria. Si tus datos indican que no tenés base suficiente para una distancia, no te asigna un plan exigente.",
  },
  {
    q: "¿La app reemplaza a un médico o entrenador?",
    a: "No. RUNNER 360 no realiza diagnósticos médicos. Si declarás antecedentes de salud, te recomendamos consultar con un profesional antes de empezar.",
  },
  {
    q: "¿Puedo usarla gratis?",
    a: "Sí. El plan Free incluye perfil, registro básico, contenido introductorio y un plan gratuito. Premium suma planes adicionales, estadísticas avanzadas, hidratación y competencias.",
  },
  {
    q: "¿Cómo se cobran las suscripciones?",
    a: "Los medios de pago están en proceso de integración. Mientras tanto no se realizan cobros desde la plataforma.",
  },
];

export default async function LandingPage() {
  const products = await getPricedProducts(createPublicClient());

  return (
    <>
      {/* 1. Hero */}
      <section className="dark-zone relative overflow-hidden bg-navy-900 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div className="space-y-6">
            <Badge tone="lime">Beta en desarrollo</Badge>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Tu próximo objetivo empieza con un plan.
            </h1>
            <p className="max-w-xl text-lg text-white/80">
              Entrená para tus primeros 5K, mejorá tus marcas o prepará tu próxima maratón con un plan adaptado a vos.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/registro" className="px-6 text-base">Comenzar gratis</ButtonLink>
              <ButtonLink href="#precios" variant="ghost" className="border-white/30 px-6 text-base text-white hover:bg-white/10">
                Conocer los planes
              </ButtonLink>
            </div>
          </div>
          <div aria-hidden="true" className="rounded-3xl border border-white/10 bg-navy-800 p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-lime-400">Vista de ejemplo</p>
            <p className="mt-3 text-sm text-white/70">Sesión de hoy</p>
            <p className="text-2xl font-bold">Rodaje fácil</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ["Duración", "40 min"],
                ["Intensidad", "Baja"],
                ["RPE", "3–4"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-navy-900 p-3">
                  <p className="text-[11px] text-white/60">{k}</p>
                  <p className="font-bold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 h-2 rounded-full bg-navy-900">
              <div className="h-2 w-2/3 rounded-full bg-lime-400" />
            </div>
            <p className="mt-2 text-xs text-white/60">Progreso de la semana (ilustrativo)</p>
          </div>
        </div>
      </section>

      {/* 2. Propuesta de valor */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: IconRoute, t: "Un plan para tu objetivo", d: "Distancia, nivel y días disponibles definen tu calendario, sin sesiones inventadas para rellenar." },
            { icon: IconShield, t: "Criterio profesional", d: "Los planes se publican solo cuando cumplen criterios de validación definidos por el profesional a cargo." },
            { icon: IconBolt, t: "Datos que te sirven", d: "Ritmos, volumen y cumplimiento calculados con precisión a partir de lo que registrás." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-lime-300 text-navy-900"><Icon /></span>
              <h2 className="mt-4 text-lg font-bold">{t}</h2>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Cómo funciona */}
      <section id="como-funciona" className="bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight">Cómo funciona</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              ["Creá tu cuenta", "Registrate gratis con tu correo."],
              ["Contanos sobre vos", "Objetivo, nivel, kilómetros actuales y días disponibles."],
              ["Recibí tu plan", "Te proponemos el plan publicado que corresponde a tu perfil."],
              ["Registrá y progresá", "Cargá cada sesión y seguí tu evolución semana a semana."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl border border-line p-5">
                <span className="tabular text-sm font-bold text-lime-700">Paso {i + 1}</span>
                <p className="mt-1 font-bold">{t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Distancias */}
      <section id="distancias" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Distancias disponibles</h2>
        <p className="mt-2 text-muted">Cada distancia contempla niveles principiante, intermedio y avanzado.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DISTANCE_CODES.map((d) => (
            <div key={d} className="rounded-2xl bg-navy-900 p-5 text-white">
              <p className="text-3xl font-extrabold text-lime-400">{d}</p>
              <p className="tabular text-xs text-white/60">{formatKm(DISTANCE_METERS[d])}</p>
              <p className="mt-3 text-sm text-white/80">{DISTANCE_COPY[d]}</p>
              <span className="sr-only">{DISTANCE_LABELS[d]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 5 y 6. Funciones y beneficios */}
      <section className="bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight">Funciones principales</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-900"><Icon /></span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-2xl bg-canvas p-6">
            <h3 className="text-xl font-bold">Beneficios del seguimiento</h3>
            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[
                "Ver si estás cumpliendo lo planificado y ajustar a tiempo.",
                "Detectar semanas con demasiada o muy poca carga.",
                "Distinguir tiempos estimados de resultados reales.",
                "Tener tu historial ordenado y exportable cuando lo necesites.",
              ].map((b) => (
                <li key={b} className="flex gap-2"><IconCheck className="mt-0.5 shrink-0 text-lime-700" />{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 7. Planes y precios */}
      <section id="precios" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Planes y precios</h2>
        <p className="mt-2 text-muted">Los precios se administran desde la plataforma y pueden cambiar durante la beta.</p>
        {products && products.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className={`flex flex-col rounded-2xl p-6 ring-1 ${p.tier === "premium" ? "bg-navy-900 text-white ring-navy-900" : "bg-surface ring-line"}`}>
                <p className="text-sm font-semibold uppercase tracking-wide">{p.name}</p>
                <p className="tabular mt-3 text-3xl font-extrabold">
                  {p.tier === "free" ? "Gratis" : (p.priceLabel ?? "Precio a definir")}
                  {p.tier !== "free" && p.priceLabel ? (
                    <span className="text-base font-medium opacity-70"> / {p.billing_interval === "year" ? "año" : "mes"}</span>
                  ) : null}
                </p>
                <p className={`mt-2 text-sm ${p.tier === "premium" ? "text-white/75" : "text-muted"}`}>{p.description}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2"><IconCheck className={`mt-0.5 shrink-0 ${p.tier === "premium" ? "text-lime-400" : "text-lime-700"}`} />{f}</li>
                  ))}
                </ul>
                <ButtonLink href="/registro" variant={p.tier === "premium" ? "primary" : "secondary"} className="mt-6">
                  {p.tier === "free" ? "Comenzar gratis" : "Crear cuenta"}
                </ButtonLink>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-xl bg-surface p-6 text-sm text-muted ring-1 ring-line">
            Los precios se publicarán al habilitar la base de datos y los medios de pago. Podés crear tu cuenta gratis cuando el registro esté disponible.
          </p>
        )}
      </section>

      {/* 8. Preguntas frecuentes */}
      <section id="preguntas" className="bg-surface py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {q}
                    <span aria-hidden="true" className="text-xl leading-none text-muted transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Registro */}
      <section className="dark-zone bg-navy-900 py-16 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight">Empezá hoy con tu perfil de corredor</h2>
          <p className="text-white/75">Creá tu cuenta gratis y completá el cuestionario en pocos minutos.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/registro" className="px-6 text-base">Comenzar gratis</ButtonLink>
            <ButtonLink href="/ingresar" variant="ghost" className="border-white/30 px-6 text-base text-white hover:bg-white/10">Ya tengo cuenta</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
