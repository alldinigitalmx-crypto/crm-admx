import { obtenerDatosReportes } from "@/lib/reportes-data";
import { buildExcelResponse } from "@/lib/excel";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;

  const datos = await obtenerDatosReportes(desde, hasta);

  return buildExcelResponse(
    "gastos.xlsx",
    "Gastos",
    [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Descripción", key: "descripcion", width: 32 },
      { header: "Categoría", key: "categoria", width: 22 },
      { header: "Monto", key: "monto", width: 14 },
    ],
    datos.gastosDetalle.map((g) => ({
      fecha: g.fecha,
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: g.monto,
    }))
  );
}
