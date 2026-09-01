"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Columna = { key: string; label: string; ancha?: boolean };
type Fila = Record<string, string>;
type Respuesta = { columnas: Columna[]; filas: Fila[]; totalCount: number; truncado: boolean };

// Vista para móvil: cada fila como tarjeta apilada (mismo espíritu que
// MobileRecordCard) en vez de una tabla ancha -- evita el scroll lateral
// que tenía la tabla en pantallas angostas. Genérica a propósito (no
// sabe qué es cada columna): la 1ra columna siempre es la fecha, la 2da
// es el identificador principal (servicio/descripción/nombre), la
// última suele ser el monto o la etiqueta -- con eso alcanza para las 6
// formas de detalle sin necesitar una tarjeta distinta por tipo.
function FilaMovil({ columnas, fila }: { columnas: Columna[]; fila: Fila }) {
  const [colFecha, colTitulo, ...resto] = columnas;
  const colDestacada = resto[resto.length - 1];
  const colsIntermedias = resto.slice(0, -1);
  const detalle = [fila[colFecha.key], ...colsIntermedias.map((c) => fila[c.key])]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{fila[colTitulo?.key ?? colFecha.key]}</p>
        {colDestacada && (
          <p className="shrink-0 text-sm font-semibold tabular-nums">{fila[colDestacada.key]}</p>
        )}
      </div>
      {detalle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

// Abre los registros detrás de una tarjeta de Reportes sin salir de la
// página (ni en PC ni en móvil) -- mismo Dialog que ya se usa para
// editar Pagos/Gastos en el resto del CRM. El Excel completo (sin el
// tope de filas del modal) sigue siendo el link de exportar del módulo
// correspondiente.
export function DetalleDialog({
  tipo,
  titulo,
  rangoQS,
  exportHref,
}: {
  tipo: string;
  titulo: string;
  rangoQS: string;
  exportHref: string;
}) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Evita "setState en un componente ya desmontado" si el diálogo se
  // cierra (o el usuario navega) antes de que responda el fetch.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function onOpenChange(open: boolean) {
    if (!open || datos || cargando) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/admin/reportes/detalle?tipo=${tipo}&${rangoQS}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("No se pudo cargar el detalle.");
      setDatos(await res.json());
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "No se pudo cargar el detalle.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
        >
          Ver detalles
          <ChevronRight className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {datos
              ? `${datos.totalCount} registro${datos.totalCount === 1 ? "" : "s"} en este rango.`
              : "Mismo rango de fechas que estás viendo en Reportes."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Download />
              Exportar Excel
            </a>
          </Button>
        </div>

        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando...
            </div>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : !datos || datos.filas.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No hay registros en este rango.</p>
          ) : (
            <>
              {/* Escritorio: tabla clásica, cabe sin scroll lateral con
                  el ancho del modal. */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    {datos.columnas.map((c) => (
                      <TableHead key={c.key}>{c.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.filas.map((fila, i) => (
                    <TableRow key={i}>
                      {datos.columnas.map((c) => (
                        <TableCell
                          key={c.key}
                          className={
                            c.ancha
                              ? "max-w-0 min-w-40 whitespace-normal break-words"
                              : "whitespace-nowrap"
                          }
                        >
                          {fila[c.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas apiladas, sin scroll lateral. */}
              <div className="flex flex-col gap-2 md:hidden">
                {datos.filas.map((fila, i) => (
                  <FilaMovil key={i} columnas={datos.columnas} fila={fila} />
                ))}
              </div>

              {datos.truncado && (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Mostrando los primeros {datos.filas.length} de {datos.totalCount} — descarga el
                  Excel para verlos todos.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
