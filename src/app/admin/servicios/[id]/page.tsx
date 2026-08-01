import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio, comisionIntermediario } from "@/lib/servicio";
import { formatCurrency, formatDate } from "@/lib/format";
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
import { OrdenCambioFormDialog } from "@/components/servicios/orden-cambio-form-dialog";
import { CotizacionFormDialog } from "@/components/cotizaciones/cotizacion-form-dialog";
import {
  aprobarOrdenCambio,
  createOrdenCambio,
  rechazarOrdenCambio,
  updateServicio,
} from "@/app/admin/servicios/actions";
import { crearCotizacion } from "@/app/admin/cotizaciones/actions";

const COTIZACION_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Enviada: "outline",
  Firmada: "default",
  Pagada: "secondary",
  Vencida: "destructive",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Cotizado: "outline",
  Aprobado: "secondary",
  EnProceso: "default",
  Entregado: "secondary",
  Cancelado: "destructive",
};

const ORDEN_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Pendiente: "outline",
  Aprobada: "secondary",
  Rechazada: "destructive",
};

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
        },
      })
    : null;

  if (!servicio) notFound();

  const [clientes, intermediarios] = await Promise.all([
    prisma.cliente.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.intermediario.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);

  const montoTotal = montoTotalServicio(servicio);
  const ordenesAprobadasMonto = montoTotal - Number(servicio.montoInicial);
  const comision = comisionIntermediario(montoTotal, servicio.porcentajeIntermediario);

  const boundUpdateServicio = updateServicio.bind(null, servicio.id);
  const boundCreateOrdenCambio = createOrdenCambio.bind(null, servicio.id);
  const boundCrearCotizacion = crearCotizacion.bind(null, servicio.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{servicio.descripcion}</h1>
            <Badge variant={STATUS_VARIANT[servicio.status] ?? "outline"}>
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
          defaultValues={servicio}
          submitLabel="Guardar cambios"
        />
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
                      <Badge variant={ORDEN_STATUS_VARIANT[o.status] ?? "outline"}>
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
            action={boundCrearCotizacion}
            montoSubtotal={montoTotal}
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
                      <Badge variant={COTIZACION_STATUS_VARIANT[c.status] ?? "outline"}>
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
        <CardHeader>
          <CardTitle className="text-sm font-medium">Pagos ({servicio.pagos.length})</CardTitle>
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicio.pagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.fecha)}</TableCell>
                    <TableCell>{p.metodoPago}</TableCell>
                    <TableCell>
                      <Badge variant={p.confirmado ? "secondary" : "outline"}>
                        {p.confirmado ? "Confirmado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(p.monto)}</TableCell>
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
