import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Film, ImageIcon, CircleCheck, Receipt } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { calcularAvance, montoTotalServicio, montoPagadoServicio, montoPendienteServicio, estadoSaldoServicio } from "@/lib/servicio";
import { METODO_LABEL } from "@/lib/metodo-pago";
import { SERVICIO_STATUS_COLOR, PRIORIDAD_BAR } from "@/lib/status-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { ThemedLogo } from "@/components/themed-logo";
import { QuejaFormPublica } from "@/components/quejas/queja-form-publica";
import { crearQuejaPublica } from "@/app/servicio/actions";

const STATUS_LABEL: Record<string, string> = {
  Cotizado: "Cotizado",
  Aprobado: "Aprobado",
  EnProceso: "En proceso",
  Entregado: "Entregado",
  Cancelado: "Cancelado",
};

// Para que la liga externa diga algo más útil que "Ver grabación" cuando
// se puede saber de dónde viene.
function origenVideo(url: string) {
  if (url.includes("loom.com")) return "Ver en Loom";
  if (url.includes("drive.google.com")) return "Ver en Google Drive";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "Ver en YouTube";
  return "Ver grabación";
}

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
      ordenesCambio: { select: { status: true, monto: true } },
      // Solo lo que le importa al cliente (fecha, método, cuánto pagó) --
      // nada de comisión de pasarela, cuenta bancaria ni comprobantes
      // internos. Y solo pagos ya confirmados: uno reportado pero sin
      // confirmar todavía no cuenta como "ya pagaste esto".
      pagos: {
        where: { confirmado: true },
        orderBy: { fecha: "desc" },
        select: { fecha: true, monto: true, moneda: true, metodoPago: true, confirmado: true },
      },
    },
  });

  if (!servicio) notFound();

  const montoTotal = montoTotalServicio(servicio);
  // Cuánto sumaron las órdenes de cambio ya aprobadas -- el "extra" que
  // no estaba en el valor inicial. Solo se muestra si hay alguna, para
  // que el cliente entienda por qué el total puede ser mayor a lo que
  // se cotizó originalmente (nunca se le muestra el % del intermediario,
  // ver comisionIntermediario -- eso es exclusivo del panel interno).
  const ordenesAprobadasMonto = montoTotal - Number(servicio.montoInicial);
  const montoPagado = montoPagadoServicio(servicio, servicio.pagos);
  const montoPendiente = montoPendienteServicio(servicio, servicio.pagos);
  const estadoSaldo = estadoSaldoServicio(servicio, servicio.pagos);
  const saldado = estadoSaldo === "liquidado";
  const cancelado = estadoSaldo === "cancelado";
  const avancePago = montoTotal > 0 ? Math.min(100, Math.round((montoPagado / montoTotal) * 100)) : 0;
  // Mismo criterio de moneda que montoPagadoServicio -- si por algún
  // motivo hubiera un pago confirmado en otra moneda, no se lista aquí
  // para que la suma de la lista siempre cuadre con "Pagado" de arriba.
  const monedaServicio = servicio.moneda ?? "MXN";
  const pagosDelServicio = servicio.pagos.filter((p) => (p.moneda ?? "MXN") === monedaServicio);

  const evidencias = await prisma.archivo.findMany({
    where: { entidadTipo: "Servicio", entidadId: servicio.id },
    orderBy: { creadoEn: "desc" },
  });

  const { total: totalTareas, completadas: tareasCompletadas, porcentaje: avance } =
    calcularAvance(servicio.tareas);

  const completadas = servicio.tareas
    .filter((t) => t.completada)
    .sort((a, b) => (b.completadaEn?.getTime() ?? 0) - (a.completadaEn?.getTime() ?? 0));
  const pendientes = servicio.tareas
    .filter((t) => !t.completada)
    .sort((a, b) => (a.fechaLimite?.getTime() ?? Infinity) - (b.fechaLimite?.getTime() ?? Infinity));

  const imagenes = evidencias.filter((ev) => ev.tipo === "Imagen");
  const videos = evidencias.filter((ev) => ev.tipo === "Video");

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
        <div className="flex items-center justify-between gap-3">
          <ThemedLogo className="h-8 w-auto" />
          <Badge className={SERVICIO_STATUS_COLOR[servicio.status] ?? ""}>
            {STATUS_LABEL[servicio.status] ?? servicio.status}
          </Badge>
        </div>

        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{servicio.descripcion}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Para {servicio.cliente.nombre}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Estatus del proyecto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {servicio.detalles && <p className="text-muted-foreground">{servicio.detalles}</p>}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-muted-foreground">Avance general</span>
                <span className="font-semibold">{avance}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${avance}%` }}
                />
              </div>
              {totalTareas > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {tareasCompletadas} de {totalTareas} tareas completadas
                </p>
              )}
            </div>

            <div className="grid gap-3 border-t border-input pt-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Inicio</p>
                <p className="font-medium">{formatDate(servicio.fechaInicio)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entrega estimada</p>
                <p className="font-medium">{formatDate(servicio.fechaFin)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Estado de cuenta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {ordenesAprobadasMonto > 0.01 && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-input p-3">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Valor inicial</span>
                  <span>{formatCurrency(servicio.montoInicial, servicio.moneda)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Órdenes de cambio</span>
                  <span>{formatCurrency(ordenesAprobadasMonto, servicio.moneda)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-input pt-1.5 font-semibold">
                  <span>Total del servicio</span>
                  <span>{formatCurrency(montoTotal, servicio.moneda)}</span>
                </div>
              </div>
            )}

            {cancelado ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-muted-foreground">
                <Circle className="size-5 shrink-0" />
                <p className="font-medium">Este servicio fue cancelado.</p>
              </div>
            ) : saldado ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-success/10 px-3 py-2.5 text-success">
                <CircleCheck className="size-5 shrink-0" />
                <p className="font-medium">Servicio saldado — no debes nada de este proyecto.</p>
              </div>
            ) : (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-muted-foreground">Pagado</span>
                  <span className="font-semibold">
                    {formatCurrency(montoPagado, servicio.moneda)} de {formatCurrency(montoTotal, servicio.moneda)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${avancePago}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Te falta por saldar:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(montoPendiente, servicio.moneda)}
                  </span>
                </p>
              </div>
            )}

            {pagosDelServicio.length > 0 && (
              <div className={saldado ? undefined : "border-t border-input pt-4"}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Receipt className="size-3.5" /> Pagos registrados ({pagosDelServicio.length})
                </p>
                <ul className="flex flex-col gap-2">
                  {pagosDelServicio.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {formatDate(p.fecha)} · {METODO_LABEL[p.metodoPago] ?? p.metodoPago}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatCurrency(p.monto, p.moneda)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {totalTareas > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Avance del trabajo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {completadas.length > 0 && (
                <ol className="flex flex-col gap-4">
                  {completadas.map((t, i) => (
                    <li key={t.id} className="relative flex gap-3 pl-0.5">
                      <div className="flex flex-col items-center">
                        <CheckCircle2 className="size-4.5 shrink-0 text-emerald-500" />
                        {i < completadas.length - 1 && (
                          <div className="mt-1 w-px flex-1 bg-input" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{t.titulo}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDate(t.completadaEn)}
                          </span>
                        </div>
                        {t.descripcion && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{t.descripcion}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {pendientes.length > 0 && (
                <div className={completadas.length > 0 ? "border-t border-input pt-4" : undefined}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    En curso ({pendientes.length})
                  </p>
                  <ul className="flex flex-col gap-2">
                    {pendientes.map((t) => (
                      <li key={t.id} className="flex items-center gap-2.5 text-sm">
                        <Circle
                          className={`size-2.5 shrink-0 fill-current ${
                            PRIORIDAD_BAR[t.prioridad]?.replace("bg-", "text-") ?? "text-muted-foreground"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{t.titulo}</span>
                        {t.fechaLimite && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDate(t.fechaLimite)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
              <div className="flex flex-col gap-5">
                {imagenes.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <ImageIcon className="size-3.5" /> Imágenes ({imagenes.length})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {imagenes.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex flex-col gap-2 overflow-hidden rounded-lg border border-input"
                        >
                          <ZoomableImage
                            src={ev.url}
                            alt={ev.nombre}
                            className="h-48 w-full object-cover"
                          />
                          <div className="flex items-center justify-between px-2.5 pb-2 text-xs text-muted-foreground">
                            <span className="truncate">{ev.nombre}</span>
                            <span className="shrink-0">{formatDate(ev.creadoEn)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {videos.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Film className="size-3.5" /> Videos ({videos.length})
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {videos.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex flex-col gap-2 overflow-hidden rounded-lg border border-input"
                        >
                          {ev.url.includes(".public.blob.vercel-storage.com") ? (
                            <video
                              src={ev.url}
                              controls
                              preload="metadata"
                              className="h-48 w-full bg-black object-contain"
                            />
                          ) : (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-48 items-center justify-center bg-muted text-sm text-primary hover:underline"
                            >
                              {origenVideo(ev.url)} ↗
                            </a>
                          )}
                          <div className="flex items-center justify-between px-2.5 pb-2 text-xs text-muted-foreground">
                            <span className="truncate">{ev.nombre}</span>
                            <span className="shrink-0">{formatDate(ev.creadoEn)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quejas y sugerencias</CardTitle>
          </CardHeader>
          <CardContent>
            <QuejaFormPublica action={crearQuejaPublica.bind(null, token)} />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Admx Dev · Panel de proyecto</p>
      </div>
    </div>
  );
}
