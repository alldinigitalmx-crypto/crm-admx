import type { MetadataRoute } from "next";

// Hace que "Agregar a pantalla de inicio" en Android use el logo real de la
// marca en vez del ícono genérico que Chrome arma solo cuando no hay
// manifest — que es justo lo que se veía en la pantalla de carga antes de
// este archivo.
//
// Se dan dos versiones a propósito:
// - purpose "any": el logo tal cual, recortado a su propio contenido, sin
//   ningún fondo agregado — la usan la pestaña del navegador y contextos
//   que no aplican máscara.
// - purpose "maskable": Android le aplica su propia máscara (círculo,
//   squircle, etc.) a cualquier ícono de "agregar a pantalla de inicio";
//   todo lo que quede fuera de la "zona segura" se pierde, y si no hay un
//   ícono pensado para eso, Android le mete un fondo blanco y recorta el
//   logo por su cuenta — que es justo lo que se estaba viendo. Esta versión
//   ya viene con el margen correcto para que la máscara no le corte nada.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Admx Dev — Panel",
    short_name: "Admx Dev",
    description: "CRM interno de Admx Dev",
    start_url: "/login",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
