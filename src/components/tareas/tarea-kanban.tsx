"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import confetti from "canvas-confetti";
import { Filter, LayoutGrid, List, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { TareaCard, type TareaCardData } from "@/components/tareas/tarea-card";
import type { VinculoOption } from "@/components/tareas/tarea-form";
import { crearTarea, completarTarea } from "@/app/admin/tareas/actions";

const SONIDO_KEY = "admx-tareas-sonido";
const sonidoListeners = new Set<() => void>();

function suscribirSonido(cb: () => void) {
  sonidoListeners.add(cb);
  return () => sonidoListeners.delete(cb);
}
function leerSonido() {
  return window.localStorage.getItem(SONIDO_KEY) === "true";
}
function leerSonidoServidor() {
  return false;
}
function guardarSonido(valor: boolean) {
  window.localStorage.setItem(SONIDO_KEY, String(valor));
  sonidoListeners.forEach((cb) => cb());
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Web Audio no disponible — falla en silencio.
  }
}

function Columna({
  id,
  titulo,
  count,
  children,
}: {
  id: string;
  titulo: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <Card
      ref={setNodeRef}
      className={`transition-colors duration-200 ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {titulo} ({count})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto">
        {children}
      </CardContent>
    </Card>
  );
}

export function TareaKanban({
  tareasPendientes,
  tareasCompletadas,
  puedeEditar,
  puedeCrear,
  vinculos,
  usuarios,
  usuarioActualId,
}: {
  tareasPendientes: TareaCardData[];
  tareasCompletadas: TareaCardData[];
  puedeEditar: boolean;
  puedeCrear: boolean;
  vinculos: VinculoOption[];
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
}) {
  // Overrides optimistas: mientras el servidor confirma el cambio (revalidatePath),
  // aquí se refleja de inmediato el nuevo estado de "completada" por id.
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [soloAlta, setSoloAlta] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const sonido = useSyncExternalStore(suscribirSonido, leerSonido, leerSonidoServidor);
  const yaFestejo = useRef(false);

  const todasTareas = [...tareasPendientes, ...tareasCompletadas];
  const pendientes = todasTareas.filter((t) => (overrides[t.id] ?? t.completada) === false);
  const completadas = todasTareas.filter((t) => (overrides[t.id] ?? t.completada) === true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  function toggleSonido() {
    guardarSonido(!sonido);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!puedeEditar) return;
    const { active, over } = event;
    if (!over) return;

    const id = Number(active.id);
    const destino = String(over.id);
    const tarea = todasTareas.find((t) => t.id === id);
    if (!tarea) return;
    const estaCompletada = overrides[id] ?? tarea.completada;

    if (destino === "completadas" && !estaCompletada) {
      setOverrides((prev) => ({ ...prev, [id]: true }));
      completarTarea(id, true);
      if (sonido) playChime();

      const quedanPendientes = pendientes.filter((t) => t.id !== id).length;
      if (quedanPendientes === 0 && !yaFestejo.current) {
        yaFestejo.current = true;
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
      }
    } else if (destino === "pendientes" && estaCompletada) {
      setOverrides((prev) => ({ ...prev, [id]: false }));
      yaFestejo.current = false;
      completarTarea(id, false);
    }
  }

  const pendientesFiltradas = soloAlta ? pendientes.filter((t) => t.prioridad === "Alta") : pendientes;
  const completadasFiltradas = soloAlta ? completadas.filter((t) => t.prioridad === "Alta") : completadas;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={soloAlta ? "default" : "outline"}
            onClick={() => setSoloAlta((v) => !v)}
          >
            <Filter />
            Solo alta prioridad
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCompacto((v) => !v)}>
            {compacto ? <LayoutGrid /> : <List />}
            {compacto ? "Vista expandida" : "Vista compacta"}
          </Button>
          <Button size="sm" variant="outline" onClick={toggleSonido}>
            {sonido ? <Volume2 /> : <VolumeX />}
            Sonido
          </Button>
        </div>

        {puedeCrear && (
          <TareaFormDialog
            action={crearTarea}
            vinculos={vinculos}
            usuarios={usuarios}
            usuarioActualId={usuarioActualId}
          />
        )}
      </div>

      <DndContext id="tareas-kanban" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-4 md:grid-cols-2">
          <Columna id="pendientes" titulo="Pendientes" count={pendientesFiltradas.length}>
            {pendientesFiltradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tienes tareas pendientes.
              </p>
            ) : (
              pendientesFiltradas.map((t) => (
                <TareaCard
                  key={t.id}
                  tarea={t}
                  puedeEditar={puedeEditar}
                  puedeCrear={puedeCrear}
                  compacto={compacto}
                  vinculos={vinculos}
                  usuarios={usuarios}
                  usuarioActualId={usuarioActualId}
                />
              ))
            )}
          </Columna>

          <Columna id="completadas" titulo="Completadas" count={completadasFiltradas.length}>
            {completadasFiltradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no completas ninguna tarea.
              </p>
            ) : (
              completadasFiltradas.map((t) => (
                <TareaCard
                  key={t.id}
                  tarea={t}
                  puedeEditar={puedeEditar}
                  puedeCrear={puedeCrear}
                  compacto={compacto}
                  vinculos={vinculos}
                  usuarios={usuarios}
                  usuarioActualId={usuarioActualId}
                />
              ))
            )}
          </Columna>
        </div>
      </DndContext>
    </div>
  );
}
