"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { del } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { requiereNivel } from "@/lib/alcance";

export type ProyectoFormState = { error?: string } | undefined;

async function currentUserId() {
  const usuario = await currentUsuario();
  return usuario?.id ?? null;
}

// El API público que consume la landing (/api/portafolio) cachea con este
// tag -- cualquier cambio aquí lo invalida, para que un cambio en el CRM
// se refleje ahí sin esperar a que expire el cache por tiempo.
function revalidatePortafolio() {
  revalidatePath("/admin/portafolio");
  revalidateTag("portafolio-publico", "max");
}

function parseProyectoForm(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const linkExterno = String(formData.get("linkExterno") ?? "").trim() || null;
  const destacado = formData.get("destacado") === "on";
  const activo = formData.get("activo") === "on";

  return { titulo, descripcion, categoria, linkExterno, destacado, activo };
}

function validateProyectoForm(data: ReturnType<typeof parseProyectoForm>) {
  if (!data.titulo) return "El título es obligatorio.";
  return null;
}

export async function crearProyecto(
  _prevState: ProyectoFormState,
  formData: FormData
): Promise<ProyectoFormState> {
  if (!(await requiereNivel("Portafolio", "Crear"))) {
    return { error: "No tienes permiso para crear en este módulo." };
  }

  const data = parseProyectoForm(formData);
  const error = validateProyectoForm(data);
  if (error) return { error };

  const userId = await currentUserId();
  const ultimo = await prisma.proyectoPortafolio.aggregate({ _max: { orden: true } });

  await prisma.proyectoPortafolio.create({
    data: { ...data, creadoPorId: userId, orden: (ultimo._max.orden ?? 0) + 1 },
  });

  revalidatePortafolio();
  return undefined;
}

export async function actualizarProyecto(
  id: number,
  _prevState: ProyectoFormState,
  formData: FormData
): Promise<ProyectoFormState> {
  if (!(await requiereNivel("Portafolio", "Editar"))) {
    return { error: "No tienes permiso para editar en este módulo." };
  }

  const data = parseProyectoForm(formData);
  const error = validateProyectoForm(data);
  if (error) return { error };

  await prisma.proyectoPortafolio.update({ where: { id }, data });

  revalidatePortafolio();
  revalidatePath(`/admin/portafolio/${id}`);
  return undefined;
}

export async function eliminarProyecto(id: number) {
  if (!(await requiereNivel("Portafolio", "Editar"))) return;

  const imagenes = await prisma.archivo.findMany({
    where: { entidadTipo: "Proyecto", entidadId: id },
  });
  for (const img of imagenes) {
    if (img.url.includes(".public.blob.vercel-storage.com")) {
      try {
        await del(img.url);
      } catch {
        // Si ya no existe en el store, no bloquea el borrado del registro.
      }
    }
  }
  await prisma.archivo.deleteMany({ where: { entidadTipo: "Proyecto", entidadId: id } });
  await prisma.proyectoPortafolio.delete({ where: { id } });

  revalidatePortafolio();
}

// Reordenar con dos botones (subir/bajar) es más que suficiente para la
// cantidad de proyectos que de verdad se van a mostrar -- no vale la pena
// meter drag-and-drop para esto.
export async function moverProyecto(id: number, direccion: "arriba" | "abajo") {
  if (!(await requiereNivel("Portafolio", "Editar"))) return;

  const actual = await prisma.proyectoPortafolio.findUnique({ where: { id } });
  if (!actual) return;

  const vecino = await prisma.proyectoPortafolio.findFirst({
    where: direccion === "arriba" ? { orden: { lt: actual.orden } } : { orden: { gt: actual.orden } },
    orderBy: { orden: direccion === "arriba" ? "desc" : "asc" },
  });
  if (!vecino) return;

  await prisma.$transaction([
    prisma.proyectoPortafolio.update({ where: { id: actual.id }, data: { orden: vecino.orden } }),
    prisma.proyectoPortafolio.update({ where: { id: vecino.id }, data: { orden: actual.orden } }),
  ]);

  revalidatePortafolio();
}

export type ImagenFormState = { error?: string } | undefined;

export async function subirImagenProyecto(
  proyectoId: number,
  _prevState: ImagenFormState,
  formData: FormData
): Promise<ImagenFormState> {
  if (!(await requiereNivel("Portafolio", "Editar"))) {
    return { error: "No tienes permiso para editar en este módulo." };
  }

  const url = String(formData.get("archivoUrl") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim() || "Captura";
  const tamanioRaw = formData.get("tamanioBytes");
  const tamanioBytes = tamanioRaw ? Number(tamanioRaw) : null;

  if (!url.startsWith("https://")) {
    return { error: "Sube una imagen." };
  }

  const userId = await currentUserId();

  await prisma.archivo.create({
    data: {
      entidadTipo: "Proyecto",
      entidadId: proyectoId,
      nombre,
      url,
      tipo: "Imagen",
      tamanioBytes: tamanioBytes && Number.isFinite(tamanioBytes) ? tamanioBytes : null,
      subidoPorId: userId,
    },
  });

  revalidatePortafolio();
  revalidatePath(`/admin/portafolio/${proyectoId}`);
  return undefined;
}

export async function eliminarImagenProyecto(archivoId: number, proyectoId: number) {
  if (!(await requiereNivel("Portafolio", "Editar"))) return;

  const archivo = await prisma.archivo.findUnique({ where: { id: archivoId } });
  if (archivo?.url.includes(".public.blob.vercel-storage.com")) {
    try {
      await del(archivo.url);
    } catch {
      // Si ya no existe en el store, no bloquea el borrado del registro.
    }
  }
  await prisma.archivo.delete({ where: { id: archivoId } });

  revalidatePortafolio();
  revalidatePath(`/admin/portafolio/${proyectoId}`);
}
