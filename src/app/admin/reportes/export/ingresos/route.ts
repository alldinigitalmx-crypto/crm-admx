import { obtenerDatosReportes } from "@/lib/reportes-data";
import { buildExcelResponse } from "@/lib/excel";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;

  const datos = await obtenerDatosReportes(desde, hasta);

  return buildExcelResponse(
    "ingresos.xlsx",
    "Ingresos",
    [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Servicio", key: "servicio", width: 32 },
      { header: "Cliente", key: "cliente", width: 26 },
      { header: "Método", key: "metodoPago", width: 18 },
      { header: "Monto", key: "monto", width: 14 },
    ],
    datos.pagosDetalle.map((p) => ({
      fecha: p.fecha,
      servicio: p.servicio,
      cliente: p.cliente,
      metodoPago: p.metodoPago,
      monto: p.monto,
    }))
  );
}
