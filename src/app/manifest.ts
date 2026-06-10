import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Polla Mundialista",
    short_name: "LaPolla",
    description:
      "Polla del Mundial 2026 — La Polla. Predice, compite y celebra.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#0033a0",
    orientation: "portrait",
    lang: "es-CO",
    categories: ["sports", "social", "entertainment"],
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
