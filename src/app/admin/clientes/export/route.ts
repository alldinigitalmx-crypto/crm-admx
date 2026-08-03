import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { buildExcelResponse } from "@/lib/excel";
import type { Etiqueta, Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Clientes");
  if (!permisos.puedeVer) redirect("/admin");

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const etiqueta = searchParams.get("etiqueta");

  const where: Prisma.ClienteWhereInput = {};
  if (query) {
    where.OR = [
      { nombre: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { pais: { contains: query, mode: "insensitive" } },
    ];
  }
  if (etiqueta === "ninguna") {
    where.etiqueta = null;
  } else if (etiqueta) {
    where.etiqueta = etiqueta as Etiqueta;
  }

  let clientes = await prisma.cliente.findMany({ where, orderBy: { creadoEn: "desc" } });

  if (!permisos.verTodo && usuario) {
    const servicios = await prisma.servicio.findMany({
      where: { responsableId: usuario.id },
      select: { clienteId: true },
    });
    const propios = new Set(servicios.map((s) => s.clienteId));
    clientes = clientes.filter((c) => propios.has(c.id));
  }

  return buildExcelResponse(
    "clientes.xlsx",
    "Clientes",
    [
      { header: "Nombre", key: "nombre", width: 28 },
      { header: "Etiqueta", key: "etiqueta", width: 14 },
      { header: "País", key: "pais", width: 16 },
      { header: "Email", key: "email", width: 28 },
      { header: "Teléfono", key: "telefono", width: 16 },
      { header: "Captación", key: "medioCaptacion", width: 18 },
      { header: "Código referido", key: "codigoReferido", width: 18 },
    ],
    clientes.map((c) => ({
      nombre: c.nombre,
      etiqueta: c.etiqueta ?? "",
      pais: c.pais ?? "",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
      medioCaptacion: c.medioCaptacion ?? "",
      codigoReferido: c.codigoReferido ?? "",
    }))
  );
}
