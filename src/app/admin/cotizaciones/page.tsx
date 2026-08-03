import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus, Download } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio } from "@/lib/servicio";
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
import { CotizacionFormDialog } from "@/components/cotizaciones/cotizacion-form-dialog";
import { crearCotizacion } from "@/app/admin/cotizaciones/actions";
import type { Prisma, StatusCotizacion } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Enviada: "outline",
  Firmada: "default",
  Pagada: "secondary",
  Vencida: "destructive",
  Perdida: "destructive",
};

const STATUSES = ["Enviada", "Firmada", "Pagada", "Vencida", "Perdida"];

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; status?: string }>;
}) {
  const { clienteId, status } = await searchParams;

  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Cotizaciones");
  if (!permisos.puedeVer) redirect("/admin");

  const [clientes, serviciosParaCotizar] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.servicio.findMany({
      include: { cliente: true, ordenesCambio: true },
      orderBy: { creadoEn: "desc" },
    }),
  ]);

  const servicioOpciones = serviciosParaCotizar.map((s) => ({
    id: s.id,
    descripcion: s.descripcion,
    clienteNombre: s.cliente.nombre,
    montoTotal: montoTotalServicio(s),
    ordenesCambio: s.ordenesCambio.map((o) => ({
      id: o.id,
      descripcion: o.descripcion,
      monto: Number(o.monto),
      status: o.status,
    })),
  }));

  const where: Prisma.CotizacionWhereInput = {};
  if (clienteId) where.clienteId = Number(clienteId);
  if (status) where.status = status as StatusCotizacion;

  const hasFiltros = Boolean(clienteId || status);

  const exportParams = new URLSearchParams();
  if (clienteId) exportParams.set("clienteId", clienteId);
  if (status) exportParams.set("status", status);

  const cotizaciones = await prisma.cotizacion.findMany({
    where,
    include: { cliente: true, servicio: true },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">
            {cotizaciones.length} cotización{cotizaciones.length === 1 ? "" : "es"}
            {hasFiltros ? " con estos filtros" : " registrada" + (cotizaciones.length === 1 ? "" : "s")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/cotizaciones/export?${exportParams.toString()}`}>
              <Download />
              Exportar Excel
            </a>
          </Button>
          {permisos.puedeCrear &&
            (clientes.length > 0 ? (
              <CotizacionFormDialog
                trigger={
                  <Button>
                    <Plus />
                    Nueva cotización
                  </Button>
                }
                title="Nueva cotización"
                description="Para un servicio existente, o una nueva negociación con un cliente."
                action={crearCotizacion}
                servicios={servicioOpciones.length > 0 ? servicioOpciones : undefined}
                clientes={clientes}
                submitLabel="Crear cotización"
              />
            ) : (
              <Button disabled title="Primero registra un cliente">
                <Plus />
                Nueva cotización
              </Button>
            ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select name="clienteId" defaultValue={clienteId ?? ""} className={selectClass}>
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <select name="status" defaultValue={status ?? ""} className={selectClass}>
              <option value="">Todos los status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/cotizaciones">Limpiar</Link>
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
          {cotizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros
                ? "No hay cotizaciones con esos filtros."
                : "Aún no hay cotizaciones registradas."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotizaciones.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/cotizaciones/${c.id}`} className="hover:underline">
                        {c.servicio?.descripcion ?? c.descripcion ?? "Sin servicio"}
                      </Link>
                      {!c.servicioId && (
                        <Badge variant="outline" className="ml-2">
                          En negociación
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/clientes/${c.cliente.id}`}
                        className="hover:underline"
                      >
                        {c.cliente.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(c.fechaEmision)}</TableCell>
                    <TableCell>{formatDate(c.fechaVencimiento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.montoTotal)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/cotizaciones/${c.id}`}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Ver detalle de la cotización ${c.id}`}
                      >
                        <ChevronRight className="size-4" />
                      </Link>
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
