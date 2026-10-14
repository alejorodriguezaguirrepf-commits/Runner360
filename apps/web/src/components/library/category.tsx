import type { Category } from "@runner360/plan-library";

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
