import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";
import { LEGAL_VERSIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TermsPage() {
  return (
    <LegalDoc title="Términos y condiciones" version={LEGAL_VERSIONS.terms}>
      <h2>Servicio</h2>
      <p>
        RUNNER 360 es una plataforma de planificación y seguimiento de entrenamiento para corredores, actualmente en versión
        beta. Algunas funciones pueden cambiar, interrumpirse o no estar disponibles.
      </p>
      <h2>Planes de entrenamiento</h2>
      <p>
        Los planes marcados como DEMO / NO VALIDADO son estructuras de ejemplo para probar la plataforma y no constituyen una
        prescripción. Los planes validados son publicados por el profesional responsable de la metodología. En todos los
        casos, el entrenamiento implica riesgos: escuchá a tu cuerpo, respetá los criterios de suspensión de cada sesión y
        consultá a un profesional de la salud ante cualquier duda.
      </p>
      <h2>Información de salud</h2>
      <p>
        La plataforma no brinda diagnósticos ni tratamientos médicos. Las recomendaciones de hidratación son educativas y
        generales. Las estimaciones de tiempos son orientativas y no garantizan resultados.
      </p>
      <h2>Cuenta</h2>
      <p>
        Sos responsable de mantener la confidencialidad de tu contraseña. Podés eliminar tu cuenta en cualquier momento desde
        tu perfil.
      </p>
      <h2>Suscripciones</h2>
      <p>
        Las condiciones de precio, renovación, cancelación y reembolso se informarán antes de habilitar los cobros. Hasta
        entonces no se realizan cargos a través de la plataforma.
      </p>
      <h2>Contacto</h2>
      <p>Para consultas sobre estos términos, utilizá el canal de contacto publicado en el sitio.</p>
    </LegalDoc>
  );
}
