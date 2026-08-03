import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { buildExcelResponse } from "@/lib/excel";
import type { Prisma, StatusCotizacion } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Cotizaciones");
  if (!permisos.puedeVer) redirect("/admin");

  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get("clienteId");
  const status = searchParams.get("status");

  const where: Prisma.CotizacionWhereInput = {};
  if (clienteId) where.clienteId = Number(clienteId);
  if (status) where.status = status as StatusCotizacion;

  const cotizaciones = await prisma.cotizacion.findMany({
    where,
    include: { cliente: true, servicio: true },
    orderBy: { creadoEn: "desc" },
  });

  return buildExcelResponse(
    "cotizaciones.xlsx",
    "Cotizaciones",
    [
      { header: "Servicio", key: "servicio", width: 32 },
      { header: "Cliente", key: "cliente", width: 24 },
      { header: "Status", key: "status", width: 14 },
      { header: "Emisión", key: "fechaEmision", width: 14 },
      { header: "Vencimiento", key: "fechaVencimiento", width: 14 },
      { header: "Monto", key: "monto", width: 14 },
    ],
    cotizaciones.map((c) => ({
      servicio: c.servicio?.descripcion ?? c.descripcion ?? "",
      cliente: c.cliente.nombre,
      status: c.status,
      fechaEmision: c.fechaEmision,
      fechaVencimiento: c.fechaVencimiento,
      monto: Number(c.montoTotal),
    }))
  );
}
