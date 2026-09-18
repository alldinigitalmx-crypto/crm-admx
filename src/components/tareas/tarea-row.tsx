"use client";

import { useTransition } from "react";
import { Check, Pencil, Copy, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { SubtareaChecklist, type SubtareaData } from "@/components/tareas/subtarea-checklist";
import type { VinculoOption } from "@/components/tareas/tarea-form";
import { actualizarTarea, cambiarPrioridad, duplicarTarea, eliminarTarea } from "@/app/admin/tareas/actions";
import { PRIORIDAD_COLOR, PRIORIDAD_BAR } from "@/lib/status-colors";
import { nombreClienteCotizacion } from "@/lib/cotizacion";
import type { PrioridadTarea } from "@/generated/prisma/client";

export type TareaFila = {
  id: number;
  titulo: string;
  descripcion: string | null;
  prioridad: PrioridadTarea;
  fechaLimite: Date | null;
  completada: boolean;
  servicioId: number | null;
  cotizacionId: number | null;
  clienteId: number | null;
  asignadoAId: number | null;
  servicio?: { descripcion: string } | null;
  cotizacion?: { cliente: { nombre: string } | null; prospectoNombre?: string | null } | null;
  cliente?: { nombre: string } | null;
  subtareas: SubtareaData[];
};

const PRIORIDAD_CICLO: Record<PrioridadTarea, PrioridadTarea> = {
  Baja: "Media",
  Media: "Alta",
  Alta: "Baja",
};

export function vinculoInfo(tarea: TareaFila): { icono: string; label: string | null; valor?: string } {
  if (tarea.servicioId && tarea.servicio) {
    return { icono: "💼", label: tarea.servicio.descripcion, valor: `servicio:${tarea.servicioId}` };
  }
  if (tarea.cotizacionId && tarea.cotizacion) {
    return {
      icono: "📄",
      label: nombreClienteCotizacion(tarea.cotizacion),
      valor: `cotizacion:${tarea.cotizacionId}`,
    };
  }
  if (tarea.clienteId && tarea.cliente) {
    return { icono: "👤", label: tarea.cliente.nombre, valor: `cliente:${tarea.clienteId}` };
  }
  return { icono: "📌", label: null };
}

export function TareaRow({
  tarea,
  variante,
  compacto,
  puedeEditar,
  puedeCrear,
  vinculos,
  usuarios,
  usuarioActualId,
  asignadoNombre,
  onToggleCompletada,
}: {
  tarea: TareaFila;
  variante: "desktop" | "mobile";
  compacto: boolean;
  puedeEditar: boolean;
  puedeCrear: boolean;
  vinculos: VinculoOption[];
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
  asignadoNombre: string | null;
  onToggleCompletada: (id: number, completada: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const vinculo = vinculoInfo(tarea);
  const vencida = !tarea.completada && tarea.fechaLimite !== null && tarea.fechaLimite < new Date();
  const totalSub = tarea.subtareas.length;
  const hechasSub = tarea.subtareas.filter((s) => s.completada).length;

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
    startTransition(() => {
      eliminarTarea(tarea.id);
    });
  }

  const checkSize = variante === "mobile" ? "size-7" : "size-[18px]";

  const acciones = (puedeEditar || puedeCrear) && (
    <div
      className={
        variante === "mobile"
          ? "flex shrink-0 gap-0.5"
          : "flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      }
    >
      {puedeEditar && (
        <TareaFormDialog
          trigger={
            <Button size="icon" variant="ghost" className="size-7">
              <Pencil className="size-3.5" />
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
        <Button size="icon" variant="ghost" className="size-7" onClick={handleDuplicar}>
          <Copy className="size-3.5" />
        </Button>
      )}
      {puedeEditar && (
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-destructive hover:text-destructive"
          onClick={handleEliminar}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );

  if (variante === "mobile") {
    return (
      <div className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 border-b border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={() => puedeEditar && onToggleCompletada(tarea.id, !tarea.completada)}
          disabled={!puedeEditar}
          aria-label={tarea.completada ? "Marcar como pendiente" : "Completar"}
          className={`${checkSize} flex items-center justify-center rounded-lg border-[1.5px] ${
            tarea.completada ? "border-primary bg-primary text-primary-foreground" : "border-input bg-transparent"
          }`}
        >
          {tarea.completada && <Check className="size-4" />}
        </button>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <span className={`mt-1 h-4 w-[3px] shrink-0 rounded-sm ${PRIORIDAD_BAR[tarea.prioridad]}`} />
              <span
                className={`text-[14.5px] font-medium leading-snug ${
                  tarea.completada ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {tarea.titulo}
              </span>
            </div>
            {acciones}
          </div>

          <div className="flex flex-wrap items-center gap-2 pl-[11px] text-[11px] text-muted-foreground">
            {tarea.fechaLimite && (
              <span className={vencida ? "font-medium text-destructive" : undefined}>{formatDate(tarea.fechaLimite)}</span>
            )}
            {vinculo.label && (
              <>
                <span className="h-2.5 w-px bg-border" />
                <span className="max-w-[150px] truncate">{vinculo.label}</span>
              </>
            )}
            {totalSub > 0 && (
              <>
                <span className="h-2.5 w-px bg-border" />
                <span className="tabular-nums">
                  {hechasSub}/{totalSub}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-3.5 border-b border-border/60 px-7 py-3 hover:bg-muted/30">
      <button
        type="button"
        onClick={() => puedeEditar && onToggleCompletada(tarea.id, !tarea.completada)}
        disabled={!puedeEditar}
        aria-label={tarea.completada ? "Marcar como pendiente" : "Completar"}
        className={`${checkSize} mt-0.5 flex items-center justify-center rounded-[4px] border-[1.5px] ${
          tarea.completada ? "border-primary bg-primary text-primary-foreground" : "border-input bg-transparent"
        }`}
      >
        {tarea.completada && <Check className="size-3" />}
      </button>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-[13px] w-[3px] shrink-0 rounded-sm ${PRIORIDAD_BAR[tarea.prioridad]}`} />
          <button
            type="button"
            onClick={handleCiclarPrioridad}
            disabled={!puedeEditar}
            title={puedeEditar ? "Click para cambiar prioridad" : undefined}
            className={`truncate text-[14px] font-medium ${
              tarea.completada ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {tarea.titulo}
          </button>
          {vinculo.label && (
            <Badge variant="outline" className="shrink-0 max-w-40 truncate text-[10px]">
              {vinculo.label}
            </Badge>
          )}
          <Badge className={`shrink-0 text-[10px] ${PRIORIDAD_COLOR[tarea.prioridad]}`}>{tarea.prioridad}</Badge>
        </div>

        {!compacto && tarea.descripcion && (
          <p className="truncate pl-[11px] text-[12.5px] text-muted-foreground">{tarea.descripcion}</p>
        )}

        <div className="flex items-center gap-3 pl-[11px]">
          <SubtareaChecklist tareaId={tarea.id} subtareas={tarea.subtareas} puedeEditar={puedeEditar} />
          {asignadoNombre && (
            <span className="text-[10.5px] text-muted-foreground">{asignadoNombre}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-0.5">
        {tarea.fechaLimite && (
          <span className={`whitespace-nowrap text-[11.5px] tabular-nums ${vencida ? "font-medium text-destructive" : "text-muted-foreground"}`}>
            {formatDate(tarea.fechaLimite)}
          </span>
        )}
        {acciones}
      </div>
    </div>
  );
}
