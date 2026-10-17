/**
 * Se ejecuta una vez al iniciar el servidor. Si la configuración de cobros es inconsistente, la app
 * no arranca y el registro dice qué corregir (nunca muestra valores de las variables).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { paymentsConfigProblems } = await import("./lib/payments/config");
  const { errors, warnings } = paymentsConfigProblems(process.env);
  for (const w of warnings) console.warn(`[runner360] config: ${w}`);
  if (errors.length > 0) {
    throw new Error(`[runner360] Configuración de cobros inválida:\n- ${errors.join("\n- ")}`);
  }
}
