import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil } from "lucide-react";

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
import { VentaFormDialog } from "@/components/ventas/venta-form-dialog";
import { VentaDetalleDialog } from "@/components/ventas/venta-detalle-dialog";
import { DeleteVentaButton } from "@/components/ventas/delete-venta-button";
import { actualizarVenta, crearVenta, eliminarVenta } from "@/app/admin/ventas/actions";
import type { CanalVenta, OrigenVenta, Prisma } from "@/generated/prisma/client";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ origen?: string; canal?: string; desde?: string; hasta?: string }>;
}) {
  const { origen, canal, desde, hasta } = await searchParams;

  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Ventas");
  if (!permisos.puedeVer) redirect("/admin");

  const [productos, clientes] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, precio: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.cliente.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);

  const productoOpciones = productos.map((p) => ({ id: p.id, nombre: p.nombre, precio: Number(p.precio) }));

  const where: Prisma.VentaWhereInput = {};
  if (origen) where.origen = origen as OrigenVenta;
  if (canal) where.canal = canal as CanalVenta;
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }

  const hasFiltros = Boolean(origen || canal || desde || hasta);

  const ventas = await prisma.venta.findMany({
    where,
    include: { detalles: { include: { producto: true } }, referidoPor: true },
    orderBy: { fecha: "desc" },
  });

  const totalGeneral = ventas.reduce((acc, v) => acc + Number(v.total), 0);
  const totalTiendaOnline = ventas
    .filter((v) => v.origen === "TiendaOnline")
    .reduce((acc, v) => acc + Number(v.total), 0);
  const totalManual = ventas
    .filter((v) => v.origen === "Manual")
    .reduce((acc, v) => acc + Number(v.total), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            {ventas.length} venta{ventas.length === 1 ? "" : "s"}
            {hasFiltros ? " con estos filtros" : " registrada" + (ventas.length === 1 ? "" : "s")}
          </p>
        </div>
        {permisos.puedeCrear &&
          (productoOpciones.length > 0 ? (
            <VentaFormDialog
              title="Nueva venta"
              description="Registra una venta manual o de la tienda online."
              action={crearVenta}
              productos={productoOpciones}
              clientes={clientes}
              submitLabel="Registrar venta"
            />
          ) : (
            <Button disabled title="Primero registra un producto">
              Nueva venta
            </Button>
          ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">Tienda Online</p>
            <p className="text-xl font-semibold">{formatCurrency(totalTiendaOnline)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">Manual (otros medios)</p>
            <p className="text-xl font-semibold">{formatCurrency(totalManual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-semibold">{formatCurrency(totalGeneral)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select name="origen" defaultValue={origen ?? ""} className={selectClass}>
              <option value="">Todos los orígenes</option>
              <option value="TiendaOnline">Tienda Online</option>
              <option value="Manual">Manual</option>
            </select>

            <select name="canal" defaultValue={canal ?? ""} className={selectClass}>
              <option value="">Todos los canales</option>
              <option value="Directo">Directo</option>
              <option value="Referido">Referido</option>
              <option value="GrupoWhatsApp">Grupo de WhatsApp</option>
              <option value="Otro">Otro</option>
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

            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/ventas">Limpiar</Link>
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
          {ventas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros ? "No hay ventas con esos filtros." : "Aún no hay ventas registradas."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((v) => {
                  const ventaDetalle = {
                    id: v.id,
                    fecha: v.fecha,
                    origen: v.origen,
                    canal: v.canal,
                    nombreComprador: v.nombreComprador,
                    emailComprador: v.emailComprador,
                    metodoPago: v.metodoPago,
                    total: Number(v.total),
                    tipoEntrega: v.tipoEntrega,
                    referidoPor: v.referidoPor ? { nombre: v.referidoPor.nombre } : null,
                    comisionReferido: v.comisionReferido ? Number(v.comisionReferido) : null,
                    detalles: v.detalles.map((d) => ({
                      productoNombre: d.producto.nombre,
                      cantidad: d.cantidad,
                      precioUnitario: Number(d.precioUnitario),
                      subtotal: Number(d.subtotal),
                    })),
                  };
                  const ventaEditDefaults = {
                    fecha: v.fecha,
                    origen: v.origen,
                    canal: v.canal,
                    nombreComprador: v.nombreComprador,
                    emailComprador: v.emailComprador,
                    metodoPago: v.metodoPago,
                    tipoEntrega: v.tipoEntrega,
                    referidoPorId: v.referidoPorId,
                    comisionReferido: v.comisionReferido ? Number(v.comisionReferido) : null,
                    items: v.detalles.map((d) => ({
                      productoId: String(d.productoId),
                      cantidad: d.cantidad,
                      precioUnitario: Number(d.precioUnitario),
                    })),
                  };
                  return (
                    <TableRow key={v.id}>
                      <TableCell>{formatDate(v.fecha)}</TableCell>
                      <TableCell className="font-medium">
                        {v.nombreComprador ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.origen === "TiendaOnline" ? "default" : "outline"}>
                          {v.origen === "TiendaOnline" ? "Tienda Online" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell>{v.canal ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(v.total)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <VentaDetalleDialog venta={ventaDetalle} />
                          {permisos.puedeEditar && (
                            <VentaFormDialog
                              trigger={
                                <Button size="icon" variant="ghost" className="size-7">
                                  <Pencil className="size-4" />
                                </Button>
                              }
                              title="Editar venta"
                              action={actualizarVenta.bind(null, v.id)}
                              productos={productoOpciones}
                              clientes={clientes}
                              defaultValues={ventaEditDefaults}
                              submitLabel="Guardar cambios"
                            />
                          )}
                          {permisos.puedeEditar && (
                            <DeleteVentaButton action={eliminarVenta.bind(null, v.id)} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
