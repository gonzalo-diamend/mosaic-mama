import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mosaico de Foto",
    short_name: "Mosaico",
    description: "Convierte fotos en patrones de mosaico editables.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2eee6",
    theme_color: "#146c5f",
    lang: "es",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
