import { IconStar } from "@/components/ui/icons";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";

const f = t.library.free;

/**
 * Plan gratis: qué incluye (elegir cualquier plan con la primera semana liberada) y que para seguir
 * entrenando hay que suscribirse. "choose": todavía no eligió plan; "enrolled": ya está entrenando.
 */
export function FreePlanNotice({ variant, weeks }: { variant: "choose" | "enrolled"; weeks: number }) {
  const n = Math.max(1, weeks);
  const choose = variant === "choose";
  return (
    <Card className="border-primary">
      <div className="flex gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent"><IconStar /></span>
        <div className="min-w-0 space-y-1">
          <h2 className="font-bold text-ink">{choose ? f.chooseTitle : fmt(n === 1 ? f.enrolledTitle : f.enrolledTitleMany, { n })}</h2>
          <p className="text-sm text-muted">{choose ? fmt(n === 1 ? f.chooseText : f.chooseTextMany, { n }) : f.enrolledText}</p>
          <p className="text-sm font-semibold text-ink">{f.keepTraining}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {choose ? <ButtonLink href="/planes">{f.choose}</ButtonLink> : null}
        <ButtonLink href="/suscripcion" variant={choose ? "secondary" : "primary"}>{f.subscribe}</ButtonLink>
      </div>
    </Card>
  );
}
