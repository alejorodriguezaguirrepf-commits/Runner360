/** Textos de precios (es-AR). El importe sale de la configuración de precios y de la cotización. */
export const pricing = {
  perMonth: "/ mes",
  perYear: "/ año",
  arsApprox: "≈ {ars} {period}",
  arsPeriodMonth: "por mes",
  arsPeriodYear: "por año",
  legend: "Se cobra en pesos argentinos, al equivalente en dólares del día. El valor en pesos es aproximado.",
  rateNote: "Cotización: dólar {type} del {date}.",
  rateTypes: { oficial: "oficial", mayorista: "mayorista", blue: "blue", bolsa: "MEP", contadoconliqui: "contado con liquidación", tarjeta: "tarjeta" } as Record<string, string>,
  renewal: "Se renueva automáticamente cada mes. Podés cancelar cuando quieras.",
  renewalYear: "Pago único por 12 meses, en cuotas si querés. No se renueva solo: te avisamos 15 días antes de que venza.",
  savings: "Ahorrás {amount} ({pct} %) frente a pagar 12 meses de la mensual.",
  toDefine: "Precio a definir",
} as const;
