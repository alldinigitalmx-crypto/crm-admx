import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Package } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import {
  PRODUCTO_CATEGORIA_COLOR as CATEGORIA_COLOR,
  PRODUCTO_CATEGORIA_ICON as CATEGORIA_ICON,
  ACTIVO_COLOR,
  INACTIVO_COLOR,
} from "@/lib/status-colors";
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
import { ProductoFormDialog } from "@/components/productos/producto-form-dialog";
import { DeleteProductoButton } from "@/components/productos/delete-producto-button";
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
} from "@/app/admin/productos/actions";
import type { CategoriaProducto, Prisma } from "@/generated/prisma/client";

const CATEGORIAS = ["Plantilla", "Sistema", "Otro"];

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; activo?: string }>;
}) {
  const { categoria, activo } = await searchParams;

  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Productos");
  if (!permisos.puedeVer) redirect("/admin");

  const where: Prisma.ProductoWhereInput = {};
  if (categoria) where.categoria = categoria as CategoriaProducto;
  if (activo) where.activo = activo === "true";

  const hasFiltros = Boolean(categoria || activo);

  const productos = await prisma.producto.findMany({
    where,
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-muted-foreground">
            {productos.length} producto{productos.length === 1 ? "" : "s"}
            {hasFiltros
              ? " con estos filtros"
              : " registrado" + (productos.length === 1 ? "" : "s")}
          </p>
        </div>
        {permisos.puedeCrear && (
          <ProductoFormDialog title="Nuevo producto" action={crearProducto} submitLabel="Crear producto" />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select name="categoria" defaultValue={categoria ?? ""} className={selectClass}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select name="activo" defaultValue={activo ?? ""} className={selectClass}>
              <option value="">Todos los status</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/productos">Limpiar</Link>
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
          {productos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros ? "No hay productos con esos filtros." : "Aún no hay productos registrados."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((p) => {
                    const Icono = CATEGORIA_ICON[p.categoria] ?? Package;
                    return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${CATEGORIA_COLOR[p.categoria]}`}
                          >
                            <Icono className="size-3.5" />
                          </span>
                          {p.nombre}
                        </div>
                      </TableCell>
                      <TableCell>{p.categoria}</TableCell>
                      <TableCell>
                        <Badge className={p.activo ? ACTIVO_COLOR : INACTIVO_COLOR}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.requiereCotizacion ? "A cotizar" : formatCurrency(p.precio)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {permisos.puedeEditar && (
                            <ProductoFormDialog
                              trigger={
                                <Button size="icon" variant="ghost" className="size-7">
                                  <Pencil className="size-4" />
                                </Button>
                              }
                              title="Editar producto"
                              action={actualizarProducto.bind(null, p.id)}
                              defaultValues={{
                                nombre: p.nombre,
                                descripcion: p.descripcion,
                                categoria: p.categoria,
                                precio: Number(p.precio),
                                costoReferencia: p.costoReferencia ? Number(p.costoReferencia) : null,
                                requiereCotizacion: p.requiereCotizacion,
                                activo: p.activo,
                              }}
                              submitLabel="Guardar cambios"
                            />
                          )}
                          {permisos.puedeEditar && (
                            <DeleteProductoButton action={eliminarProducto.bind(null, p.id)} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {productos.map((p) => {
                  const Icono = CATEGORIA_ICON[p.categoria] ?? Package;
                  return (
                    <MobileRecordCard
                      key={p.id}
                      avatarLabel={<Icono className="size-5" />}
                      avatarClassName={CATEGORIA_COLOR[p.categoria]}
                      title={p.nombre}
                      subtitle={p.categoria}
                      meta={p.requiereCotizacion ? "A cotizar" : formatCurrency(p.precio)}
                      badge={
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            p.activo ? ACTIVO_COLOR : INACTIVO_COLOR
                          }`}
                        >
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                      }
                      actions={
                        <>
                          {permisos.puedeEditar && (
                            <ProductoFormDialog
                              trigger={
                                <Button size="icon" variant="ghost" className="size-7">
                                  <Pencil className="size-4" />
                                </Button>
                              }
                              title="Editar producto"
                              action={actualizarProducto.bind(null, p.id)}
                              defaultValues={{
                                nombre: p.nombre,
                                descripcion: p.descripcion,
                                categoria: p.categoria,
                                precio: Number(p.precio),
                                costoReferencia: p.costoReferencia ? Number(p.costoReferencia) : null,
                                requiereCotizacion: p.requiereCotizacion,
                                activo: p.activo,
                              }}
                              submitLabel="Guardar cambios"
                            />
                          )}
                          {permisos.puedeEditar && (
                            <DeleteProductoButton action={eliminarProducto.bind(null, p.id)} />
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
