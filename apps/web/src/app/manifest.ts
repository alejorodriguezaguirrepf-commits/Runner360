import type { MetadataRoute } from "next";

/** App instalable (PWA): nombre, colores e íconos para Android, iPhone y escritorio. */
const SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RUNNER 360",
    short_name: "RUNNER 360",
    description: "Planes de running de 5 km a maratón, registro de entrenamientos y progreso.",
    lang: "es-AR",
    dir: "ltr",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7fa",
    theme_color: "#101c2c",
    categories: ["health", "fitness", "sports"],
    icons: [
      ...SIZES.map((s) => ({ src: `/icons/icon-${s}.png`, sizes: `${s}x${s}`, type: "image/png", purpose: "any" as const })),
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Hoy", url: "/hoy", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
      { name: "Mi plan", url: "/plan", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
    ],
  };
}
