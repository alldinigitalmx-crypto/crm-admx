import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requiereAdmin } from "@/lib/alcance";
import { buildExcelResponse } from "@/lib/excel";
import type { AmbitoGasto, Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  if (!(await requiereAdmin())) redirect("/admin");

  const { searchParams } = new URL(request.url);
  const ambito = searchParams.get("ambito");
  const categoria = searchParams.get("categoria");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: Prisma.GastoWhereInput = {};
  if (ambito) where.ambito = ambito as AmbitoGasto;
  if (categoria) where.categoria = categoria;
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }

  const gastos = await prisma.gasto.findMany({
    where,
    include: { cuenta: true },
    orderBy: { fecha: "desc" },
  });

  return buildExcelResponse(
    "gastos.xlsx",
    "Gastos",
    [
      { header: "Descripción", key: "descripcion", width: 32 },
      { header: "Categoría", key: "categoria", width: 22 },
      { header: "Ámbito", key: "ambito", width: 14 },
      { header: "Cuenta", key: "cuenta", width: 16 },
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Método", key: "metodoPago", width: 16 },
      { header: "Monto", key: "monto", width: 14 },
      { header: "Notas", key: "notas", width: 28 },
    ],
    gastos.map((g) => ({
      descripcion: g.descripcion,
      categoria: g.categoria,
      ambito: g.ambito,
      cuenta: g.cuenta?.alias ?? "",
      fecha: g.fecha,
      metodoPago: g.metodoPago ?? "",
      monto: Number(g.monto),
      notas: g.notas ?? "",
    }))
  );
}
