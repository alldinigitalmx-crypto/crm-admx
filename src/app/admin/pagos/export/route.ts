import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { esAdmin, permisosModulo } from "@/lib/alcance";
import { buildExcelResponse } from "@/lib/excel";
import type { MetodoPago, Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Pagos");
  if (!permisos.puedeVer) redirect("/admin");

  const { searchParams } = new URL(request.url);
  const servicioId = searchParams.get("servicioId");
  const metodoPago = searchParams.get("metodoPago");
  const confirmado = searchParams.get("confirmado");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: Prisma.PagoWhereInput = {};
  if (servicioId) where.servicioId = Number(servicioId);
  if (metodoPago) where.metodoPago = metodoPago as MetodoPago;
  if (confirmado) where.confirmado = confirmado === "true";
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }
  if (!permisos.verTodo && usuario) where.servicio = { responsableId: usuario.id };

  const esAdminUsuario = esAdmin(usuario);
  const pagos = await prisma.pago.findMany({
    where,
    include: { servicio: { include: { cliente: true } }, cuenta: true },
    orderBy: { fecha: "desc" },
  });

  return buildExcelResponse(
    "pagos.xlsx",
    "Pagos",
    [
      { header: "Servicio", key: "servicio", width: 28 },
      { header: "Cliente", key: "cliente", width: 24 },
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Método", key: "metodoPago", width: 16 },
      { header: "Cuenta", key: "cuenta", width: 16 },
      { header: "Status", key: "status", width: 14 },
      { header: "Comisión", key: "comision", width: 14 },
      { header: "Monto", key: "monto", width: 14 },
    ],
    pagos.map((p) => ({
      servicio: p.servicio.descripcion,
      cliente: p.servicio.cliente.nombre,
      fecha: p.fecha,
      metodoPago: p.metodoPago,
      cuenta: esAdminUsuario ? (p.cuenta?.alias ?? p.cuentaTexto ?? "") : "",
      status: p.confirmado ? "Confirmado" : "Pendiente",
      comision: p.comision ? Number(p.comision) : 0,
      monto: Number(p.monto),
    }))
  );
}
