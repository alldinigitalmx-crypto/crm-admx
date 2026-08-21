import type { MetadataRoute } from "next";

// Hace que "Agregar a pantalla de inicio" en Android use el logo real de la
// marca (fondo azul marino + el mark dorado) en vez del ícono genérico que
// Chrome arma solo cuando no hay manifest — que es justo lo que se veía en
// la pantalla de carga antes de este archivo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Admx Dev — Panel",
    short_name: "Admx Dev",
    description: "CRM interno de Admx Dev",
    start_url: "/login",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
