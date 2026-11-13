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
        <li>
          Correos: además de los avisos de tu cuenta y de tus pagos, te podemos mandar correos de motivación (una invitación
          semanal a suscribirte si no tenés suscripción, o un correo de aliento cada 15 días si la tenés). Podés dejar de
          recibirlos cuando quieras con el link de cada correo o desde tu perfil.
        </li>
        <li>
          Wellness diario y cierre de sesión (opcional): antes de entrenar podés responder cómo dormiste y cómo están tu energía, tus
          músculos, tu estrés y tu ánimo (de 1 a 5); al terminar, los tiempos parciales por km y el esfuerzo percibido (RPE). El
          wellness es un dato de salud: se guarda solo con tu consentimiento expreso, lo ven vos y tu entrenador, y lo podés borrar
          desde tu perfil.
        </li>
        <li>
          Pulsaciones (opcional): para medirlas se usa la cámara de adelante del teléfono, con la pantalla como luz. La imagen se procesa en tu
          dispositivo y nunca se guarda ni se envía; solo guardamos el resultado (latidos contados, pulsaciones por minuto,
          calidad de la lectura, momento y, si la asociás, la carrera). Es una estimación para entrenar, no un dato médico.
        </li>
        <li>
          Ingreso con huella o Face ID (opcional): la huella o el rostro los verifica tu dispositivo y nunca salen de él.
          RUNNER 360 no recibe ni guarda datos biométricos: solo una clave pública por dispositivo, con la que comprueba que el
          ingreso viene de tu teléfono o computadora. Podés quitarla cuando quieras desde tu perfil.
        </li>
        <li>
          Consultas a Runnie, el asistente: las responde la propia app con la información de RUNNER 360 y con los datos de tu
          cuenta (tu plan, la sesión y la fuerza de hoy, tu test y, si diste el consentimiento de datos de salud, tu wellness y
          tus últimas sesiones). Tus preguntas no se envían a terceros ni se guardan: la conversación queda solo en tu
          navegador mientras la pestaña esté abierta.
        </li>
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
