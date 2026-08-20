import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Pencil, Download, CheckCircle2, Clock } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { METODO_LABEL } from "@/lib/metodo-pago";
import { PagoFormDialog } from "@/components/pagos/pago-form-dialog";
import { DeletePagoButton } from "@/components/pagos/delete-pago-button";
import { PagoDetalleDialog } from "@/components/pagos/pago-detalle-dialog";
import {
  actualizarPago,
  confirmarPago,
  crearPago,
  eliminarComprobantePago,
  eliminarPago,
  subirComprobantePago,
} from "@/app/admin/pagos/actions";
import type { MetodoPago, Prisma } from "@/generated/prisma/client";

const METODOS = [
  "Efectivo",
  "Transferencia",
  "MercadoPago",
  "PayPal",
  "Tarjeta",
  "WesternUnion",
  "Binance",
  "Deposito",
  "Otro",
];

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const CONFIRMADO_COLOR = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
const PENDIENTE_COLOR = "bg-amber-500/15 text-amber-700 dark:text-amber-400";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{
    servicioId?: string;
    metodoPago?: string;
    confirmado?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const { servicioId, metodoPago, confirmado, desde, hasta } = await searchParams;

  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Pagos");
  if (!permisos.puedeVer) redirect("/admin");

  const servicios = await prisma.servicio.findMany({
    include: { cliente: true },
    orderBy: { creadoEn: "desc" },
  });

  const servicioOpciones = servicios.map((s) => ({
    id: s.id,
    descripcion: s.descripcion,
    clienteNombre: s.cliente.nombre,
  }));

  const where: Prisma.PagoWhereInput = {};
  if (servicioId) where.servicioId = Number(servicioId);
  if (metodoPago) where.metodoPago = metodoPago as MetodoPago;
  if (confirmado) where.confirmado = confirmado === "true";
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }

  const hasFiltros = Boolean(servicioId || metodoPago || confirmado || desde || hasta);

  const exportParams = new URLSearchParams();
  if (servicioId) exportParams.set("servicioId", servicioId);
  if (metodoPago) exportParams.set("metodoPago", metodoPago);
  if (confirmado) exportParams.set("confirmado", confirmado);
  if (desde) exportParams.set("desde", desde);
  if (hasta) exportParams.set("hasta", hasta);

  const pagos = await prisma.pago.findMany({
    where,
    include: { servicio: { include: { cliente: true } } },
    orderBy: { fecha: "desc" },
  });

  const comprobantes = await prisma.archivo.findMany({
    where: { entidadTipo: "Pago", entidadId: { in: pagos.map((p) => p.id) } },
    orderBy: { creadoEn: "desc" },
  });
  const comprobantePorPago = new Map(comprobantes.map((a) => [a.entidadId, a]));

  const totalMonto = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const totalComision = pagos.reduce((acc, p) => acc + Number(p.comision ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            {pagos.length} pago{pagos.length === 1 ? "" : "s"}
            {hasFiltros ? " con estos filtros" : " registrado" + (pagos.length === 1 ? "" : "s")}
            {" — Total: "}
            {formatCurrency(totalMonto)}
            {totalComision > 0 ? ` (comisiones: ${formatCurrency(totalComision)})` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/pagos/export?${exportParams.toString()}`}>
              <Download />
              Exportar Excel
            </a>
          </Button>
          {permisos.puedeCrear &&
            (servicioOpciones.length > 0 ? (
              <PagoFormDialog
                trigger={
                  <Button>
                    <Plus />
                    Nuevo pago
                  </Button>
                }
                title="Nuevo pago"
                description="Registra un pago recibido para un servicio."
                action={crearPago}
                servicios={servicioOpciones}
                submitLabel="Registrar pago"
              />
            ) : (
              <Button disabled title="Primero registra un servicio">
                <Plus />
                Nuevo pago
              </Button>
            ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select name="servicioId" defaultValue={servicioId ?? ""} className={selectClass}>
              <option value="">Todos los servicios</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.descripcion} — {s.cliente.nombre}
                </option>
              ))}
            </select>

            <select name="metodoPago" defaultValue={metodoPago ?? ""} className={selectClass}>
              <option value="">Todos los métodos</option>
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select name="confirmado" defaultValue={confirmado ?? ""} className={selectClass}>
              <option value="">Todos los status</option>
              <option value="true">Confirmado</option>
              <option value="false">Pendiente</option>
            </select>

            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              aria-label="Desde"
              className={selectClass}
            />
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              aria-label="Hasta"
              className={selectClass}
            />

            <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/pagos">Limpiar</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros ? "No hay pagos con esos filtros." : "Aún no hay pagos registrados."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden table-fixed md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-3/12">Servicio</TableHead>
                    <TableHead className="w-2/12">Cliente</TableHead>
                    <TableHead className="w-1/12">Fecha</TableHead>
                    <TableHead className="w-1/12">Método</TableHead>
                    <TableHead className="w-1/12">Cuenta</TableHead>
                    <TableHead className="w-1/12">Status</TableHead>
                    <TableHead className="w-1/12 text-right">Comisión</TableHead>
                    <TableHead className="w-1/12 text-right">Monto</TableHead>
                    <TableHead className="w-2/12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/servicios/${p.servicio.id}`}
                          className="block truncate hover:underline"
                          title={p.servicio.descripcion}
                        >
                          {p.servicio.descripcion}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/clientes/${p.servicio.cliente.id}`}
                          className="block truncate hover:underline"
                          title={p.servicio.cliente.nombre}
                        >
                          {p.servicio.cliente.nombre}
                        </Link>
                      </TableCell>
                      <TableCell className="truncate">{formatDate(p.fecha)}</TableCell>
                      <TableCell className="truncate" title={p.metodoPago}>
                        {p.metodoPago}
                      </TableCell>
                      <TableCell className="truncate" title={p.cuenta ?? undefined}>
                        {p.cuenta ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.confirmado ? "secondary" : "outline"}>
                          {p.confirmado ? "Confirmado" : "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.comision ? formatCurrency(p.comision) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(p.monto)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {permisos.puedeEditar && !p.confirmado && (
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
                                descripcion: p.servicio.descripcion,
                                cliente: { nombre: p.servicio.cliente.nombre },
                              },
                            }}
                            comprobanteArchivo={comprobantePorPago.get(p.id) ?? null}
                            servicioId={p.servicio.id}
                            subirComprobante={subirComprobantePago.bind(null, p.id)}
                            eliminarComprobante={eliminarComprobantePago}
                          />
                          {permisos.puedeEditar && (
                            <PagoFormDialog
                              trigger={
                                <Button size="icon" variant="ghost" className="size-7">
                                  <Pencil className="size-4" />
                                </Button>
                              }
                              title="Editar pago"
                              action={actualizarPago.bind(null, p.id)}
                              servicios={servicioOpciones}
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
                              submitLabel="Guardar cambios"
                            />
                          )}
                          {permisos.puedeEditar && (
                            <DeletePagoButton action={eliminarPago.bind(null, p.id)} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {pagos.map((p) => (
                  <MobileRecordCard
                    key={p.id}
                    avatarLabel={p.confirmado ? <CheckCircle2 className="size-5" /> : <Clock className="size-5" />}
                    avatarClassName={p.confirmado ? CONFIRMADO_COLOR : PENDIENTE_COLOR}
                    title={p.servicio.descripcion}
                    subtitle={`${p.servicio.cliente.nombre} · ${METODO_LABEL[p.metodoPago] ?? p.metodoPago}`}
                    meta={`${formatDate(p.fecha)} · ${formatCurrency(p.monto)}`}
                    badge={
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          p.confirmado ? CONFIRMADO_COLOR : PENDIENTE_COLOR
                        }`}
                      >
                        {p.confirmado ? "Confirmado" : "Pendiente"}
                      </span>
                    }
                    actions={
                      <>
                        {permisos.puedeEditar && !p.confirmado && (
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
                              descripcion: p.servicio.descripcion,
                              cliente: { nombre: p.servicio.cliente.nombre },
                            },
                          }}
                          comprobanteArchivo={comprobantePorPago.get(p.id) ?? null}
                          servicioId={p.servicio.id}
                          subirComprobante={subirComprobantePago.bind(null, p.id)}
                          eliminarComprobante={eliminarComprobantePago}
                        />
                        {permisos.puedeEditar && (
                          <PagoFormDialog
                            trigger={
                              <Button size="icon" variant="ghost" className="size-7">
                                <Pencil className="size-4" />
                              </Button>
                            }
                            title="Editar pago"
                            action={actualizarPago.bind(null, p.id)}
                            servicios={servicioOpciones}
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
                            submitLabel="Guardar cambios"
                          />
                        )}
                        {permisos.puedeEditar && (
                          <DeletePagoButton action={eliminarPago.bind(null, p.id)} />
                        )}
                      </>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
