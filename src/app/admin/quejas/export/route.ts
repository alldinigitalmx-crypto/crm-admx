import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { buildExcelResponse } from "@/lib/excel";
import type { CategoriaQueja, Prisma, StatusQueja } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Quejas");
  if (!permisos.puedeVer) redirect("/admin");

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const categoria = searchParams.get("categoria");
  const clienteId = searchParams.get("clienteId");

  const where: Prisma.QuejaWhereInput = {};
  if (status) where.status = status as StatusQueja;
  if (categoria) where.categoria = categoria as CategoriaQueja;
  if (clienteId) where.clienteId = Number(clienteId);
  if (!permisos.verTodo && usuario) {
    where.OR = [{ asignadoAId: usuario.id }, { servicio: { responsableId: usuario.id } }];
  }

  const quejas = await prisma.queja.findMany({
    where,
    include: { cliente: true, servicio: true },
    orderBy: { creadoEn: "desc" },
  });

  return buildExcelResponse(
    "quejas.xlsx",
    "Quejas",
    [
      { header: "Cliente", key: "cliente", width: 24 },
      { header: "Servicio", key: "servicio", width: 28 },
      { header: "Categoría", key: "categoria", width: 16 },
      { header: "Status", key: "status", width: 14 },
      { header: "Fecha", key: "fecha", width: 14 },
    ],
    quejas.map((q) => ({
      cliente: q.cliente.nombre,
      servicio: q.servicio?.descripcion ?? "",
      categoria: q.categoria,
      status: q.status,
      fecha: q.creadoEn,
    }))
  );
}
