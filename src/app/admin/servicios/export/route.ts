import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { buildExcelResponse } from "@/lib/excel";
import { montoTotalServicio, montoPendienteServicio } from "@/lib/servicio";
import type { Prisma, StatusServicio } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Servicios");
  if (!permisos.puedeVer) redirect("/admin");

  const { searchParams } = new URL(request.url);
  const clienteIds = searchParams.getAll("clienteId");
  const statuses = searchParams.getAll("status");
  const intermediarioIds = searchParams.getAll("intermediarioId");

  const where: Prisma.ServicioWhereInput = {};
  if (clienteIds.length) where.clienteId = { in: clienteIds.map(Number) };
  if (statuses.length) where.status = { in: statuses as StatusServicio[] };
  if (intermediarioIds.length) where.intermediarioId = { in: intermediarioIds.map(Number) };
  if (!permisos.verTodo && usuario) where.responsableId = usuario.id;

  const servicios = await prisma.servicio.findMany({
    where,
    include: {
      cliente: true,
      intermediario: true,
      ordenesCambio: true,
      pagos: { select: { monto: true, confirmado: true, moneda: true } },
    },
    orderBy: { creadoEn: "desc" },
  });

  return buildExcelResponse(
    "servicios.xlsx",
    "Servicios",
    [
      { header: "Descripción", key: "descripcion", width: 32 },
      { header: "Cliente", key: "cliente", width: 24 },
      { header: "Status", key: "status", width: 14 },
      { header: "Intermediario", key: "intermediario", width: 20 },
      { header: "Inicio", key: "fechaInicio", width: 14 },
      { header: "Monto", key: "monto", width: 14 },
      { header: "Pendiente", key: "pendiente", width: 14 },
      { header: "Moneda", key: "moneda", width: 12 },
    ],
    servicios.map((s) => ({
      descripcion: s.descripcion,
      cliente: s.cliente.nombre,
      status: s.status,
      intermediario: s.intermediario?.nombre ?? "",
      fechaInicio: s.fechaInicio,
      monto: montoTotalServicio(s),
      pendiente: montoPendienteServicio(s, s.pagos),
      moneda: s.moneda ?? "MXN",
    }))
  );
}
