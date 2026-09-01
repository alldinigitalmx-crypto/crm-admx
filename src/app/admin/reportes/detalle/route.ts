import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requiereAdmin } from "@/lib/alcance";
import { formatCurrency, formatDate } from "@/lib/format";
import { montoNetoEnMXN } from "@/lib/pago-monto";
import { montoTotalServicio } from "@/lib/servicio";
import type { Prisma } from "@/generated/prisma/client";

// Alimenta el modal "Ver detalles" de cada tarjeta de Reportes -- por
// diseño repite exactamente el mismo criterio (campo de fecha, status,
// ámbito) que ya usa reportes-data.ts para esa cifra, para que lo que se
// ve en el modal nunca desentone del número de la tarjeta que lo abrió.
// Se topa a MAX_FILAS: para rangos grandes el modal es para dar un
// vistazo rápido, no para reemplazar el listado completo -- para eso
// sigue estando el botón de Exportar Excel (sin tope) de cada módulo.
const MAX_FILAS = 200;

type Fila = Record<string, string>;
// "ancha" marca las columnas de texto libre (descripción/nombre/email)
// que en la tabla de escritorio deben poder partirse en varias líneas en
// vez de forzar todo el modal a ensancharse hasta desbordar y necesitar
// scroll lateral (ver DetalleDialog).
type Respuesta = {
  columnas: { key: string; label: string; ancha?: boolean }[];
  filas: Fila[];
  totalCount: number;
  truncado: boolean;
};

export async function GET(request: Request) {
  if (!(await requiereAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const rango: Prisma.DateTimeFilter = {
    ...(desde ? { gte: new Date(`${desde}T00:00:00`) } : {}),
    ...(hasta ? { lte: new Date(`${hasta}T23:59:59.999`) } : {}),
  };

  let respuesta: Respuesta;

  switch (tipo) {
    case "pagos": {
      const where: Prisma.PagoWhereInput = { confirmado: true, fecha: rango };
      const [totalCount, pagos] = await Promise.all([
        prisma.pago.count({ where }),
        prisma.pago.findMany({
          where,
          orderBy: { fecha: "desc" },
          take: MAX_FILAS,
          select: {
            fecha: true,
            metodoPago: true,
            monto: true,
            moneda: true,
            montoMXN: true,
            comision: true,
            montoIncluyeComision: true,
            servicio: { select: { descripcion: true, cliente: { select: { nombre: true } } } },
          },
        }),
      ]);
      respuesta = {
        columnas: [
          { key: "fecha", label: "Fecha" },
          { key: "servicio", label: "Servicio", ancha: true },
          { key: "cliente", label: "Cliente", ancha: true },
          { key: "metodoPago", label: "Método" },
          { key: "monto", label: "Monto (neto)" },
        ],
        filas: pagos.map((p) => ({
          fecha: formatDate(p.fecha),
          servicio: p.servicio.descripcion,
          cliente: p.servicio.cliente.nombre,
          metodoPago: p.metodoPago,
          monto: formatCurrency(montoNetoEnMXN(p)),
        })),
        totalCount,
        truncado: totalCount > pagos.length,
      };
      break;
    }
    case "gastos-empresa":
    case "gastos-personal": {
      const ambito = tipo === "gastos-empresa" ? "Empresa" : "Personal";
      const where: Prisma.GastoWhereInput = { ambito, fecha: rango };
      const [totalCount, gastos] = await Promise.all([
        prisma.gasto.count({ where }),
        prisma.gasto.findMany({
          where,
          orderBy: { fecha: "desc" },
          take: MAX_FILAS,
          select: { fecha: true, descripcion: true, categoria: true, monto: true },
        }),
      ]);
      respuesta = {
        columnas: [
          { key: "fecha", label: "Fecha" },
          { key: "descripcion", label: "Descripción", ancha: true },
          { key: "categoria", label: "Categoría" },
          { key: "monto", label: "Monto" },
        ],
        filas: gastos.map((g) => ({
          fecha: formatDate(g.fecha),
          descripcion: g.descripcion,
          categoria: g.categoria,
          monto: formatCurrency(g.monto),
        })),
        totalCount,
        truncado: totalCount > gastos.length,
      };
      break;
    }
    case "servicios-entregados":
    case "servicios-nuevos": {
      // "Entregado" se cuenta por fecha de fin; el resto ("nuevos") por
      // fecha de inicio -- mismo criterio que serviciosEntregadosWhere /
      // serviciosNuevosWhere en reportes-data.ts.
      const where: Prisma.ServicioWhereInput =
        tipo === "servicios-entregados" ? { status: "Entregado", fechaFin: rango } : { fechaInicio: rango };
      const [totalCount, servicios] = await Promise.all([
        prisma.servicio.count({ where }),
        prisma.servicio.findMany({
          where,
          orderBy: tipo === "servicios-entregados" ? { fechaFin: "desc" } : { fechaInicio: "desc" },
          take: MAX_FILAS,
          include: { cliente: true, ordenesCambio: true },
        }),
      ]);
      respuesta = {
        columnas: [
          { key: "fecha", label: tipo === "servicios-entregados" ? "Fecha fin" : "Fecha inicio" },
          { key: "descripcion", label: "Servicio", ancha: true },
          { key: "cliente", label: "Cliente", ancha: true },
          { key: "status", label: "Status" },
          { key: "monto", label: "Monto" },
        ],
        filas: servicios.map((s) => ({
          fecha: formatDate(tipo === "servicios-entregados" ? s.fechaFin : s.fechaInicio),
          descripcion: s.descripcion,
          cliente: s.cliente.nombre,
          status: s.status,
          monto: formatCurrency(montoTotalServicio(s), s.moneda),
        })),
        totalCount,
        truncado: totalCount > servicios.length,
      };
      break;
    }
    case "clientes-nuevos": {
      const where: Prisma.ClienteWhereInput = { creadoEn: rango };
      const [totalCount, clientes] = await Promise.all([
        prisma.cliente.count({ where }),
        prisma.cliente.findMany({
          where,
          orderBy: { creadoEn: "desc" },
          take: MAX_FILAS,
          select: { nombre: true, email: true, pais: true, etiqueta: true, creadoEn: true },
        }),
      ]);
      respuesta = {
        columnas: [
          { key: "fecha", label: "Alta" },
          { key: "nombre", label: "Nombre", ancha: true },
          { key: "email", label: "Email", ancha: true },
          { key: "pais", label: "País" },
          { key: "etiqueta", label: "Etiqueta" },
        ],
        filas: clientes.map((c) => ({
          fecha: formatDate(c.creadoEn),
          nombre: c.nombre,
          email: c.email ?? "—",
          pais: c.pais ?? "—",
          etiqueta: c.etiqueta ?? "—",
        })),
        totalCount,
        truncado: totalCount > clientes.length,
      };
      break;
    }
    default:
      return NextResponse.json({ error: "Tipo de detalle desconocido." }, { status: 400 });
  }

  return NextResponse.json(respuesta);
}
