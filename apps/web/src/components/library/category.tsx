import type { Category } from "@runner360/plan-library";
import { cx } from "@/components/ui/primitives";
import { t } from "@/i18n";

const m = t.library;

/** Clases por categoría: el color siempre acompaña a un texto (nunca es la única señal). */
export const CATEGORY_CLASSES: Record<Category, string> = {
  rest: "bg-cat-rest-bg text-cat-rest",
  rec: "bg-cat-rec-bg text-cat-rec",
  easy: "bg-cat-easy-bg text-cat-easy",
  mod: "bg-cat-mod-bg text-cat-mod",
  thr: "bg-cat-thr-bg text-cat-thr",
  hard: "bg-cat-hard-bg text-cat-hard",
  race: "bg-cat-race-bg text-cat-race",
};

export function CategoryTag({ category, legend, className }: { category: Category; legend: Record<Category, string>; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide", CATEGORY_CLASSES[category], className)}>
      <span aria-hidden="true">{m.categoryShort[category]}</span>
      <span className="sr-only">{legend[category]}</span>
    </span>
  );
}

/** Referencias de categorías con los textos del contenido (category_legend). */
export function CategoryLegend({ legend }: { legend: Record<Category, string> }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{m.legend.title}</h3>
      <ul className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(CATEGORY_CLASSES) as Category[]).map((c) => (
          <li key={c} className={cx("inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold", CATEGORY_CLASSES[c])}>
            <span className="font-bold">{m.categoryShort[c]}</span>
            <span>{legend[c]}</span>
          </li>
        ))}
        <li className="inline-flex items-center rounded-md border border-line px-2 py-1 text-muted">{m.legend.quality}</li>
        <li className="inline-flex items-center rounded-md border border-line px-2 py-1 text-muted">{m.legend.strength}</li>
      </ul>
    </div>
  );
}
