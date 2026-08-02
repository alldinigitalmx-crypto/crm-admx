import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio } from "@/lib/servicio";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { puedeVerTodo } from "@/lib/alcance";
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
import { ServicioFormDialog } from "@/components/servicios/servicio-form-dialog";
import { createServicio } from "@/app/admin/servicios/actions";
import type { Prisma, StatusServicio } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Cotizado: "outline",
  Aprobado: "secondary",
  EnProceso: "default",
  Entregado: "secondary",
  Cancelado: "destructive",
};

const STATUSES = ["Cotizado", "Aprobado", "EnProceso", "Entregado", "Cancelado"];

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{
    clienteId?: string;
    status?: string;
    intermediarioId?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const { clienteId, status, intermediarioId, desde, hasta } = await searchParams;

  const [clientes, intermediarios, usuarios, usuario] = await Promise.all([
    prisma.cliente.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.intermediario.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    currentUsuario(),
  ]);

  const verTodo = await puedeVerTodo(usuario, "Servicios");

  const where: Prisma.ServicioWhereInput = {};
  if (clienteId) where.clienteId = Number(clienteId);
  if (status) where.status = status as StatusServicio;
  if (intermediarioId) where.intermediarioId = Number(intermediarioId);
  if (desde || hasta) {
    where.fechaInicio = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }
  if (!verTodo && usuario) where.responsableId = usuario.id;

  const hasFiltros = Boolean(clienteId || status || intermediarioId || desde || hasta);

  const servicios = await prisma.servicio.findMany({
    where,
    include: { cliente: true, intermediario: true, ordenesCambio: true },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            {servicios.length} servicio{servicios.length === 1 ? "" : "s"}
            {hasFiltros ? " con estos filtros" : " registrado" + (servicios.length === 1 ? "" : "s")}
          </p>
        </div>
        <ServicioFormDialog
          trigger={
            <Button>
              <Plus />
              Nuevo servicio
            </Button>
          }
          title="Nuevo servicio"
          description="Registra un nuevo servicio o trabajo."
          action={createServicio}
          clientes={clientes}
          intermediarios={intermediarios}
          usuarios={usuarios}
          usuarioActualId={usuario?.id}
          submitLabel="Crear servicio"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

            <select
              name="intermediarioId"
              defaultValue={intermediarioId ?? ""}
              className={selectClass}
            >
              <option value="">Todos los intermediarios</option>
              {intermediarios.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
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
                  <Link href="/admin/servicios">Limpiar</Link>
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
          {servicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros
                ? "No hay servicios con esos filtros."
                : "Aún no hay servicios registrados."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Intermediario</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicios.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/servicios/${s.id}`} className="hover:underline">
                        {s.descripcion}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/clientes/${s.cliente.id}`}
                        className="hover:underline"
                      >
                        {s.cliente.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.intermediario?.nombre ?? "—"}</TableCell>
                    <TableCell>{formatDate(s.fechaInicio)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(montoTotalServicio(s))}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/servicios/${s.id}`}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Ver detalle de ${s.descripcion}`}
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
