import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
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
import { QuejaFormDialog } from "@/components/quejas/queja-form-dialog";
import { QuejaDetalleDialog } from "@/components/quejas/queja-detalle-dialog";
import { DeleteQuejaButton } from "@/components/quejas/delete-queja-button";
import { actualizarQueja, crearQueja, eliminarQueja } from "@/app/admin/quejas/actions";
import type { CategoriaQueja, Prisma, StatusQueja } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Nueva: "outline",
  EnRevision: "default",
  Resuelta: "secondary",
  Cerrada: "secondary",
};

const STATUSES = ["Nueva", "EnRevision", "Resuelta", "Cerrada"];
const CATEGORIAS = ["Falla", "Cobro", "Atencion", "Otro"];

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

  const verTodo = await puedeVerTodo(usuario, "Quejas");

  const where: Prisma.QuejaWhereInput = {};
  if (status) where.status = status as StatusQueja;
  if (categoria) where.categoria = categoria as CategoriaQueja;
  if (clienteId) where.clienteId = Number(clienteId);
  if (!verTodo && usuario) {
    where.OR = [{ asignadoAId: usuario.id }, { servicio: { responsableId: usuario.id } }];
  }

  const hasFiltros = Boolean(status || categoria || clienteId);

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
        {clientesConServicios.length > 0 ? (
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
        )}
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
            <Table>
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
                {quejas.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/clientes/${q.cliente.id}`} className="hover:underline">
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
                      <Badge variant={STATUS_VARIANT[q.status] ?? "outline"}>{q.status}</Badge>
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
                          action={actualizarQueja.bind(null, q.id)}
                          usuarios={usuarios}
                        />
                        <DeleteQuejaButton action={eliminarQueja.bind(null, q.id)} />
                      </div>
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
