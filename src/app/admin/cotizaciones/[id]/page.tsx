import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio } from "@/lib/servicio";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CotizacionFormDialog } from "@/components/cotizaciones/cotizacion-form-dialog";
import { CopyLinkButton } from "@/components/cotizaciones/copy-link-button";
import { DeleteCotizacionButton } from "@/components/cotizaciones/delete-cotizacion-button";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { TareaLista } from "@/components/tareas/tarea-lista";
import { crearTarea } from "@/app/admin/tareas/actions";
import {
  actualizarCotizacion,
  confirmarPagoCotizacion,
  convertirEnServicio,
  eliminarCotizacion,
  marcarCotizacionGanada,
  marcarCotizacionPerdida,
} from "@/app/admin/cotizaciones/actions";
import { COTIZACION_STATUS_COLOR, CONFIRMADO_COLOR, PENDIENTE_COLOR } from "@/lib/status-colors";
import {
  nombreClienteCotizacion,
  montoPagadoCotizacion,
  montoPendienteCotizacion,
} from "@/lib/cotizacion";
import { ConvertirProspectoButton } from "@/components/cotizaciones/convertir-prospecto-button";

export default async function CotizacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cotizacionId = Number(id);

  const usuarioSesion = await currentUsuario();
  const permisos = await permisosModulo(usuarioSesion, "Cotizaciones");
  if (!permisos.puedeVer) redirect("/admin");

  const cotizacion = cotizacionId
    ? await prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
        include: {
          cliente: true,
          servicio: { include: { cliente: true, ordenesCambio: true } },
          ordenCambio: true,
          pagos: { orderBy: { fecha: "desc" } },
          tareas: { orderBy: [{ completada: "asc" }, { fechaLimite: "asc" }, { creadoEn: "desc" }] },
        },
      })
    : null;

  if (!cotizacion) notFound();
  // Con alcance "Propio", entrar directo por la URL a una cotización que
  // no es suya (ni la creó, ni cuelga de un servicio suyo) no debe
  // funcionar aunque la liste ya la filtre — mismo criterio que
  // requiereNivelCotizacion() y que ya usa el detalle de Servicio.
  if (
    !permisos.verTodo &&
    cotizacion.creadoPorId !== usuarioSesion?.id &&
    cotizacion.servicio?.responsableId !== usuarioSesion?.id
  ) {
    notFound();
  }

  const [archivos, usuarios] = await Promise.all([
    prisma.archivo.findMany({
      where: { entidadTipo: "Cotizacion", entidadId: cotizacion.id },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  const usuarioActual = usuarioSesion;
  const firma = archivos.find((a) => a.nombre.startsWith("firma-"));

  const montoDescuento =
    cotizacion.descuentoTipo === "Porcentaje"
      ? Number(cotizacion.montoSubtotal) * (Number(cotizacion.descuentoValor ?? 0) / 100)
      : Number(cotizacion.descuentoValor ?? 0);
  const montoPagado = montoPagadoCotizacion(cotizacion, cotizacion.pagos);
  const montoPendiente = montoPendienteCotizacion(cotizacion, cotizacion.pagos);

  const boundUpdate = actualizarCotizacion.bind(null, cotizacion.id);
  const boundEliminar = eliminarCotizacion.bind(null, cotizacion.id);
  const boundConvertir = convertirEnServicio.bind(null, cotizacion.id);
  const boundGanada = marcarCotizacionGanada.bind(null, cotizacion.id);
  const boundPerdida = marcarCotizacionPerdida.bind(null, cotizacion.id);
  const montoSubtotalActual = cotizacion.servicio ? montoTotalServicio(cotizacion.servicio) : null;
  const descripcion = cotizacion.servicio?.descripcion ?? cotizacion.descripcion ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              Cotización #{String(cotizacion.id).padStart(4, "0")}
            </h1>
            <Badge className={COTIZACION_STATUS_COLOR[cotizacion.status]}>
              {cotizacion.status}
            </Badge>
            {!cotizacion.servicioId && <Badge variant="outline">En negociación</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {cotizacion.servicio ? (
              <>
                Servicio:{" "}
                <Link
                  href={`/admin/servicios/${cotizacion.servicio.id}`}
                  className="hover:underline"
                >
                  {cotizacion.servicio.descripcion}
                </Link>{" "}
                —{" "}
              </>
            ) : (
              descripcion && <>{descripcion} — </>
            )}
            {cotizacion.cliente ? (
              <>
                Cliente:{" "}
                <Link href={`/admin/clientes/${cotizacion.cliente.id}`} className="hover:underline">
                  {cotizacion.cliente.nombre}
                </Link>
              </>
            ) : (
              <>Prospecto: {nombreClienteCotizacion(cotizacion)} (sin registrar)</>
            )}
            {cotizacion.ordenCambio && (
              <>
                {" "}
                — Orden de cambio:{" "}
                <span className="text-foreground">{cotizacion.ordenCambio.descripcion}</span>
              </>
            )}
          </p>
          {!cotizacion.servicioId && cotizacion.cliente && (
            <p className="mt-1 text-xs text-muted-foreground">
              El cliente ya puede pagar aunque no la conviertas a mano — se formaliza sola como
              servicio en cuanto llega el primer pago.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyLinkButton path={`/cotizacion/${cotizacion.token}`} />
          <Button variant="outline" asChild>
            <a href={`/cotizacion/${cotizacion.token}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileDown />
              PDF
            </a>
          </Button>
          {permisos.puedeEditar && cotizacion.status === "Enviada" && (
            <>
              <form action={boundGanada}>
                <Button type="submit" variant="secondary">
                  Marcar como ganada
                </Button>
              </form>
              <form action={boundPerdida}>
                <Button type="submit" variant="outline">
                  Marcar como perdida
                </Button>
              </form>
            </>
          )}
          {permisos.puedeEditar && !cotizacion.cliente && (
            <ConvertirProspectoButton
              cotizacionId={cotizacion.id}
              defaultNombre={cotizacion.prospectoNombre ?? ""}
            />
          )}
          {permisos.puedeEditar &&
            cotizacion.status === "Firmada" &&
            !cotizacion.servicioId &&
            cotizacion.cliente && (
              <form action={boundConvertir}>
                <Button type="submit">Convertir en servicio</Button>
              </form>
            )}
          {permisos.puedeEditar && cotizacion.status !== "Pagada" && (
            <CotizacionFormDialog
              trigger={
                <Button variant="outline">
                  <Pencil />
                  Editar
                </Button>
              }
              title="Editar cotización"
              description={descripcion}
              action={boundUpdate}
              montoSubtotal={Number(cotizacion.montoSubtotal)}
              defaultValues={{ ...cotizacion, clienteId: cotizacion.clienteId ?? undefined }}
              submitLabel="Guardar cambios"
            />
          )}
          {permisos.puedeEditar && cotizacion.status !== "Pagada" && (
            <DeleteCotizacionButton action={boundEliminar} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Tareas ({cotizacion.tareas.length})</CardTitle>
          <TareaFormDialog
            action={crearTarea}
            vinculoFijo={{ value: `cotizacion:${cotizacion.id}`, label: descripcion }}
            usuarios={usuarios}
            usuarioActualId={usuarioActual?.id}
          />
        </CardHeader>
        <CardContent>
          <TareaLista
            tareas={cotizacion.tareas}
            emptyText="Esta negociación no tiene tareas."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Montos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal (al emitir)</span>
            <span>{formatCurrency(cotizacion.montoSubtotal, cotizacion.moneda)}</span>
          </div>
          {cotizacion.descuentoTipo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Descuento
                {cotizacion.descuentoMotivo ? ` — ${cotizacion.descuentoMotivo}` : ""}
              </span>
              <span>-{formatCurrency(montoDescuento, cotizacion.moneda)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(cotizacion.montoTotal, cotizacion.moneda)}</span>
          </div>
          {cotizacion.porcentajeAnticipo && (
            <p className="text-xs text-muted-foreground">
              Se cobra en dos partes: {cotizacion.porcentajeAnticipo}% de anticipo y el resto al
              terminar.
            </p>
          )}
          {cotizacion.moneda === "USD" && (
            <p className="text-xs text-muted-foreground">
              Cotización en USD — el cliente solo puede pagar en línea con PayPal.
            </p>
          )}
          {cotizacion.status !== "Pagada" && montoPagado > 0 && (
            <>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Pagado</span>
                <span>{formatCurrency(montoPagado, cotizacion.moneda)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Saldo pendiente</span>
                <span>{formatCurrency(montoPendiente, cotizacion.moneda)}</span>
              </div>
            </>
          )}
          {montoSubtotalActual !== null && montoSubtotalActual !== Number(cotizacion.montoSubtotal) && (
            <p className="text-xs text-muted-foreground">
              El servicio cambió desde que se emitió esta cotización — subtotal actual del
              servicio: {formatCurrency(montoSubtotalActual)}.
            </p>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Emisión</p>
              <p>{formatDate(cotizacion.fechaEmision)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vencimiento</p>
              <p>{formatDate(cotizacion.fechaVencimiento)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Firma</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {cotizacion.fechaFirma ? (
            <>
              <p>
                Firmada por <span className="font-medium">{cotizacion.firmanteNombre}</span> el{" "}
                {formatDate(cotizacion.fechaFirma)}
                {cotizacion.firmanteIp ? ` desde ${cotizacion.firmanteIp}` : ""}.
              </p>
              {firma && (
                // eslint-disable-next-line @next/next/no-img-element -- firma capturada como dataURL, no un asset optimizable
                <img
                  src={firma.url}
                  alt="Firma capturada"
                  className="h-32 w-auto rounded-lg border border-input bg-white"
                />
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Aún no se ha firmado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Pagos ({cotizacion.pagos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cotizacion.pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no se ha reportado ningún pago para esta cotización.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotizacion.pagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.fecha)}</TableCell>
                    <TableCell>{p.metodoPago}</TableCell>
                    <TableCell>
                      <Badge className={p.confirmado ? CONFIRMADO_COLOR : PENDIENTE_COLOR}>
                        {p.confirmado ? "Confirmado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(p.monto)}</TableCell>
                    <TableCell>
                      {!p.confirmado && (
                        <form action={confirmarPagoCotizacion.bind(null, cotizacion.id, p.id)}>
                          <Button type="submit" size="sm" variant="secondary">
                            Confirmar pago
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
