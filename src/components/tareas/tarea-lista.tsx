import Link from "next/link";
import { Check, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { completarTarea, eliminarTarea } from "@/app/admin/tareas/actions";

const PRIORIDAD_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Baja: "outline",
  Media: "secondary",
  Alta: "destructive",
};

export type TareaConVinculo = {
  id: number;
  titulo: string;
  descripcion: string | null;
  prioridad: string;
  fechaLimite: Date | null;
  completada: boolean;
  servicioId: number | null;
  cotizacionId: number | null;
  servicio?: { descripcion: string } | null;
  cotizacion?: { cliente: { nombre: string } } | null;
};

export function TareaLista({
  tareas,
  mostrarVinculo = false,
  emptyText = "No hay tareas.",
  puedeEditar = true,
}: {
  tareas: TareaConVinculo[];
  mostrarVinculo?: boolean;
  emptyText?: string;
  puedeEditar?: boolean;
}) {
  if (tareas.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {tareas.map((t) => {
        const vencida = !t.completada && t.fechaLimite && t.fechaLimite < new Date();
        const proyecto = t.servicio?.descripcion ?? t.cotizacion?.cliente.nombre ?? null;
        const href = t.servicioId
          ? `/admin/servicios/${t.servicioId}`
          : t.cotizacionId
            ? `/admin/cotizaciones/${t.cotizacionId}`
            : null;

        return (
          <li
            key={t.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-input px-3 py-2 text-sm"
          >
            <div className="flex flex-col gap-0.5">
              <span className={t.completada ? "text-muted-foreground line-through" : ""}>
                {t.titulo}
              </span>
              {t.descripcion && (
                <span className="text-xs text-muted-foreground">{t.descripcion}</span>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={PRIORIDAD_VARIANT[t.prioridad] ?? "outline"}>{t.prioridad}</Badge>
                {t.fechaLimite && (
                  <span className={`text-xs ${vencida ? "text-destructive" : "text-muted-foreground"}`}>
                    {formatDate(t.fechaLimite)}
                  </span>
                )}
                {mostrarVinculo && proyecto && href && (
                  <Link href={href} className="text-xs text-muted-foreground hover:underline">
                    {proyecto}
                  </Link>
                )}
              </div>
            </div>

            {puedeEditar && (
              <div className="flex shrink-0 gap-1">
                <form action={completarTarea.bind(null, t.id, !t.completada)}>
                  <Button type="submit" size="icon" variant="ghost" className="size-7">
                    {t.completada ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
                  </Button>
                </form>
                <form action={eliminarTarea.bind(null, t.id)}>
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
