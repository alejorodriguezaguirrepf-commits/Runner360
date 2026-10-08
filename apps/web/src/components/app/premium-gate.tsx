import { IconStar } from "@/components/ui/icons";
import { ButtonLink, Card } from "@/components/ui/primitives";

export function PremiumGate({ feature, children }: { feature: string; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-start gap-3">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-lime-300 text-navy-900"><IconStar /></span>
      <h2 className="text-lg font-bold">{feature} está incluido en Premium</h2>
      <p className="text-sm text-muted">Con Premium podés registrar y consultar esta información. Tus datos existentes se conservan siempre.</p>
      {children}
      <ButtonLink href="/suscripcion">Ver Premium</ButtonLink>
    </Card>
  );
}
