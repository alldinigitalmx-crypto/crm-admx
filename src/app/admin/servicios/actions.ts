"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma, type StatusServicio } from "@/generated/prisma/client";

export type ServicioFormState = { error?: string } | undefined;
export type OrdenCambioFormState = { error?: string; success?: boolean } | undefined;

async function currentUserId() {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
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
  const userId = await currentUserId();

  await prisma.ordenCambio.update({
    where: { id: ordenId },
    data: { status: "Aprobada", aprobadoPorId: userId, aprobadoEn: new Date() },
  });

  revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin");
}

export async function rechazarOrdenCambio(ordenId: number, servicioId: number) {
  const userId = await currentUserId();

  await prisma.ordenCambio.update({
    where: { id: ordenId },
    data: { status: "Rechazada", aprobadoPorId: userId, aprobadoEn: new Date() },
  });

  revalidatePath(`/admin/servicios/${servicioId}`);
  revalidatePath("/admin");
}
