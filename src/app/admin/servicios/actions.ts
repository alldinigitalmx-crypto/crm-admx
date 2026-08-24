"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { requiereNivel, requiereNivelServicio } from "@/lib/alcance";
import { Prisma, type StatusServicio } from "@/generated/prisma/client";

export type ServicioFormState = { error?: string } | undefined;
export type OrdenCambioFormState = { error?: string; success?: boolean } | undefined;

async function currentUserId() {
  const usuario = await currentUsuario();
  return usuario?.id ?? null;
}

function parseServicioForm(formData: FormData) {
  const clienteIdRaw = String(formData.get("clienteId") ?? "");
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const detalles = String(formData.get("detalles") ?? "").trim() || null;
  const fechaInicioRaw = String(formData.get("fechaInicio") ?? "");
  const fechaFinRaw = String(formData.get("fechaFin") ?? "");
  const montoInicialRaw = String(formData.get("montoInicial") ?? "");
  const statusRaw = String(formData.get("status") ?? "Cotizado");
  const intermediarioIdRaw = String(formData.get("intermediarioId") ?? "");
  const porcentajeRaw = String(formData.get("porcentajeIntermediario") ?? "");
  const responsableIdRaw = String(formData.get("responsableId") ?? "");

  const tieneIntermediario = intermediarioIdRaw && intermediarioIdRaw !== "none";

  return {
    clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
    descripcion,
    detalles,
    fechaInicio: fechaInicioRaw ? new Date(fechaInicioRaw) : null,
    fechaFin: fechaFinRaw ? new Date(fechaFinRaw) : null,
    montoInicial: montoInicialRaw,
    status: statusRaw as StatusServicio,
    intermediarioId: tieneIntermediario ? Number(intermediarioIdRaw) : null,
    porcentajeIntermediario: tieneIntermediario && porcentajeRaw ? porcentajeRaw : null,
    responsableId: responsableIdRaw ? Number(responsableIdRaw) : null,
  };
}

function validateServicioForm(data: ReturnType<typeof parseServicioForm>) {
  if (!data.clienteId) return "Selecciona un cliente.";
  if (!data.descripcion) return "La descripción es obligatoria.";
  if (!data.fechaInicio) return "La fecha de inicio es obligatoria.";
  if (!data.montoInicial || Number.isNaN(Number(data.montoInicial)) || Number(data.montoInicial) < 0) {
    return "El monto inicial debe ser un número válido.";
  }
  return null;
}

export async function createServicio(
  _prevState: ServicioFormState,
  formData: FormData
): Promise<ServicioFormState> {
  if (!(await requiereNivel("Servicios", "Crear"))) {
    return { error: "No tienes permiso para crear en este módulo." };
  }

  const data = parseServicioForm(formData);
  const error = validateServicioForm(data);
  if (error) return { error };

  const userId = await currentUserId();

  let servicioId: number;
  try {
    const servicio = await prisma.servicio.create({
      data: {
        clienteId: data.clienteId!,
        descripcion: data.descripcion,
        detalles: data.detalles,
        fechaInicio: data.fechaInicio!,
        fechaFin: data.fechaFin,
        montoInicial: data.montoInicial,
        status: data.status,
        intermediarioId: data.intermediarioId,
        porcentajeIntermediario: data.porcentajeIntermediario,
        responsableId: data.responsableId ?? userId,
        creadoPorId: userId,
        editadoPorId: userId,
      },
    });
    servicioId = servicio.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return { error: "No se pudo crear el servicio. Verifica los datos." };
    }
    throw e;
  }

  revalidatePath("/admin/servicios");
  revalidatePath("/admin");
  redirect(`/admin/servicios/${servicioId}`);
}

