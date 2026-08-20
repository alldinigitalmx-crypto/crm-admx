import Link from "next/link";
import { Plus, Pencil } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { GASTO_AMBITO_COLOR as AMBITO_COLOR, GASTO_AMBITO_ICON } from "@/lib/status-colors";
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
import { GastoFormDialog } from "@/components/gastos/gasto-form-dialog";
import { DeleteGastoButton } from "@/components/gastos/delete-gasto-button";
import { actualizarGasto, crearGasto, eliminarGasto } from "@/app/admin/gastos/actions";
import type { AmbitoGasto, Prisma } from "@/generated/prisma/client";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ ambito?: string; categoria?: string; desde?: string; hasta?: string }>;
}) {
  const { ambito, categoria, desde, hasta } = await searchParams;

  const categoriasExistentes = await prisma.gasto.findMany({
    select: { categoria: true },
    distinct: ["categoria"],
    orderBy: { categoria: "asc" },
  });

  const where: Prisma.GastoWhereInput = {};
  if (ambito) where.ambito = ambito as AmbitoGasto;
  if (categoria) where.categoria = categoria;
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }

  const hasFiltros = Boolean(ambito || categoria || desde || hasta);

  const gastos = await prisma.gasto.findMany({ where, orderBy: { fecha: "desc" } });
  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Gastos</h1>
          <p className="text-sm text-muted-foreground">
            {gastos.length} gasto{gastos.length === 1 ? "" : "s"}
            {hasFiltros ? " con estos filtros" : " registrado" + (gastos.length === 1 ? "" : "s")}
            {" — Total: "}
            {formatCurrency(totalGastos)}
          </p>
        </div>
        <GastoFormDialog
          trigger={
            <Button>
              <Plus />
              Nuevo gasto
            </Button>
          }
          title="Nuevo gasto"
          action={crearGasto}
          submitLabel="Registrar gasto"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select name="ambito" defaultValue={ambito ?? ""} className={selectClass}>
              <option value="">Todos los ámbitos</option>
              <option value="Empresa">Empresa</option>
              <option value="Personal">Personal</option>
            </select>

            <select name="categoria" defaultValue={categoria ?? ""} className={selectClass}>
              <option value="">Todas las categorías</option>
              {categoriasExistentes.map((c) => (
                <option key={c.categoria} value={c.categoria}>
                  {c.categoria}
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

            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/gastos">Limpiar</Link>
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
          {gastos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros ? "No hay gastos con esos filtros." : "Aún no hay gastos registrados."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Ámbito</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos.map((g) => {
                    const Icono = GASTO_AMBITO_ICON[g.ambito];
                    return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${AMBITO_COLOR[g.ambito]}`}
                          >
                            <Icono className="size-3.5" />
                          </span>
                          {g.descripcion}
                        </div>
                      </TableCell>
                      <TableCell>{g.categoria}</TableCell>
                      <TableCell>
                        <Badge className={AMBITO_COLOR[g.ambito]}>{g.ambito}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(g.fecha)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(g.monto)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <GastoFormDialog
                            trigger={
                              <Button size="icon" variant="ghost" className="size-7">
                                <Pencil className="size-4" />
                              </Button>
                            }
                            title="Editar gasto"
                            action={actualizarGasto.bind(null, g.id)}
                            defaultValues={g}
                            submitLabel="Guardar cambios"
                          />
                          <DeleteGastoButton action={eliminarGasto.bind(null, g.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {gastos.map((g) => {
                  const Icono = GASTO_AMBITO_ICON[g.ambito];
                  return (
                    <MobileRecordCard
                      key={g.id}
                      avatarLabel={<Icono className="size-5" />}
                      avatarClassName={AMBITO_COLOR[g.ambito]}
                      title={g.descripcion}
                      subtitle={g.categoria}
                      meta={`${formatDate(g.fecha)} · ${formatCurrency(g.monto)}`}
                      badge={
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${AMBITO_COLOR[g.ambito]}`}
                        >
                          {g.ambito}
                        </span>
                      }
                      actions={
                        <>
                          <GastoFormDialog
                            trigger={
                              <Button size="icon" variant="ghost" className="size-7">
                                <Pencil className="size-4" />
                              </Button>
                            }
                            title="Editar gasto"
                            action={actualizarGasto.bind(null, g.id)}
                            defaultValues={g}
                            submitLabel="Guardar cambios"
                          />
                          <DeleteGastoButton action={eliminarGasto.bind(null, g.id)} />
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
