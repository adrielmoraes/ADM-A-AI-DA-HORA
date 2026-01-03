import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AÇAI DA HORA",
    short_name: "Açaí",
    description: "Sistema de Gestão e Caixa",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070a10",
    theme_color: "#0b0b12",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

