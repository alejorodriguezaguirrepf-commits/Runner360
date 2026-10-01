import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";

export function ConfigNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <Alert tone="warning" title="Autenticación pendiente de configuración" className="mb-6">
      Este entorno no tiene credenciales de Supabase. Completá <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
      <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (ver <code>.env.example</code>) para habilitar el registro y el ingreso.
    </Alert>
  );
}
