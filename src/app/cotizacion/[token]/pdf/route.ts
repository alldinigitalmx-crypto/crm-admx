import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";

import { prisma } from "@/lib/prisma";
import { CotizacionPdfDocument } from "@/components/cotizaciones/cotizacion-pdf-document";
import {
  nombreClienteCotizacion,
  montoPagadoCotizacion,
  montoPendienteCotizacion,
  cotizacionQuedaSaldada,
} from "@/lib/cotizacion";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { token },
    include: { servicio: true, cliente: true, pagos: true },
  });

  if (!cotizacion) {
    return new Response("Cotización no encontrada", { status: 404 });
  }

  const montoPagado = montoPagadoCotizacion(cotizacion, cotizacion.pagos);
  const montoPendiente = montoPendienteCotizacion(cotizacion, cotizacion.pagos);
  const pagada = cotizacionQuedaSaldada(cotizacion, cotizacion.pagos);

  const buffer = await renderToBuffer(
    createElement(CotizacionPdfDocument, {
      cotizacion: {
        id: cotizacion.id,
        status: cotizacion.status,
        descripcion: cotizacion.descripcion,
        detalles: cotizacion.detalles,
        montoSubtotal: Number(cotizacion.montoSubtotal),
        descuentoTipo: cotizacion.descuentoTipo,
        descuentoValor: cotizacion.descuentoValor ? Number(cotizacion.descuentoValor) : null,
        descuentoMotivo: cotizacion.descuentoMotivo,
        montoTotal: Number(cotizacion.montoTotal),
        moneda: cotizacion.moneda,
        fechaEmision: cotizacion.fechaEmision,
        fechaVencimiento: cotizacion.fechaVencimiento,
      },
      pago: {
        pagada,
        montoPagado,
        montoPendiente,
        fechaPago: cotizacion.fechaPago,
      },
      servicio: cotizacion.servicio
        ? {
            descripcion: cotizacion.servicio.descripcion,
            detalles: cotizacion.servicio.detalles,
            status: cotizacion.servicio.status,
            fechaInicio: cotizacion.servicio.fechaInicio,
            fechaFin: cotizacion.servicio.fechaFin,
          }
        : null,
      cliente: {
        nombre: nombreClienteCotizacion(cotizacion),
        email: cotizacion.cliente?.email ?? null,
      },
    }) as ReactElement<DocumentProps>
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cotizacion-${cotizacion.id}.pdf"`,
    },
  });
}
