"use client";

import { useState, useTransition } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Copy, Trash2, GripVertical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { SubtareaChecklist, type SubtareaData } from "@/components/tareas/subtarea-checklist";
import type { VinculoOption } from "@/components/tareas/tarea-form";
import {
  actualizarTarea,
  cambiarPrioridad,
  duplicarTarea,
  eliminarTarea,
} from "@/app/admin/tareas/actions";
import { PRIORIDAD_COLOR, PRIORIDAD_BAR } from "@/lib/status-colors";
import type { PrioridadTarea } from "@/generated/prisma/client";

export type TareaCardData = {
  id: number;
  titulo: string;
  descripcion: string | null;
  prioridad: PrioridadTarea;
  fechaLimite: Date | null;
  completada: boolean;
  servicioId: number | null;
  cotizacionId: number | null;
  asignadoAId: number | null;
  servicio?: { descripcion: string } | null;
  cotizacion?: { cliente: { nombre: string } } | null;
  subtareas: SubtareaData[];
};

const PRIORIDAD_CICLO: Record<PrioridadTarea, PrioridadTarea> = {
  Baja: "Media",
  Media: "Alta",
  Alta: "Baja",
};

function vinculoInfo(tarea: TareaCardData): { icono: string; label: string | null; valor?: string } {
  if (tarea.servicioId && tarea.servicio) {
    return { icono: "💼", label: tarea.servicio.descripcion, valor: `servicio:${tarea.servicioId}` };
  }
  if (tarea.cotizacionId && tarea.cotizacion) {
    return { icono: "📄", label: tarea.cotizacion.cliente.nombre, valor: `cotizacion:${tarea.cotizacionId}` };
  }
  return { icono: "📌", label: null };
}

export function TareaCard({
  tarea,
  puedeEditar,
  puedeCrear,
  compacto,
  vinculos,
  usuarios,
  usuarioActualId,
}: {
  tarea: TareaCardData;
  puedeEditar: boolean;
  puedeCrear: boolean;
  compacto: boolean;
  vinculos: VinculoOption[];
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [oculta, setOculta] = useState(false);
  const vinculo = vinculoInfo(tarea);
  const vencida = !tarea.completada && tarea.fechaLimite && tarea.fechaLimite < new Date();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarea.id,
    disabled: !puedeEditar,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  function handleCiclarPrioridad() {
    if (!puedeEditar || isPending) return;
    const siguiente = PRIORIDAD_CICLO[tarea.prioridad];
    startTransition(() => {
      cambiarPrioridad(tarea.id, siguiente);
    });
  }

  function handleDuplicar() {
    if (!puedeCrear || isPending) return;
    startTransition(() => {
      duplicarTarea(tarea.id);
    });
  }

  function handleEliminar() {
    if (!puedeEditar || isPending) return;
    setOculta(true);
    startTransition(() => {
      eliminarTarea(tarea.id);
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex overflow-hidden rounded-lg border border-input bg-card text-sm shadow-sm transition-all duration-300 hover:shadow-md ${
        isDragging ? "z-10 scale-[1.03] opacity-90 shadow-lg" : "scale-100 opacity-100"
      } ${oculta ? "animate-out fade-out zoom-out-95 duration-300" : "animate-in fade-in zoom-in-95 duration-300"}`}
    >
      <div className={`w-1 shrink-0 ${PRIORIDAD_BAR[tarea.prioridad]}`} />

      <div className={`flex flex-1 flex-col gap-1.5 ${compacto ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
        <div className="flex items-start gap-1.5">
          {puedeEditar && (
            <button
              type="button"
              {...listeners}
              {...attributes}
              className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
              aria-label="Arrastrar tarea"
            >
              <GripVertical className="size-3.5" />
            </button>
          )}
          <span className="shrink-0" aria-hidden>
            {vinculo.icono}
          </span>
          <span className={`min-w-0 flex-1 truncate font-medium ${tarea.completada ? "text-muted-foreground line-through" : ""}`}>
            {tarea.titulo}
          </span>
        </div>

        {!compacto && tarea.descripcion && (
          <p className="line-clamp-2 pl-1 text-xs text-muted-foreground">{tarea.descripcion}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <button
            type="button"
            onClick={handleCiclarPrioridad}
            disabled={!puedeEditar}
            className={puedeEditar ? "cursor-pointer" : "cursor-default"}
            title={puedeEditar ? "Click para cambiar prioridad" : undefined}
          >
            <Badge className={`text-[10px] ${PRIORIDAD_COLOR[tarea.prioridad]}`}>
              {tarea.prioridad}
            </Badge>
          </button>

          {vinculo.label && (
            <Badge variant="outline" className="max-w-32 truncate text-[10px]">
              {vinculo.label}
            </Badge>
          )}

          {tarea.fechaLimite && (
            <span className={`text-[10px] ${vencida ? "text-destructive" : "text-muted-foreground"}`}>
              {formatDate(tarea.fechaLimite)}
            </span>
          )}
        </div>

        <SubtareaChecklist tareaId={tarea.id} subtareas={tarea.subtareas} puedeEditar={puedeEditar} />
      </div>

      {(puedeEditar || puedeCrear) && (
        <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {puedeEditar && (
            <TareaFormDialog
              trigger={
                <Button size="icon" variant="ghost" className="size-6 bg-card/80">
                  <Pencil className="size-3" />
                </Button>
              }
              title="Editar tarea"
              submitLabel="Guardar cambios"
              action={actualizarTarea.bind(null, tarea.id)}
              vinculos={vinculos}
              usuarios={usuarios}
              usuarioActualId={usuarioActualId}
              defaultValues={{
                titulo: tarea.titulo,
                descripcion: tarea.descripcion,
                prioridad: tarea.prioridad,
                fechaLimite: tarea.fechaLimite,
                asignadoAId: tarea.asignadoAId,
                vinculo: vinculo.valor,
              }}
            />
          )}
          {puedeCrear && (
            <Button size="icon" variant="ghost" className="size-6 bg-card/80" onClick={handleDuplicar}>
              <Copy className="size-3" />
            </Button>
          )}
          {puedeEditar && (
            <Button
              size="icon"
              variant="ghost"
              className="size-6 bg-card/80 text-destructive hover:text-destructive"
              onClick={handleEliminar}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
