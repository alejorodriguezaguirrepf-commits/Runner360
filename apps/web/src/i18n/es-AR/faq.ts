/**
 * Preguntas frecuentes (es-AR). Única fuente para la portada y para los datos estructurados
 * (FAQPage). Textos aprobados: solo se corrigen tildes y puntuación.
 */
export type FaqItem = { id: string; question: string; answer: string; order: number };

export const faq = {
  title: "Preguntas frecuentes",
  items: [
    {
      id: "quien-disena",
      order: 1,
      question: "¿Quién diseña los planes?",
      answer:
        "Los planes los diseña Alejo Rodríguez Aguirre, licenciado en Ciencias del Entrenamiento, ex atleta de maratón y actual entrenador físico de atletas.",
    },
    {
      id: "experiencia-previa",
      order: 2,
      question: "¿Necesito experiencia previa?",
      answer: "No necesitás experiencia previa. Elegís el plan según tu nivel, y hay planes pensados para quienes empiezan desde cero.",
    },
    {
      id: "reemplaza-entrenador",
      order: 3,
      question: "¿La app reemplaza a un entrenador?",
      answer:
        "No, no lo reemplaza. Pero te da las herramientas necesarias para llevar adelante un plan de entrenamiento serio si entrenás solo o sos autodidacta.",
    },
    {
      id: "gratis",
      order: 4,
      question: "¿Puedo usarla gratis?",
      answer: "Sí. Tenés una opción gratuita con la primera semana de cualquier plan.",
    },
    {
      id: "cobro",
      order: 5,
      question: "¿Cómo se cobran las suscripciones?",
      // Pendiente: «Mediante débito automático.» se publica cuando se confirme un cobro real.
      answer: "Los medios de pago están en proceso de integración. Mientras tanto no se realizan cobros desde la plataforma.",
    },
    {
      id: "cancelar",
      order: 6,
      question: "¿Puedo cancelar cuando quiera?",
      answer:
        "Sí. Desde Suscripción, tocá «Cancelar renovación». Se da de baja el débito automático y seguís con acceso hasta el fin del período que ya pagaste.",
    },
  ] satisfies FaqItem[],
} as const;
