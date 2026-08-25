import { requiereAdmin } from "@/lib/alcance";
import { obtenerDatosReportes } from "@/lib/reportes-data";
import { buildMultiSheetExcelResponse } from "@/lib/excel";

// Un solo Excel con dos pestañas (Ingresos / Gastos) para el mismo rango
// de fechas — antes eran dos descargas sueltas.
export async function GET(request: Request) {
  if (!(await requiereAdmin())) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;

  const datos = await obtenerDatosReportes(desde, hasta);

  return buildMultiSheetExcelResponse("reportes.xlsx", [
    {
      name: "Ingresos",
      columns: [
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Servicio", key: "servicio", width: 32 },
        { header: "Cliente", key: "cliente", width: 26 },
        { header: "Método", key: "metodoPago", width: 18 },
        { header: "Monto", key: "monto", width: 14 },
      ],
      rows: datos.pagosDetalle.map((p) => ({
        fecha: p.fecha,
        servicio: p.servicio,
        cliente: p.cliente,
        metodoPago: p.metodoPago,
        monto: p.monto,
      })),
    },
    {
      name: "Gastos",
      columns: [
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Descripción", key: "descripcion", width: 32 },
        { header: "Categoría", key: "categoria", width: 22 },
        { header: "Monto", key: "monto", width: 14 },
      ],
      rows: datos.gastosDetalle.map((g) => ({
        fecha: g.fecha,
        descripcion: g.descripcion,
        categoria: g.categoria,
        monto: g.monto,
      })),
    },
  ]);
}