export async function updateServicio(
  id: number,
  _prevState: ServicioFormState,
  formData: FormData
): Promise<ServicioFormState> {
  if (!(await requiereNivelServicio(id, "Editar"))) {
    return { error: "No tienes permiso para editar este servicio." };
  }

  const data = parseServicioForm(formData);
  const error = validateServicioForm(data);
  if (error) return { error };

  const userId = await currentUserId();

  try {
    await prisma.servicio.update({
      where: { id },
      data: {
        clienteId: data.clienteId!,
        descripcion: data.descripcion,
        detalles: data.detalles,
        fechaInicio: data.fechaInicio!,
        fechaFin: data.fechaFin,
        montoInicial: data.montoInicial,
        status: data.status,
        intermediarioId: data.intermediarioId,
        porcentajeIntermediario: data.porcentajeIntermediario,
        responsableId: data.responsableId,
        editadoPorId: userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { error: "Este servicio ya no existe." };
    }
    throw e;
  }

  revalidatePath("/admin/servicios");
  revalidatePath(`/admin/servicios/${id}`);
  revalidatePath("/admin");
  redirect(`/admin/servicios/${id}`);
}

export async function createOrdenCambio(
  servicioId: number,
  _prevState: OrdenCambioFormState,
  formData: FormData
): Promise<OrdenCambioFormState> {
  if (!(await requiereNivelServicio(servicioId, "Editar"))) {
    return { error: "No tienes permiso para editar este servicio." };
  }

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const montoRaw = String(formData.get("monto") ?? "");

  if (!descripcion) return { error: "La descripción es obligatoria." };
  if (!montoRaw || Number.isNaN(Number(montoRaw)) || Number(montoRaw) <= 0) {
    return { error: "El monto debe ser un número mayor a cero." };
  }

  await prisma.ordenCambio.create({
    data: { servicioId, descripcion, monto: montoRaw },
  });

  revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function aprobarOrdenCambio(ordenId: number, servicioId: number) {
  if (!(await requiereNivelServicio(servicioId, "Editar"))) return;

  const userId = await currentUserId();

  await prisma.ordenCambio.update({
    where: { id: ordenId },
    data: { status: "Aprobada", aprobadoPorId: userId, aprobadoEn: new Date() },
  });

  revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin");
}

export async function rechazarOrdenCambio(ordenId: number, servicioId: number) {
  if (!(await requiereNivelServicio(servicioId, "Editar"))) return;

  const userId = await currentUserId();

  await prisma.ordenCambio.update({
    where: { id: ordenId },
    data: { status: "Rechazada", aprobadoPorId: userId, aprobadoEn: new Date() },
  });

  revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin");
}

export type EvidenciaFormState = { error?: string } | undefined;

export async function subirEvidencia(
  servicioId: number,
  _prevState: EvidenciaFormState,
  formData: FormData
): Promise<EvidenciaFormState> {
  if (!(await requiereNivelServicio(servicioId, "Editar"))) {
    return { error: "No tienes permiso para editar este servicio." };
  }

  const tipoInput = String(formData.get("tipoEvidencia") ?? "imagen");
  const titulo = String(formData.get("titulo") ?? "").trim();

  const userId = await currentUserId();

  if (tipoInput === "video") {
    const url = String(formData.get("videoUrl") ?? "").trim();
    if (!url.startsWith("http")) {
      return { error: "Pega una liga válida (Loom, Drive, YouTube, etc.)." };
    }
    await prisma.archivo.create({
      data: {
        entidadTipo: "Servicio",
        entidadId: servicioId,
        nombre: titulo || "Grabación",
        url,
        tipo: "Video",
        subidoPorId: userId,
      },
    });
  } else {
    const dataUrl = String(formData.get("imagen") ?? "");
    if (!dataUrl.startsWith("data:image")) {
      return { error: "Selecciona una imagen." };
    }
    await prisma.archivo.create({
      data: {
        entidadTipo: "Servicio",
        entidadId: servicioId,
        nombre: titulo || "Evidencia",
        url: dataUrl,
        tipo: "Imagen",
        subidoPorId: userId,
      },
    });
  }

  revalidatePath(`/admin/servicios/${servicioId}`);
  return undefined;
}

export async function eliminarEvidencia(archivoId: number, servicioId: number) {
  if (!(await requiereNivelServicio(servicioId, "Editar"))) return;

  await prisma.archivo.delete({ where: { id: archivoId } });
  revalidatePath(`/admin/servicios/${servicioId}`);
}

export async function eliminarServicio(id: number) {
  if (!(await requiereNivelServicio(id, "Editar"))) return;

  const servicio = await prisma.servicio.findUnique({
    where: { id },
    select: {
      id: true,
      pagos: { select: { id: true } },
      ordenesCambio: { select: { id: true } },
      tareas: { select: { id: true } },
      cotizaciones: { select: { id: true } },
    },
  });
  if (!servicio) return;

  const pagoIds = servicio.pagos.map((p) => p.id);
  const ordenCambioIds = servicio.ordenesCambio.map((o) => o.id);
  const tareaIds = servicio.tareas.map((t) => t.id);
  const cotizacionIds = servicio.cotizaciones.map((c) => c.id);

  await prisma.$transaction([
    prisma.subtarea.deleteMany({ where: { tareaId: { in: tareaIds } } }),
    prisma.tarea.deleteMany({ where: { id: { in: tareaIds } } }),
    prisma.archivo.deleteMany({
      where: {
        OR: [
          { entidadTipo: "Servicio", entidadId: id },
          { entidadTipo: "Pago", entidadId: { in: pagoIds } },
        ],
      },
    }),
    prisma.eventoSistema.deleteMany({
      where: { entidadTipo: "Pago", entidadId: { in: pagoIds } },
    }),
    prisma.pago.deleteMany({ where: { id: { in: pagoIds } } }),
    prisma.ordenCambio.deleteMany({ where: { id: { in: ordenCambioIds } } }),
    // Las cotizaciones son documentos propios del cliente — se conservan,
    // solo se desvinculan de este servicio (queda como si aún no se
    // hubiera convertido en servicio).
    prisma.cotizacion.updateMany({
      where: { id: { in: cotizacionIds } },
      data: { servicioId: null },
    }),
    prisma.servicio.delete({ where: { id } }),
  ]);

  revalidatePath("/admin/servicios");
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin");
  redirect("/admin/servicios");
}
