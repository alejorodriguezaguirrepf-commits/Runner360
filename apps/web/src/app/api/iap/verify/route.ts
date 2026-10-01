import { NextResponse } from "next/server";

/**
 * Verificación de compras dentro de la app (App Store / Google Play).
 * PENDIENTE: requiere cuentas de desarrollador, productos configurados en cada tienda y credenciales
 * (App Store Server API y Google Play Developer API). Ver docs/DEPLOYMENT.md › Pagos móviles.
 * Nunca se otorga acceso Premium sin validar el recibo en el servidor.
 */
export async function POST() {
  return NextResponse.json(
    { error: "iap_not_configured", message: "La verificación de compras móviles está pendiente de configuración." },
    { status: 501 },
  );
}
