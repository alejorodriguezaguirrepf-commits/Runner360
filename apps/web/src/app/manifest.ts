import type { MetadataRoute } from "next";

/** Ícono y colores al agregar RUNNER 360 a la pantalla de inicio del teléfono. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RUNNER 360",
    short_name: "RUNNER 360",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#101c2c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
