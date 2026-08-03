import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { buildExcelResponse } from "@/lib/excel";
import type { CanalVenta, OrigenVenta, Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Ventas");
  if (!permisos.puedeVer) redirect("/admin");

  const { searchParams } = new URL(request.url);
  const origen = searchParams.get("origen");
  const canal = searchParams.get("canal");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: Prisma.VentaWhereInput = {};
  if (origen) where.origen = origen as OrigenVenta;
  if (canal) where.canal = canal as CanalVenta;
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }

  const ventas = await prisma.venta.findMany({
    where,
    include: { referidoPor: true },
    orderBy: { fecha: "desc" },
  });

  return buildExcelResponse(
    "ventas.xlsx",
    "Ventas",
    [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Comprador", key: "comprador", width: 24 },
      { header: "Origen", key: "origen", width: 16 },
      { header: "Canal", key: "canal", width: 18 },
      { header: "Referido por", key: "referidoPor", width: 22 },
      { header: "Total", key: "total", width: 14 },
    ],
    ventas.map((v) => ({
      fecha: v.fecha,
      comprador: v.nombreComprador ?? "",
      origen: v.origen === "TiendaOnline" ? "Tienda Online" : "Manual",
      canal: v.canal ?? "",
      referidoPor: v.referidoPor?.nombre ?? "",
      total: Number(v.total),
    }))
  );
}
