"use client";

import { useState } from "react";
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

type Columna = { key: string; label: string };
type Fila = Record<string, string>;
type Respuesta = { columnas: Columna[]; filas: Fila[]; totalCount: number; truncado: boolean };

// Abre los registros detrás de una tarjeta de Reportes sin salir de la
// página (ni en PC ni en móvil) -- mismo Dialog que ya se usa para
// editar Pagos/Gastos en el resto del CRM, así que el comportamiento en
// móvil ya viene resuelto. El Excel completo (sin el tope de filas del
// modal) sigue siendo el link de exportar del módulo correspondiente.
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

  async function onOpenChange(open: boolean) {
    if (!open || datos || cargando) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/admin/reportes/detalle?tipo=${tipo}&${rangoQS}`);
      if (!res.ok) throw new Error("No se pudo cargar el detalle.");
      setDatos(await res.json());
    } catch (e) {
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
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {datos
              ? `${datos.totalCount} registro${datos.totalCount === 1 ? "" : "s"} en este rango.`
              : "Mismo rango de fechas que estás viendo en Reportes."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <span />
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Download />
              Exportar Excel
            </a>
          </Button>
        </div>

        <div className="-mx-6 overflow-auto px-6" style={{ maxHeight: "60vh" }}>
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
              <Table>
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
                        <TableCell key={c.key} className="whitespace-nowrap">
                          {fila[c.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
