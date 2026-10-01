import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function PremiumLocked({ feature }: { feature: string }) {
  return (
    <EmptyState icon={Lock} title={`${feature} está incluido en Premium`} action={<ButtonLink href="/app/suscripcion">Ver Premium</ButtonLink>}>
      Tus datos existentes siguen disponibles para consulta y exportación.
    </EmptyState>
  );
}
