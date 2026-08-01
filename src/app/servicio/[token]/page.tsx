import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  Cotizado: "Cotizado",
  Aprobado: "Aprobado",
  EnProceso: "En proceso",
  Entregado: "Entregado",
  Cancelado: "Cancelado",
};

export default async function ServicioPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const servicio = await prisma.servicio.findUnique({
    where: { tokenPublico: token },
    include: {
      cliente: true,
      tareas: true,
    },
  });

  if (!servicio) notFound();

  const evidencias = await prisma.archivo.findMany({
    where: { entidadTipo: "Servicio", entidadId: servicio.id },
    orderBy: { creadoEn: "desc" },
  });

  const totalTareas = servicio.tareas.length;
  const tareasCompletadas = servicio.tareas.filter((t) => t.completada).length;
  const avance = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm font-semibold tracking-wide text-blue-600 dark:text-blue-400">
          ADMX DEV
        </p>
        <h1 className="text-2xl font-semibold">{servicio.descripcion}</h1>
        <p className="text-sm text-muted-foreground">Para {servicio.cliente.nombre}</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Estatus del proyecto</CardTitle>
          <Badge variant="outline">{STATUS_LABEL[servicio.status] ?? servicio.status}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {servicio.detalles && <p className="text-muted-foreground">{servicio.detalles}</p>}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-muted-foreground">Avance</span>
              <span className="font-medium">{avance}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
                style={{ width: `${avance}%` }}
              />
            </div>
            {totalTareas > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {tareasCompletadas} de {totalTareas} tareas completadas
              </p>
            )}
          </div>

          <div className="grid gap-2 border-t pt-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Inicio</p>
              <p>{formatDate(servicio.fechaInicio)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Entrega estimada</p>
              <p>{formatDate(servicio.fechaFin)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Evidencia y avances</CardTitle>
        </CardHeader>
        <CardContent>
          {evidencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay evidencia publicada para este proyecto.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {evidencias.map((ev) => (
                <div key={ev.id} className="flex flex-col gap-2 rounded-lg border border-input p-2">
                  {ev.tipo === "Imagen" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- evidencia guardada como dataURL
                    <img
                      src={ev.url}
                      alt={ev.nombre}
                      className="h-40 w-full rounded-md object-cover"
                    />
                  ) : (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-40 items-center justify-center rounded-md bg-muted text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Ver grabación
                    </a>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{ev.nombre}</span>
                    <span className="shrink-0">{formatDate(ev.creadoEn)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
