"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requiereNivel, requiereNivelCliente } from "@/lib/alcance";
import { Prisma, type Etiqueta, type MedioCaptacion } from "@/generated/prisma/client";

export type ClienteFormState = { error?: string } | undefined;

function parseClienteForm(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const pais = String(formData.get("pais") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const codigoReferido = String(formData.get("codigoReferido") ?? "").trim() || null;
  const etiquetaRaw = String(formData.get("etiqueta") ?? "");
  const medioCaptacionRaw = String(formData.get("medioCaptacion") ?? "");

  return {
    nombre,
    pais,
    telefono,
    email,
    notas,
    codigoReferido,
    etiqueta: etiquetaRaw && etiquetaRaw !== "none" ? (etiquetaRaw as Etiqueta) : null,
    medioCaptacion:
      medioCaptacionRaw && medioCaptacionRaw !== "none"
        ? (medioCaptacionRaw as MedioCaptacion)
        : null,
  };
}

export async function createCliente(
  _prevState: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  if (!(await requiereNivel("Clientes", "Crear"))) {
    return { error: "No tienes permiso para crear en este módulo." };
  }

  const data = parseClienteForm(formData);
  if (!data.nombre) {
    return { error: "El nombre es obligatorio." };
  }

  let clienteId: number;
  try {
    const cliente = await prisma.cliente.create({ data });
    clienteId = cliente.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese código de referido ya está en uso por otro cliente." };
    }
    throw e;
  }

  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${clienteId}`);
}

export type ClienteRapidoState =
  | { error: string }
  | { cliente: { id: number; nombre: string } }
  | undefined;

// Alta rápida de cliente sin salir de donde se está trabajando — desde el
// formulario de Servicio (queda seleccionado de una vez) o desde una
// cotización de prospecto (queda vinculada). A diferencia de createCliente,
// no redirige: regresa el cliente creado para que el formulario que llamó
// esta acción decida qué hacer con él.
export async function crearClienteRapido(
  vincularCotizacionId: number | null,
  _prevState: ClienteRapidoState,
  formData: FormData
): Promise<ClienteRapidoState> {
  if (!(await requiereNivel("Clientes", "Crear"))) {
    return { error: "No tienes permiso para crear clientes." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre es obligatorio." };
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;

  let cliente;
  try {
    cliente = await prisma.cliente.create({ data: { nombre, telefono, email } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese dato ya está en uso por otro cliente." };
    }
    throw e;
  }

  if (vincularCotizacionId) {
    await prisma.cotizacion.update({
      where: { id: vincularCotizacionId },
      data: { clienteId: cliente.id },
    });
    revalidatePath(`/admin/cotizaciones/${vincularCotizacionId}`);
    revalidatePath("/admin/cotizaciones");
  }

  revalidatePath("/admin/clientes");
  return { cliente: { id: cliente.id, nombre: cliente.nombre } };
}

export async function updateCliente(
  id: number,
  _prevState: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  if (!(await requiereNivelCliente(id, "Editar"))) {
    return { error: "No tienes permiso para editar este cliente." };
  }

  const data = parseClienteForm(formData);
  if (!data.nombre) {
    return { error: "El nombre es obligatorio." };
  }

  try {
    await prisma.cliente.update({ where: { id }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese código de referido ya está en uso por otro cliente." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { error: "Este cliente ya no existe." };
    }
    throw e;
  }

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
  redirect(`/admin/clientes/${id}`);
}

export type PortalFormState = { error?: string } | undefined;

export async function guardarPasswordPortalCliente(
  clienteId: number,
  _prevState: PortalFormState,
  formData: FormData
): Promise<PortalFormState> {
  if (!(await requiereNivelCliente(clienteId, "Editar"))) {
    return { error: "No tienes permiso para editar este cliente." };
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return { error: "Este cliente ya no existe." };
  if (!cliente.email) {
    return { error: "Este cliente no tiene un correo registrado. Agrégalo primero." };
  }

  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.cliente.update({
    where: { id: clienteId },
    data: { passwordHash, portalActivo: true },
  });

  revalidatePath(`/admin/clientes/${clienteId}`);
  return undefined;
}

export async function desactivarPortalCliente(clienteId: number) {
  if (!(await requiereNivelCliente(clienteId, "Editar"))) return;

  await prisma.cliente.update({
    where: { id: clienteId },
    data: { portalActivo: false },
  });

  revalidatePath(`/admin/clientes/${clienteId}`);
}

// Elimina un cliente y todo lo que depende de él (servicios, cotizaciones,
// pagos, tareas/subtareas, quejas y archivos adjuntos). No hay onDelete:
// Cascade en el schema, así que se borra manualmente en el orden correcto
// dentro de una sola transacción. Las ventas donde este cliente aparece solo
// como "referido" (comisión) no se tocan — se les quita la referencia.
export async function eliminarCliente(id: number) {
  if (!(await requiereNivelCliente(id, "Editar"))) return;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: {
      id: true,
      servicios: { select: { id: true } },
      cotizaciones: { select: { id: true } },
      quejas: { select: { id: true } },
    },
  });
  if (!cliente) return;

  const servicioIds = cliente.servicios.map((s) => s.id);
  const cotizacionIds = cliente.cotizaciones.map((c) => c.id);
  const quejaIds = cliente.quejas.map((q) => q.id);

  const [pagos, tareas, ordenesCambio] = await Promise.all([
    prisma.pago.findMany({
      where: {
        OR: [{ servicioId: { in: servicioIds } }, { cotizacionId: { in: cotizacionIds } }],
      },
      select: { id: true },
    }),
    prisma.tarea.findMany({
      where: {
        OR: [{ servicioId: { in: servicioIds } }, { cotizacionId: { in: cotizacionIds } }],
      },
      select: { id: true },
    }),
    prisma.ordenCambio.findMany({
      where: { servicioId: { in: servicioIds } },
      select: { id: true },
    }),
  ]);
  const pagoIds = pagos.map((p) => p.id);
  const tareaIds = tareas.map((t) => t.id);
  const ordenCambioIds = ordenesCambio.map((o) => o.id);

  await prisma.$transaction([
    prisma.subtarea.deleteMany({ where: { tareaId: { in: tareaIds } } }),
    prisma.tarea.deleteMany({ where: { id: { in: tareaIds } } }),
    prisma.archivo.deleteMany({
      where: {
        OR: [
          { entidadTipo: "Servicio", entidadId: { in: servicioIds } },
          { entidadTipo: "Cotizacion", entidadId: { in: cotizacionIds } },
          { entidadTipo: "Queja", entidadId: { in: quejaIds } },
          { entidadTipo: "Pago", entidadId: { in: pagoIds } },
        ],
      },
    }),
    prisma.eventoSistema.deleteMany({
      where: {
        OR: [
          { entidadTipo: "Cotizacion", entidadId: { in: cotizacionIds } },
          { entidadTipo: "Queja", entidadId: { in: quejaIds } },
          { entidadTipo: "Pago", entidadId: { in: pagoIds } },
        ],
      },
    }),
    prisma.pago.deleteMany({ where: { id: { in: pagoIds } } }),
    prisma.queja.deleteMany({ where: { id: { in: quejaIds } } }),
    prisma.cotizacion.deleteMany({ where: { id: { in: cotizacionIds } } }),
    prisma.ordenCambio.deleteMany({ where: { id: { in: ordenCambioIds } } }),
    prisma.servicio.deleteMany({ where: { id: { in: servicioIds } } }),
    prisma.venta.updateMany({ where: { referidoPorId: id }, data: { referidoPorId: null } }),
    prisma.cliente.delete({ where: { id } }),
  ]);

  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  redirect("/admin/clientes");
}
