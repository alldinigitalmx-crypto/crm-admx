import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { crearOrdenPaypal, paypalConfigurado } from "@/lib/paypal";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const origin = new URL(request.url).origin;
  const volver = (query: string) => NextResponse.redirect(`${origin}/cotizacion/${token}${query}`);

  if (!paypalConfigurado()) {
    return volver("?pp=no_configurado");
  }

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { token },
    include: { servicio: true },
  });
  if (!cotizacion) {
    return new Response("Cotización no encontrada", { status: 404 });
  }
  if (cotizacion.status === "Pagada") {
    return volver("");
  }
  if (!cotizacion.servicioId) {
    return volver("?pp=sin_servicio");
  }

  const descripcion = cotizacion.servicio?.descripcion ?? cotizacion.descripcion ?? `Cotización #${cotizacion.id}`;

  try {
    const orden = await crearOrdenPaypal({
      titulo: descripcion,
      monto: Number(cotizacion.montoTotal),
      externalReference: token,
      returnUrl: `${origin}/cotizacion/${token}/paypal-retorno`,
      cancelUrl: `${origin}/cotizacion/${token}?pp=cancelado`,
    });

    return NextResponse.redirect(orden.approveUrl);
  } catch (e) {
    console.error("Error creando orden de PayPal:", e);
    return volver("?pp=error");
  }
}
