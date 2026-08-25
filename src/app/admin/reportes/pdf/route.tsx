import { createElement } from "react";
import type { ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { requiereAdmin } from "@/lib/alcance";
import { obtenerDatosReportes } from "@/lib/reportes-data";
import { ReportesPdfDocument } from "@/components/reportes/reportes-pdf-document";

export async function GET(request: Request) {
  if (!(await requiereAdmin())) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;

  const datos = await obtenerDatosReportes(desde, hasta);

  const buffer = await renderToBuffer(
    createElement(ReportesPdfDocument, { datos }) as ReactElement<DocumentProps>
  );

  const desdeIso = datos.desdeEfectivo.toISOString().slice(0, 10);
  const hastaIso = datos.hastaEfectivo.toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reporte-${desdeIso}-a-${hastaIso}.pdf"`,
    },
  });
}
