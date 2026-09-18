"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useActionState } from "react";
import confetti from "canvas-confetti";
import { LayoutGrid, List, Plus, Search, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { TareaRow, type TareaFila } from "@/components/tareas/tarea-row";
import type { VinculoOption } from "@/components/tareas/tarea-form";
import { crearTarea, completarTarea } from "@/app/admin/tareas/actions";
import { formatDate } from "@/lib/format";
import { GRUPOS_TAREA, grupoDeTarea, type GrupoTarea } from "@/lib/tareas-grupos";
import type { PrioridadTarea } from "@/generated/prisma/client";

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
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

const PRIORIDADES: PrioridadTarea[] = ["Alta", "Media", "Baja"];

const BANDEJAS: { key: GrupoTarea | "todas"; label: string }[] = [
  { key: "todas", label: "Todas" },
  ...GRUPOS_TAREA.map((g) => ({ key: g.key, label: g.titulo })),
];

function CapturaRapida({ puedeCrear }: { puedeCrear: boolean }) {
  const [state, formAction, isPending] = useActionState(crearTarea, undefined);
  const [formKey, setFormKey] = useState(0);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) {
      setFormKey((k) => k + 1);
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  if (!puedeCrear) return null;

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-1 px-7 py-4">
      <div className="flex items-center gap-2.5">
        <input
          name="titulo"
          required
          disabled={isPending}
          placeholder="Escribe una tarea y presiona Enter…"
          className="h-10 flex-1 rounded-lg border border-dashed border-input bg-transparent px-3.5 text-[13.5px] outline-none focus-visible:border-primary focus-visible:border-solid disabled:opacity-60"
        />
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function TareasPanel({
  tareasPendientes,
  puedeEditar,
  puedeCrear,
  vinculos,
  usuarios,
  usuarioActualId,
  hoy,
  vinculoCounts,
  ultimasCerradas,
  barrasCerradas,
  presets,
}: {
  tareasPendientes: TareaFila[];
  puedeEditar: boolean;
  puedeCrear: boolean;
  vinculos: VinculoOption[];
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
  hoy: Date;
  vinculoCounts: { servicios: number; negociaciones: number; prospectos: number; sueltas: number };
  ultimasCerradas: { id: number; titulo: string; completadaEn: Date }[];
  barrasCerradas: { label: string; completadas: number }[];
  presets: { label: string; href: string; count: number; activo: boolean }[];
}) {
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [bandeja, setBandeja] = useState<GrupoTarea | "todas">("todas");
  const [prioridad, setPrioridad] = useState<PrioridadTarea | null>(null);
  const [asignadoId, setAsignadoId] = useState<string>("");
  const [q, setQ] = useState("");
  const [compacto, setCompacto] = useState(false);
  const sonido = useSyncExternalStore(suscribirSonido, leerSonido, leerSonidoServidor);
  const yaFestejo = useRef(false);

  function toggleSonido() {
    guardarSonido(!sonido);
  }

  // Único punto que de verdad completa una tarea -- reabrir vive en el
  // historial, aquí solo se completa (la lista es de pendientes).
  function marcarCompletada(id: number) {
    if (!puedeEditar) return;
    if (overrides[id]) return;

    setOverrides((prev) => ({ ...prev, [id]: true }));
    completarTarea(id, true);

    if (sonido) playChime();
    const quedan = abiertas.filter((t) => t.id !== id && !overrides[t.id]).length;
    if (quedan === 0 && !yaFestejo.current) {
      yaFestejo.current = true;
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    }
  }

  const abiertas = tareasPendientes.filter((t) => !overrides[t.id]);

  const bandejaCounts = BANDEJAS.map((b) => ({
    ...b,
    count: abiertas.filter((t) => b.key === "todas" || grupoDeTarea(t.fechaLimite, hoy) === b.key).length,
  }));

  const enBandeja = abiertas.filter((t) => bandeja === "todas" || grupoDeTarea(t.fechaLimite, hoy) === bandeja);

  const prioridadCounts = PRIORIDADES.map((p) => ({
    prioridad: p,
    count: enBandeja.filter((t) => t.prioridad === p).length,
  }));

  const qLower = q.trim().toLowerCase();
  const resultado = enBandeja.filter(
    (t) =>
      (!prioridad || t.prioridad === prioridad) &&
      (!asignadoId || String(t.asignadoAId ?? "") === asignadoId) &&
      (!qLower || t.titulo.toLowerCase().includes(qLower))
  );

  const grupos = GRUPOS_TAREA.map((g) => ({
    ...g,
    tareas: resultado.filter((t) => grupoDeTarea(t.fechaLimite, hoy) === g.key),
  })).filter((g) => (bandeja === "todas" || g.key === bandeja) && g.tareas.length > 0);

  const bandejaLabel = BANDEJAS.find((b) => b.key === bandeja)?.label ?? "Todas";
  const asignadoNombreDe = (id: number | null) => usuarios.find((u) => u.id === id)?.nombre ?? null;
  const maxBarra = Math.max(1, ...barrasCerradas.map((b) => b.completadas));

  function renderFilaRow(t: TareaFila, variante: "desktop" | "mobile") {
    return (
      <TareaRow
        key={t.id}
        tarea={t}
        variante={variante}
        compacto={compacto}
        puedeEditar={puedeEditar}
        puedeCrear={puedeCrear}
        vinculos={vinculos}
        usuarios={usuarios}
        usuarioActualId={usuarioActualId}
        asignadoNombre={asignadoNombreDe(t.asignadoAId)}
        onToggleCompletada={() => marcarCompletada(t.id)}
      />
    );
  }

  const nuevaTareaDialog = (trigger: React.ReactNode) => (
    <TareaFormDialog action={crearTarea} vinculos={vinculos} usuarios={usuarios} usuarioActualId={usuarioActualId} trigger={trigger} />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Escritorio: 3 columnas ---------- */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:grid lg:grid-cols-[214px_minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-5 border-r border-border py-5">
          <div className="flex flex-col">
            <div className="px-5 pb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Bandejas
            </div>
            {bandejaCounts.map((b) => {
              const activa = b.key === bandeja;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBandeja(b.key)}
                  className={`flex items-center justify-between gap-2 border-l-2 px-5 py-2 text-left text-[13.5px] hover:bg-muted/50 ${
                    activa ? "border-l-primary bg-primary/5 font-semibold text-primary" : "border-l-transparent text-foreground/80"
                  }`}
                >
                  <span>{b.label}</span>
                  <span className={`text-[11.5px] tabular-nums ${b.key === "vencidas" && b.count > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {b.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col">
            <div className="px-5 pb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Prioridad
            </div>
            {prioridadCounts.map((f) => {
              const activa = prioridad === f.prioridad;
              return (
                <button
                  key={f.prioridad}
                  type="button"
                  onClick={() => setPrioridad((p) => (p === f.prioridad ? null : f.prioridad))}
                  className={`flex items-center gap-2.5 px-5 py-1.5 text-left text-[13px] hover:bg-muted/50 ${
                    activa ? "font-medium text-primary" : "text-foreground/80"
                  }`}
                >
                  <span
                    className={`size-2 shrink-0 rounded-sm ${
                      f.prioridad === "Alta" ? "bg-red-500" : f.prioridad === "Media" ? "bg-orange-500" : "bg-emerald-500"
                    }`}
                  />
                  <span className="flex-1">{f.prioridad}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{f.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col">
            <div className="px-5 pb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Vinculadas a
            </div>
            <div className="flex flex-col gap-1 px-5 text-[13px] text-foreground/80">
              <div className="flex justify-between">
                <span>Servicios</span>
                <span className="text-[11px] text-muted-foreground">{vinculoCounts.servicios}</span>
              </div>
              <div className="flex justify-between">
                <span>Negociaciones</span>
                <span className="text-[11px] text-muted-foreground">{vinculoCounts.negociaciones}</span>
              </div>
              <div className="flex justify-between">
                <span>Prospectos</span>
                <span className="text-[11px] text-muted-foreground">{vinculoCounts.prospectos}</span>
              </div>
              <div className="flex justify-between">
                <span>Sueltas</span>
                <span className="text-[11px] text-muted-foreground">{vinculoCounts.sueltas}</span>
              </div>
            </div>
          </div>

          <Link
            href="/admin/tareas/historial"
            className="mx-5 border-t border-border pt-4 text-[11px] font-medium text-primary hover:underline"
          >
            Historial completo →
          </Link>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-7 py-3.5">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[15px] font-semibold">{bandejaLabel}</span>
              <span className="text-[11.5px] text-muted-foreground">
                {resultado.length} abierta{resultado.length === 1 ? "" : "s"}
                {prioridad ? ` · prioridad ${prioridad.toLowerCase()}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 rounded-md border border-input px-2">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar…"
                  className="h-7 w-32 bg-transparent text-[12px] outline-none"
                />
              </div>
              <select
                value={asignadoId}
                onChange={(e) => setAsignadoId(e.target.value)}
                className="h-7.5 rounded-md border border-input bg-background px-2 text-[11.5px] text-foreground/80 outline-none"
              >
                <option value="">Asignado: todos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="h-7.5 gap-1.5 px-2.5 text-[11px]" onClick={() => setCompacto((v) => !v)}>
                {compacto ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />}
                {compacto ? "Vista expandida" : "Vista compacta"}
              </Button>
              <Button size="sm" variant="outline" className="h-7.5 gap-1.5 px-2.5 text-[11px]" onClick={toggleSonido}>
                {sonido ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              </Button>
              {puedeCrear &&
                nuevaTareaDialog(
                  <Button size="sm" className="h-7.5 gap-1.5 px-3 text-[13px]">
                    <Plus className="size-4" />
                    Nueva tarea
                  </Button>
                )}
            </div>
          </div>

          {resultado.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-7 py-16 text-center">
              <span className="text-[15px] font-medium">Bandeja limpia</span>
              <span className="text-[13px] text-muted-foreground">No queda nada pendiente aquí.</span>
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.key} className="flex flex-col">
                {bandeja === "todas" && (
                  <div className="flex items-center gap-2.5 px-7 pt-4 pb-1.5">
                    <span
                      className={`text-[10.5px] font-medium tracking-wider uppercase ${
                        g.key === "vencidas" ? "text-destructive" : g.key === "hoy" ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {g.titulo}
                    </span>
                    <span className="text-[10.5px] tabular-nums text-muted-foreground">{g.tareas.length}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                {g.tareas.map((t) => renderFilaRow(t, "desktop"))}
              </div>
            ))
          )}

          <CapturaRapida puedeCrear={puedeCrear} />
        </div>

        <div className="flex flex-col border-l border-border">
          <div className="border-b border-border px-5 py-4">
            <div className="mb-3 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Cerradas por día
            </div>
            <div className="flex h-16 items-end gap-[3px]">
              {barrasCerradas.map((b, i) => (
                <span key={i} className="flex-1" title={`${b.label}: ${b.completadas}`}>
                  <span
                    className={`block rounded-t-sm ${i === barrasCerradas.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                    style={{ height: `${Math.max(4, Math.round((b.completadas / maxBarra) * 100))}%` }}
                  />
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>{barrasCerradas[0]?.label}</span>
              <span>hoy</span>
            </div>
          </div>

          <div className="border-b border-border px-5 py-4">
            <div className="mb-3 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Rango</div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
              {presets.map((p) => (
                <Link
                  key={p.label}
                  href={p.href}
                  className={`flex flex-col items-start gap-0.5 px-2.5 py-2 ${p.activo ? "bg-primary/5" : "bg-card hover:bg-muted/50"}`}
                >
                  <span className={`text-[15px] font-semibold tabular-nums ${p.activo ? "text-primary" : ""}`}>{p.count}</span>
                  <span className="text-[10px] text-muted-foreground">{p.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="mb-3 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Últimas cerradas
            </div>
            <div className="flex flex-col">
              {ultimasCerradas.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Aún no completas ninguna tarea.</p>
              ) : (
                ultimasCerradas.map((r) => (
                  <div key={r.id} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2">
                    <span className="truncate text-[12.5px] text-muted-foreground line-through">{r.titulo}</span>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground/70">{formatDate(r.completadaEn)}</span>
                  </div>
                ))
              )}
            </div>
            <Link href="/admin/tareas/historial" className="mt-3 inline-block text-[11px] font-medium text-primary hover:underline">
              Ver historial completo →
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- Móvil: una columna con chips ---------- */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {bandejaCounts.map((b) => {
            const activa = b.key === bandeja;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBandeja(b.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                  activa ? "border-foreground bg-foreground text-background" : "border-input bg-card text-foreground/80"
                }`}
              >
                <span>{b.label}</span>
                <span className="text-[11px] opacity-70 tabular-nums">{b.count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border bg-card">
          {resultado.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
              <span className="text-[15px] font-medium">Bandeja limpia</span>
              <span className="text-[13px] text-muted-foreground">No queda nada pendiente aquí.</span>
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.key} className="flex flex-col">
                {bandeja === "todas" && (
                  <div className="flex items-center gap-2.5 px-4 pt-4 pb-1.5">
                    <span
                      className={`text-[10px] font-medium tracking-wider uppercase ${
                        g.key === "vencidas" ? "text-destructive" : g.key === "hoy" ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {g.titulo}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{g.tareas.length}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                {g.tareas.map((t) => renderFilaRow(t, "mobile"))}
              </div>
            ))
          )}
          <div className="h-20" />

          {puedeCrear &&
            nuevaTareaDialog(
              <button
                type="button"
                className="absolute right-4 bottom-4 flex h-13 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/30"
              >
                <Plus className="size-5" />
                Nueva
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
