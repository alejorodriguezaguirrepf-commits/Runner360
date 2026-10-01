import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { PROVIDERS } from "@/lib/payments/registry";
import { getServiceKey } from "@/lib/supabase/admin";

/** Estado de configuración (sin exponer valores secretos). */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    supabase: isSupabaseConfigured() ? "configured" : "pending",
    serviceRole: getServiceKey() ? "configured" : "pending",
    payments: Object.fromEntries(Object.values(PROVIDERS).map((p) => [p.id, p.isConfigured() ? "configured" : "pending"])),
    iap: "pending",
  });
}
