"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";

import { alternarSubtarea, crearSubtarea, eliminarSubtarea } from "@/app/admin/tareas/actions";

export type SubtareaData = { id: number; titulo: string; completada: boolean };

export function SubtareaChecklist({
  tareaId,
  subtareas,
  puedeEditar,
}: {
  tareaId: number;
  subtareas: SubtareaData[];
  puedeEditar: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [, startTransition] = useTransition();

  const total = subtareas.length;
  const completadas = subtareas.filter((s) => s.completada).length;
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

  if (total === 0 && !puedeEditar) return null;

  function handleAgregar() {
    const titulo = nuevoTitulo.trim();
    if (!titulo) return;
    setNuevoTitulo("");
    startTransition(() => {
      crearSubtarea(tareaId, titulo);
    });
  }

  return (
    <div className="pl-1" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {abierto ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {total > 0 ? (
          <>
            <span className="tabular-nums">
              {completadas}/{total} subtareas
            </span>
            <span className="h-1 flex-1 max-w-16 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </span>
          </>
        ) : (
          <span>Subtareas</span>
        )}
      </button>

      {abierto && (
        <div className="mt-1.5 flex flex-col gap-1">
          {subtareas.map((s) => (
            <div key={s.id} className="group/sub flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={s.completada}
                disabled={!puedeEditar}
                onChange={(e) => {
                  const checked = e.target.checked;
                  startTransition(() => {
                    alternarSubtarea(s.id, checked);
                  });
                }}
                className="size-3 shrink-0 accent-primary"
              />
              <span
                className={`min-w-0 flex-1 truncate text-xs ${s.completada ? "text-muted-foreground line-through" : ""}`}
              >
                {s.titulo}
              </span>
              {puedeEditar && (
                <button
                  type="button"
                  onClick={() => startTransition(() => eliminarSubtarea(s.id))}
                  className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover/sub:opacity-100"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}

          {puedeEditar && (
            <div className="mt-0.5 flex items-center gap-1">
              <input
                type="text"
                value={nuevoTitulo}
                onChange={(e) => setNuevoTitulo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAgregar();
                  }
                }}
                placeholder="Agregar subtarea..."
                className="h-6 min-w-0 flex-1 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring"
              />
              <button
                type="button"
                onClick={handleAgregar}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
