import type { Metadata } from "next";
import { LEGAL_VERSIONS } from "@runner360/shared";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Términos y condiciones (borrador)" };

export default function TermsPage() {
  return (
    <LegalLayout title="Términos y condiciones" version={LEGAL_VERSIONS.terms}>
      <h2>1. Servicio</h2>
      <p>RUNNER 360 es una plataforma de planificación y seguimiento del entrenamiento de carrera. Se encuentra en versión beta.</p>
      <h2>2. No es un servicio médico</h2>
      <p>
        La plataforma no realiza diagnósticos ni reemplaza la evaluación de profesionales de la salud. Antes de iniciar un
        programa de entrenamiento, consultá con un médico, especialmente si tenés lesiones, condiciones médicas o síntomas.
        Ante dolor, mareos, dolor en el pecho o falta de aire desproporcionada, detené la actividad y buscá asistencia.
      </p>
      <h2>3. Planes de entrenamiento</h2>
      <p>
        Los planes identificados como DEMO / NO VALIDADO son de demostración y no constituyen una prescripción. Las
        estimaciones de ritmo y tiempo son orientativas y no garantizan resultados.
      </p>
      <h2>4. Cuenta</h2>
      <p>Debés tener al menos 16 años. Sos responsable de la confidencialidad de tu contraseña.</p>
      <h2>5. Suscripciones</h2>
      <p>Las condiciones de precio, renovación, cancelación y reembolso se informarán antes de habilitar los pagos.</p>
      <h2>6. Modificaciones</h2>
      <p>Te informaremos los cambios relevantes de estos términos y te pediremos aceptarlos cuando corresponda.</p>
    </LegalLayout>
  );
}
