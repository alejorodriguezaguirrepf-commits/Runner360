import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/** robots.txt: se indexan solo las páginas públicas; las privadas y la API quedan afuera. */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const site = publicEnv.siteUrl;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/admin", "/inicio", "/plan", "/registrar", "/progreso", "/perfil", "/hidratacion", "/competencias", "/suscripcion", "/entrenamientos", "/onboarding", "/planes", "/hoy", "/calculadora", "/instalar", "/restablecer"] }],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
