import { requiereAdmin } from "@/lib/alcance";
import {
  obtenerDatosReportes,
  filasComparativa,
  etiquetaComparacion,
} from "@/lib/reportes-data";
import { buildMultiSheetExcelResponse, type ExcelSheet } from "@/lib/excel";
import { calcularDelta } from "@/lib/reportes";

// Un solo Excel con dos pestañas (Ingresos / Gastos) para el mismo rango
// de fechas — antes eran dos descargas sueltas.
export async function GET(request: Request) {
  if (!(await requiereAdmin())) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const compararRaw = searchParams.get("comparar");
  const comparar =
    compararRaw === "anterior" || compararRaw === "año" ? compararRaw : undefined;

  const datos = await obtenerDatosReportes(desde, hasta, comparar);

  const filasComp = filasComparativa(datos);
  const hojaComparativa: ExcelSheet[] =
    filasComp && datos.comparacion
      ? [
          {
            name: "Comparativa",
            columns: [
              { header: "Métrica", key: "metrica", width: 24 },
              { header: "Actual", key: "actual", width: 16 },
              { header: etiquetaComparacion(datos.comparacion.modo), key: "previo", width: 18 },
              { header: "Variación %", key: "variacion", width: 14 },
            ],
            rows: filasComp.map((f) => {
              const d = calcularDelta(f.actual, f.previo);
              return {
                metrica: f.metrica,
                actual: f.actual,
                previo: f.previo,
                variacion: d.pct === null ? "nuevo" : `${d.pct > 0 ? "+" : ""}${d.pct.toFixed(1)}%`,
              };
            }),
          },
        ]
      : [];

  return buildMultiSheetExcelResponse("reportes.xlsx", [
    ...hojaComparativa,
    {
      name: "Ingresos",
      columns: [
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Servicio", key: "servicio", width: 32 },
        { header: "Cliente", key: "cliente", width: 26 },
        { header: "Método", key: "metodoPago", width: 18 },
        { header: "Monto neto (MXN)", key: "monto", width: 16 },
        { header: "Comisión pasarela (MXN)", key: "comisionMXN", width: 20 },
        { header: "Moneda original", key: "monedaOriginal", width: 15 },
        { header: "Monto original", key: "montoOriginal", width: 15 },
      ],
      rows: datos.pagosDetalle.map((p) => ({
        fecha: p.fecha,
        servicio: p.servicio,
        cliente: p.cliente,
        metodoPago: p.metodoPago,
        monto: p.monto,
        comisionMXN: p.comisionMXN || "",
        monedaOriginal: p.monedaOriginal ?? "",
        montoOriginal: p.montoOriginal ?? "",
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
    {
      // Aparte de "Gastos" a propósito -- son personales, no del negocio
      // (no cuentan para la utilidad neta).
      name: "Gastos personales",
      columns: [
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Descripción", key: "descripcion", width: 32 },
        { header: "Categoría", key: "categoria", width: 22 },
        { header: "Monto", key: "monto", width: 14 },
      ],
      rows: datos.gastosPersonalesDetalle.map((g) => ({
        fecha: g.fecha,
        descripcion: g.descripcion,
        categoria: g.categoria,
        monto: g.monto,
      })),
    },
  ]);
}
