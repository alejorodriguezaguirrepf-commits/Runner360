import type { Metadata } from "next";
import { LEGAL_VERSIONS } from "@runner360/shared";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Política de privacidad (borrador)" };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Política de privacidad" version={LEGAL_VERSIONS.privacy}>
      <h2>1. Responsable</h2>
      <p>
        El responsable del tratamiento será el titular de RUNNER 360. Los datos de identificación y contacto del responsable se
        completarán antes del lanzamiento.
      </p>
      <h2>2. Datos que tratamos</h2>
      <ul>
        <li>Cuenta: correo electrónico y nombre visible.</li>
        <li>Perfil deportivo: fecha de nacimiento, objetivo, nivel, experiencia, disponibilidad y marcas declaradas.</li>
        <li>Registros: entrenamientos, hidratación y competencias que cargues.</li>
        <li>Antecedentes de salud (opcional): solo con tu consentimiento expreso, visibles únicamente para vos.</li>
        <li>Suscripción: estado y eventos informados por los proveedores de pago. No almacenamos datos de tarjetas.</li>
      </ul>
      <h2>3. Datos que no recopilamos</h2>
      <p>No recopilamos ubicación en segundo plano. Cualquier uso futuro de ubicación requerirá un consentimiento específico.</p>
      <h2>4. Finalidades</h2>
      <p>Prestar el servicio de planificación y seguimiento del entrenamiento, gestionar tu suscripción y mejorar la plataforma con estadísticas agregadas.</p>
      <h2>5. Seguridad</h2>
      <p>Aplicamos control de acceso por usuario a nivel de base de datos, cifrado en tránsito y registro de acciones administrativas.</p>
      <h2>6. Tus derechos</h2>
      <p>
        Podés acceder, rectificar, exportar y suprimir tus datos desde tu perfil. Como titular de los datos tenés derecho a
        ejercer el acceso en forma gratuita a intervalos no inferiores a seis meses, salvo interés legítimo (art. 14 inc. 3,
        Ley 25.326). La Agencia de Acceso a la Información Pública es el órgano de control de la Ley 25.326.
      </p>
      <h2>7. Conservación y eliminación</h2>
      <p>Al eliminar tu cuenta se borran tus datos personales y registros asociados, salvo la información que deba conservarse por obligación legal.</p>
      <h2>8. Transferencias internacionales</h2>
      <p>La infraestructura puede alojarse fuera de Argentina. Se detallarán los proveedores y las garantías aplicables antes del lanzamiento.</p>
    </LegalLayout>
  );
}
