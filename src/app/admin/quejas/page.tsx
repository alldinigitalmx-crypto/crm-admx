import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
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
import { Download, AlertCircle } from "lucide-react";
import { QUEJA_STATUS_COLOR as STATUS_COLOR, QUEJA_STATUS_ICON as STATUS_ICON } from "@/lib/status-colors";
import { QuejaFormDialog } from "@/components/quejas/queja-form-dialog";
import { QuejaDetalleDialog } from "@/components/quejas/queja-detalle-dialog";
import { DeleteQuejaButton } from "@/components/quejas/delete-queja-button";
import { actualizarQueja, crearQueja, eliminarQueja } from "@/app/admin/quejas/actions";
import type { CategoriaQueja, Prisma, StatusQueja } from "@/generated/prisma/client";

const STATUSES = ["Nueva", "EnRevision", "Resuelta", "Cerrada"];
const CATEGORIAS = ["Falla", "Cobro", "Atencion", "Sugerencia", "Otro"];

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function QuejasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; categoria?: string; clienteId?: string }>;
}) {
  const { status, categoria, clienteId } = await searchParams;

  const [clientesConServicios, usuarios, usuario] = await Promise.all([
    prisma.cliente.findMany({
      select: {
        id: true,
        nombre: true,
        servicios: { select: { id: true, descripcion: true }, orderBy: { creadoEn: "desc" } },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    currentUsuario(),
  ]);

  const permisos = await permisosModulo(usuario, "Quejas");
  if (!permisos.puedeVer) redirect("/admin");

  const where: Prisma.QuejaWhereInput = {};
  if (status) where.status = status as StatusQueja;
  if (categoria) where.categoria = categoria as CategoriaQueja;
  if (clienteId) where.clienteId = Number(clienteId);
  if (!permisos.verTodo && usuario) {
    where.OR = [{ asignadoAId: usuario.id }, { servicio: { responsableId: usuario.id } }];
  }

  const hasFiltros = Boolean(status || categoria || clienteId);

  const exportParams = new URLSearchParams();
  if (status) exportParams.set("status", status);
  if (categoria) exportParams.set("categoria", categoria);
  if (clienteId) exportParams.set("clienteId", clienteId);

  const quejas = await prisma.queja.findMany({
    where,
    include: { cliente: true, servicio: true },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quejas / Help Desk</h1>
          <p className="text-sm text-muted-foreground">
            {quejas.length} queja{quejas.length === 1 ? "" : "s"}
            {hasFiltros ? " con estos filtros" : " registrada" + (quejas.length === 1 ? "" : "s")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/quejas/export?${exportParams.toString()}`}>
              <Download />
              Exportar Excel
            </a>
          </Button>
          {permisos.puedeCrear &&
            (clientesConServicios.length > 0 ? (
              <QuejaFormDialog
                triggerLabel="Nueva queja"
                description="Registra una queja o ticket de soporte a nombre de un cliente."
                action={crearQueja}
                clientes={clientesConServicios}
              />
            ) : (
              <Button disabled title="Primero registra un cliente">
                Nueva queja
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
              {clientesConServicios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <select name="categoria" defaultValue={categoria ?? ""} className={selectClass}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
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

            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/quejas">Limpiar</Link>
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
          {quejas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros ? "No hay quejas con esos filtros." : "Aún no hay quejas registradas."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quejas.map((q) => {
                    const Icono = STATUS_ICON[q.status] ?? AlertCircle;
                    return (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/clientes/${q.cliente.id}`}
                          className="flex items-center gap-2.5 hover:underline"
                        >
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${STATUS_COLOR[q.status]}`}
                          >
                            <Icono className="size-3.5" />
                          </span>
                          {q.cliente.nombre}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {q.servicio ? (
                          <Link
                            href={`/admin/servicios/${q.servicio.id}`}
                            className="hover:underline"
                          >
                            {q.servicio.descripcion}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{q.categoria}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLOR[q.status]}>{q.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(q.creadoEn)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <QuejaDetalleDialog
                            queja={{
                              id: q.id,
                              categoria: q.categoria,
                              descripcion: q.descripcion,
                              status: q.status,
                              respuesta: q.respuesta,
                              creadoEn: q.creadoEn,
                              respondidoEn: q.respondidoEn,
                              cliente: { nombre: q.cliente.nombre },
                              servicio: q.servicio ? { descripcion: q.servicio.descripcion } : null,
                              asignadoAId: q.asignadoAId,
                            }}
                            action={permisos.puedeEditar ? actualizarQueja.bind(null, q.id) : undefined}
                            usuarios={usuarios}
                          />
                          {permisos.puedeEditar && (
                            <DeleteQuejaButton action={eliminarQueja.bind(null, q.id)} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {quejas.map((q) => {
                  const Icono = STATUS_ICON[q.status] ?? AlertCircle;
                  return (
                    <MobileRecordCard
                      key={q.id}
                      avatarLabel={<Icono className="size-5" />}
                      avatarClassName={STATUS_COLOR[q.status]}
                      title={q.cliente.nombre}
                      subtitle={`${q.categoria} · ${q.servicio?.descripcion ?? "Sin servicio"}`}
                      meta={formatDate(q.creadoEn)}
                      badge={
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[q.status]}`}
                        >
                          {q.status}
                        </span>
                      }
                      actions={
                        <>
                          <QuejaDetalleDialog
                            queja={{
                              id: q.id,
                              categoria: q.categoria,
                              descripcion: q.descripcion,
                              status: q.status,
                              respuesta: q.respuesta,
                              creadoEn: q.creadoEn,
                              respondidoEn: q.respondidoEn,
                              cliente: { nombre: q.cliente.nombre },
                              servicio: q.servicio ? { descripcion: q.servicio.descripcion } : null,
                              asignadoAId: q.asignadoAId,
                            }}
                            action={permisos.puedeEditar ? actualizarQueja.bind(null, q.id) : undefined}
                            usuarios={usuarios}
                          />
                          {permisos.puedeEditar && (
                            <DeleteQuejaButton action={eliminarQueja.bind(null, q.id)} />
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
