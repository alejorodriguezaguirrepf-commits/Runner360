import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/** sitemap.xml con las páginas públicas, siempre con el dominio de producción. */
export const dynamic = "force-dynamic";

const PUBLIC_PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/registro", priority: 0.8 },
  { path: "/descargar", priority: 0.7 },
  { path: "/ingresar", priority: 0.6 },
  { path: "/terminos", priority: 0.3 },
  { path: "/privacidad", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = publicEnv.siteUrl;
  return PUBLIC_PAGES.map(({ path, priority }) => ({ url: `${site}${path === "/" ? "" : path}`, changeFrequency: "monthly", priority }));
}
