import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/lib/evento";

// Garantiza que la cotización tenga un Servicio al que anclar un pago, sin
// obligar a un admin a dar clic en "Convertir en servicio" primero. Si ya
// tiene uno, lo regresa tal cual; si no, lo crea al vuelo (mismos datos que
// la conversión manual) justo en el momento en que el cliente intenta
// pagar — así una negociación que nunca se cierra no deja un Servicio
// huérfano que luego haya que borrar a mano.
//
// Solo falla (regresa null) cuando la cotización sigue siendo de un
// prospecto sin cliente registrado: un Servicio siempre necesita un
// cliente real al que pertenecer.
//
// Este módulo toca Prisma a propósito y por eso vive separado de
// @/lib/cotizacion (funciones puras que también importan componentes
// cliente) — solo debe usarse desde server actions y route handlers.
export async function asegurarServicioParaCotizacion(
  cotizacionId: number,
  actorId?: number | null
): Promise<number | null> {
  const cotizacion = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!cotizacion) return null;
  if (cotizacion.servicioId) return cotizacion.servicioId;
  if (!cotizacion.clienteId) return null;

  const servicio = await prisma.servicio.create({
    data: {
      clienteId: cotizacion.clienteId,
      descripcion: cotizacion.descripcion ?? `Cotización #${cotizacion.id}`,
      detalles: cotizacion.detalles,
      montoInicial: cotizacion.montoTotal,
      moneda: cotizacion.moneda,
      fechaInicio: new Date(),
      status: "Aprobado",
      creadoPorId: actorId ?? null,
      editadoPorId: actorId ?? null,
    },
  });

  await prisma.cotizacion.update({
    where: { id: cotizacionId },
    data: { servicioId: servicio.id },
  });

  await registrarEvento("cotizacion.convertida_en_servicio", "Cotizacion", cotizacionId, {
    servicioId: servicio.id,
    automatico: true,
  });

  return servicio.id;
}
