import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio, comisionIntermediario } from "@/lib/servicio";
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
import { ServicioFormDialog } from "@/components/servicios/servicio-form-dialog";
import { DeleteServicioButton } from "@/components/servicios/delete-servicio-button";
import { OrdenCambioFormDialog } from "@/components/servicios/orden-cambio-form-dialog";
import { CotizacionFormDialog } from "@/components/cotizaciones/cotizacion-form-dialog";
import { CopyLinkButton } from "@/components/cotizaciones/copy-link-button";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { TareaLista } from "@/components/tareas/tarea-lista";
import { EvidenciaForm } from "@/components/servicios/evidencia-form";
import { PagoFormDialog } from "@/components/pagos/pago-form-dialog";
import { DeletePagoButton } from "@/components/pagos/delete-pago-button";
import { PagoDetalleDialog } from "@/components/pagos/pago-detalle-dialog";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import {
  aprobarOrdenCambio,
  createOrdenCambio,
  eliminarEvidencia,
  eliminarServicio,
  rechazarOrdenCambio,
  subirEvidencia,
  updateServicio,
} from "@/app/admin/servicios/actions";
import { crearCotizacion } from "@/app/admin/cotizaciones/actions";
import { crearTarea } from "@/app/admin/tareas/actions";
import {
  actualizarPago,
  confirmarPago,
  crearPago,
  eliminarComprobantePago,
  eliminarPago,
  subirComprobantePago,
} from "@/app/admin/pagos/actions";
import {
  SERVICIO_STATUS_COLOR,
  COTIZACION_STATUS_COLOR,
  ORDEN_STATUS_COLOR,
  CONFIRMADO_COLOR,
  PENDIENTE_COLOR,
} from "@/lib/status-colors";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function ServicioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const servicioId = Number(id);

  const servicio = servicioId
    ? await prisma.servicio.findUnique({
        where: { id: servicioId },
        include: {
          cliente: true,
          intermediario: true,
          ordenesCambio: { orderBy: { creadoEn: "desc" } },
          pagos: { orderBy: { fecha: "desc" } },
          cotizaciones: { orderBy: { fechaEmision: "desc" } },
          tareas: { orderBy: [{ completada: "asc" }, { fechaLimite: "asc" }, { creadoEn: "desc" }] },
        },
      })
    : null;

  if (!servicio) notFound();

  const usuarioActual = await currentUsuario();
  const permisos = await permisosModulo(usuarioActual, "Servicios");
  if (!permisos.puedeVer) redirect("/admin");
  if (!permisos.verTodo && servicio.responsableId !== usuarioActual?.id) notFound();

  const [clientes, intermediarios, usuarios, evidencias, comprobantesPago] = await Promise.all([
    prisma.cliente.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.intermediario.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.archivo.findMany({
      where: { entidadTipo: "Servicio", entidadId: servicio.id },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.archivo.findMany({
      where: { entidadTipo: "Pago", entidadId: { in: servicio.pagos.map((p) => p.id) } },
      // Ascendente para que, si hubiera más de un archivo por pago, el Map
      // se quede con el más reciente.
      orderBy: { creadoEn: "asc" },
    }),
  ]);
  const comprobantePorPago = new Map(comprobantesPago.map((a) => [a.entidadId, a]));

  const montoTotal = montoTotalServicio(servicio);
  const ordenesAprobadasMonto = montoTotal - Number(servicio.montoInicial);
  const comision = comisionIntermediario(montoTotal, servicio.porcentajeIntermediario);

  const boundUpdateServicio = updateServicio.bind(null, servicio.id);
  const boundCreateOrdenCambio = createOrdenCambio.bind(null, servicio.id);
  const boundSubirEvidencia = subirEvidencia.bind(null, servicio.id);

  const servicioComoOpcion = [
    {
      id: servicio.id,
      descripcion: servicio.descripcion,
      clienteNombre: servicio.cliente.nombre,
      montoTotal,
      ordenesCambio: servicio.ordenesCambio.map((o) => ({
        id: o.id,
        descripcion: o.descripcion,
        monto: Number(o.monto),
        status: o.status,
      })),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{servicio.descripcion}</h1>
            <Badge className={SERVICIO_STATUS_COLOR[servicio.status]}>
              {servicio.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Cliente:{" "}
            <Link href={`/admin/clientes/${servicio.cliente.id}`} className="hover:underline">
              {servicio.cliente.nombre}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyLinkButton path={`/servicio/${servicio.tokenPublico}`} />
          {permisos.puedeEditar && (
            <ServicioFormDialog
              trigger={
                <Button variant="outline">
                  <Pencil />
                  Editar
                </Button>
              }
              title="Editar servicio"
              description={servicio.descripcion}
              action={boundUpdateServicio}
              clientes={clientes}
              intermediarios={intermediarios}
              usuarios={usuarios}
              usuarioActualId={usuarioActual?.id}
              defaultValues={{
                clienteId: servicio.clienteId,
                descripcion: servicio.descripcion,
                detalles: servicio.detalles,
                fechaInicio: servicio.fechaInicio,
                fechaFin: servicio.fechaFin,
                montoInicial: Number(servicio.montoInicial),
                status: servicio.status,
                intermediarioId: servicio.intermediarioId,
                porcentajeIntermediario: servicio.porcentajeIntermediario
                  ? Number(servicio.porcentajeIntermediario)
                  : null,
                responsableId: servicio.responsableId,
              }}
              submitLabel="Guardar cambios"
            />
          )}
          {permisos.puedeEditar && (
            <DeleteServicioButton
              descripcion={servicio.descripcion}
              action={eliminarServicio.bind(null, servicio.id)}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Monto inicial" value={formatCurrency(servicio.montoInicial)} />
        <Kpi label="Órdenes aprobadas" value={formatCurrency(ordenesAprobadasMonto)} />
        <Kpi label="Monto total" value={formatCurrency(montoTotal)} />
        <Kpi
          label="Comisión intermediario"
          value={servicio.intermediario ? formatCurrency(comision) : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Detalles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Fecha de inicio</p>
            <p>{formatDate(servicio.fechaInicio)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de fin</p>
            <p>{formatDate(servicio.fechaFin)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Intermediario</p>
            <p>
              {servicio.intermediario
                ? `${servicio.intermediario.nombre} (${servicio.porcentajeIntermediario ?? 0}%)`
                : "—"}
            </p>
          </div>
          {servicio.detalles && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-muted-foreground">Notas</p>
              <p className="whitespace-pre-wrap">{servicio.detalles}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Órdenes de cambio ({servicio.ordenesCambio.length})
          </CardTitle>
          <OrdenCambioFormDialog action={boundCreateOrdenCambio} />
        </CardHeader>
        <CardContent>
          {servicio.ordenesCambio.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este servicio no tiene órdenes de cambio.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicio.ordenesCambio.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.descripcion}</TableCell>
                    <TableCell>
                      <Badge className={ORDEN_STATUS_COLOR[o.status]}>
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(o.creadoEn)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.monto)}</TableCell>
                    <TableCell>
                      {o.status === "Pendiente" && (
                        <div className="flex justify-end gap-2">
                          <form action={aprobarOrdenCambio.bind(null, o.id, servicio.id)}>
                            <Button type="submit" size="sm" variant="secondary">
                              Aprobar
                            </Button>
                          </form>
                          <form action={rechazarOrdenCambio.bind(null, o.id, servicio.id)}>
                            <Button type="submit" size="sm" variant="outline">
                              Rechazar
                            </Button>
                          </form>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Tareas ({servicio.tareas.length})
          </CardTitle>
          <TareaFormDialog
            action={crearTarea}
            vinculoFijo={{ value: `servicio:${servicio.id}`, label: servicio.descripcion }}
            usuarios={usuarios}
            usuarioActualId={usuarioActual?.id}
          />
        </CardHeader>
        <CardContent>
          <TareaLista tareas={servicio.tareas} emptyText="Este servicio no tiene tareas." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Cotizaciones ({servicio.cotizaciones.length})
          </CardTitle>
          <CotizacionFormDialog
            trigger={
              <Button size="sm" variant="outline">
                <Plus />
                Nueva cotización
              </Button>
            }
            title="Nueva cotización"
            description={servicio.descripcion}
            action={crearCotizacion}
            servicios={servicioComoOpcion}
            submitLabel="Crear cotización"
          />
        </CardHeader>
        <CardContent>
          {servicio.cotizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este servicio aún no tiene cotizaciones.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicio.cotizaciones.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge className={COTIZACION_STATUS_COLOR[c.status]}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(c.fechaEmision)}</TableCell>
                    <TableCell>{formatDate(c.fechaVencimiento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.montoTotal)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/cotizaciones/${c.id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Ver
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Pagos ({servicio.pagos.length})</CardTitle>
          <PagoFormDialog
            trigger={
              <Button size="sm" variant="outline">
                <Plus />
                Nuevo pago
              </Button>
            }
            title="Nuevo pago"
            description={servicio.descripcion}
            action={crearPago}
            servicioFijo={{ id: servicio.id, label: servicio.descripcion }}
            submitLabel="Registrar pago"
          />
        </CardHeader>
        <CardContent>
          {servicio.pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este servicio aún no tiene pagos registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicio.pagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.fecha)}</TableCell>
                    <TableCell>{p.metodoPago}</TableCell>
                    <TableCell>{p.cuenta ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={p.confirmado ? CONFIRMADO_COLOR : PENDIENTE_COLOR}>
                        {p.confirmado ? "Confirmado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.comision ? formatCurrency(p.comision) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(p.monto)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {!p.confirmado && (
                          <form action={confirmarPago.bind(null, p.id)}>
                            <Button type="submit" size="sm" variant="secondary">
                              Confirmar
                            </Button>
                          </form>
                        )}
                        <PagoDetalleDialog
                          pago={{
                            id: p.id,
                            fecha: p.fecha,
                            metodoPago: p.metodoPago,
                            monto: Number(p.monto),
                            comision: p.comision ? Number(p.comision) : null,
                            moneda: p.moneda,
                            cuenta: p.cuenta,
                            comprobante: p.comprobante,
                            confirmado: p.confirmado,
                            servicio: {
                              descripcion: servicio.descripcion,
                              cliente: { nombre: servicio.cliente.nombre },
                            },
                          }}
                          comprobanteArchivo={comprobantePorPago.get(p.id) ?? null}
                          servicioId={servicio.id}
                          subirComprobante={subirComprobantePago.bind(null, p.id)}
                          eliminarComprobante={eliminarComprobantePago}
                        />
                        <PagoFormDialog
                          trigger={
                            <Button size="icon" variant="ghost" className="size-7">
                              <Pencil className="size-4" />
                            </Button>
                          }
                          title="Editar pago"
                          action={actualizarPago.bind(null, p.id)}
                          servicioFijo={{ id: servicio.id, label: servicio.descripcion }}
                          defaultValues={{
                            servicioId: p.servicioId,
                            fecha: p.fecha,
                            metodoPago: p.metodoPago,
                            monto: Number(p.monto),
                            comision: p.comision ? Number(p.comision) : null,
                            moneda: p.moneda,
                            cuenta: p.cuenta,
                            comprobante: p.comprobante,
                            confirmado: p.confirmado,
                          }}
                          comprobanteExistente={
                            comprobantePorPago.get(p.id)
                              ? { nombre: comprobantePorPago.get(p.id)!.nombre }
                              : null
                          }
                          submitLabel="Guardar cambios"
                        />
                        <DeletePagoButton action={eliminarPago.bind(null, p.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Evidencia ({evidencias.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EvidenciaForm action={boundSubirEvidencia} />

          {evidencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has subido evidencia de este proyecto.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {evidencias.map((ev) => (
                <div key={ev.id} className="flex flex-col gap-2 rounded-lg border border-input p-2">
                  {ev.tipo === "Imagen" ? (
                    <ZoomableImage
                      src={ev.url}
                      alt={ev.nombre}
                      className="h-32 w-full rounded-md object-cover"
                    />
                  ) : (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-32 items-center justify-center rounded-md bg-muted text-sm text-primary hover:underline"
                    >
                      Ver grabación
                    </a>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">{ev.nombre}</p>
                    <form action={eliminarEvidencia.bind(null, ev.id, servicio.id)}>
                      <Button type="submit" size="icon" variant="ghost" className="size-6 shrink-0">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
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
