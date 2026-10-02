import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";
import { LEGAL_VERSIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalDoc title="Política de privacidad" version={LEGAL_VERSIONS.privacy}>
      <p>
        Esta política describe qué datos personales trata RUNNER 360, con qué finalidad y cuáles son tus derechos. Se elaboró
        tomando como referencia la Ley N.º 25.326 de Protección de los Datos Personales de la República Argentina y su
        normativa complementaria. Para usuarios de otros países pueden aplicar requisitos adicionales que serán evaluados
        antes del lanzamiento.
      </p>
      <h2>Datos que tratamos</h2>
      <ul>
        <li>Datos de cuenta: correo electrónico, nombre visible y fecha de nacimiento.</li>
        <li>Datos deportivos: objetivo, nivel, experiencia, kilómetros semanales, disponibilidad, marcas y registros de entrenamiento.</li>
        <li>Registros opcionales: hidratación, competencias, frecuencia cardíaca y comentarios.</li>
        <li>
          Antecedentes de salud autodeclarados (opcional): se consideran datos sensibles. Solo se registran con tu
          consentimiento expreso, los ve únicamente tu cuenta y se usan solo para recomendarte una revisión profesional antes
          de asignar un plan. No realizamos diagnósticos.
        </li>
        <li>Datos de suscripción: estado, fechas y referencias del proveedor de pago. Nunca almacenamos datos completos de tarjetas.</li>
      </ul>
      <h2>Ubicación</h2>
      <p>
        RUNNER 360 no recopila tu ubicación, ni en primer plano ni en segundo plano. Si en el futuro se incorpora el registro
        de recorridos por GPS, se pedirá un consentimiento específico y separado.
      </p>
      <h2>Finalidades</h2>
      <ul>
        <li>Prestar el servicio: asignar planes, armar tu calendario y calcular estadísticas.</li>
        <li>Gestionar tu suscripción.</li>
        <li>Seguridad, prevención de abusos y soporte.</li>
      </ul>
      <h2>Dónde se almacenan</h2>
      <p>
        Los datos se alojan en servicios de infraestructura en la nube contratados por RUNNER 360 (base de datos y
        autenticación). La región y los proveedores definitivos, y las garantías para transferencias internacionales, se
        informarán en la versión final de esta política.
      </p>
      <h2>Tus derechos</h2>
      <p>
        Podés acceder, rectificar, actualizar y suprimir tus datos. Desde tu perfil podés descargar una copia de tus datos y
        solicitar la eliminación de tu cuenta. También podés revocar consentimientos opcionales en cualquier momento. La
        Agencia de Acceso a la Información Pública es el órgano de control de la Ley 25.326 y tiene la atribución de atender
        denuncias y reclamos.
      </p>
      <h2>Conservación</h2>
      <p>
        Conservamos tus datos mientras tu cuenta esté activa. Al eliminarla se borran tus datos personales y deportivos,
        salvo aquellos que debamos conservar por obligación legal (por ejemplo, registros de facturación).
      </p>
      <h2>Menores de edad</h2>
      <p>El servicio está dirigido a personas mayores de 18 años. Los menores deben contar con autorización y acompañamiento de un adulto responsable.</p>
    </LegalDoc>
  );
}
