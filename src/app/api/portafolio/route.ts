import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

// Público a propósito: la landing (otro proyecto, otro dominio) consume
// esto para pintar "Nuestro trabajo" — no expone nada que no esté ya
// pensado para verse en la página pública (proyectos marcados "activo").
// Cacheado con el tag "portafolio-publico" -- admin/portafolio/actions.ts
// lo invalida en cuanto algo cambia, así que no depende solo del tiempo.
const obtenerPortafolioPublico = unstable_cache(
  async () => {
    const proyectos = await prisma.proyectoPortafolio.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        categoria: true,
        linkExterno: true,
        destacado: true,
      },
    });

    const imagenes = await prisma.archivo.findMany({
      where: { entidadTipo: "Proyecto", entidadId: { in: proyectos.map((p) => p.id) } },
      orderBy: { creadoEn: "asc" },
      select: { entidadId: true, url: true, nombre: true },
    });

    const imagenesPorProyecto = new Map<number, { url: string; nombre: string }[]>();
    for (const img of imagenes) {
      const lista = imagenesPorProyecto.get(img.entidadId) ?? [];
      lista.push({ url: img.url, nombre: img.nombre });
      imagenesPorProyecto.set(img.entidadId, lista);
    }

    return proyectos.map((p) => ({
      ...p,
      imagenes: imagenesPorProyecto.get(p.id) ?? [],
    }));
  },
  ["portafolio-publico"],
  { tags: ["portafolio-publico"], revalidate: 300 }
);

export async function GET() {
  const proyectos = await obtenerPortafolioPublico();

  return NextResponse.json(
    { proyectos },
    {
      headers: {
        // Cualquier origen puede leer esto -- es contenido de marketing
        // pensado para mostrarse en un sitio público, sin cookies ni
        // datos sensibles de por medio.
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}
