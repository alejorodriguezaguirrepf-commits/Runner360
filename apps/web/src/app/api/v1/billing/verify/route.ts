import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApi } from "@/lib/api-auth";

const bodySchema = z.object({
  store: z.enum(["apple", "google"]),
  productId: z.string().min(1).max(200),
  /** Recibo (App Store) o purchaseToken (Google Play). */
  receipt: z.string().min(1).max(20000),
});

/**
 * Validación server-side de compras dentro de las apps.
 * PENDIENTE DE CONFIGURACIÓN: requiere App Store Server API (clave .p8, issuer, bundle id) y
 * Google Play Developer API (cuenta de servicio). Hasta entonces responde 501 y NO otorga Premium.
 */
export async function POST(request: Request) {
  const auth = await authenticateApi(request);
  if (auth instanceof NextResponse) return auth;
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  return NextResponse.json(
    { error: "store_billing_not_configured", message: "La validación de compras en la tienda está pendiente de configuración." },
    { status: 501 },
  );
}
