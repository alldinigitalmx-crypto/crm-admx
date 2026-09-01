import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { buildExcelResponse } from "@/lib/excel";
import { montoTotalServicio } from "@/lib/servicio";
import type { Prisma, StatusServicio } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Servicios");
  if (!permisos.puedeVer) redirect("/admin");

  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get("clienteId");
  const status = searchParams.get("status");
  const intermediarioId = searchParams.get("intermediarioId");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: Prisma.ServicioWhereInput = {};
  if (clienteId) where.clienteId = Number(clienteId);
  if (status) where.status = status as StatusServicio;
  if (intermediarioId) where.intermediarioId = Number(intermediarioId);
  if (desde || hasta) {
    // Mismo criterio que la página: "Entregado" se cuenta por fecha de fin
    // (ver serviciosEntregadosWhere en reportes-data.ts).
    const campoFecha = status === "Entregado" ? "fechaFin" : "fechaInicio";
    where[campoFecha] = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }
  if (!permisos.verTodo && usuario) where.responsableId = usuario.id;

  const servicios = await prisma.servicio.findMany({
    where,
    include: { cliente: true, intermediario: true, ordenesCambio: true },
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
      { header: "Moneda", key: "moneda", width: 12 },
    ],
    servicios.map((s) => ({
      descripcion: s.descripcion,
      cliente: s.cliente.nombre,
      status: s.status,
      intermediario: s.intermediario?.nombre ?? "",
      fechaInicio: s.fechaInicio,
      monto: montoTotalServicio(s),
      moneda: s.moneda ?? "MXN",
    }))
  );
}
