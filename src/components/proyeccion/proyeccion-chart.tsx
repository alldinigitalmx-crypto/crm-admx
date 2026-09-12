"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";

// Mismo motor visual artesanal que RecaudadoGastosChart/TareasChart (SVG
// a mano, sin librería) -- aquí con dos series: los montos reales
// (puntos + área) y la recta de mínimos cuadrados, que sigue derecha
// (nunca curva) y cambia a punteada en cuanto entra a los meses
// proyectados (sin dato real todavía).
const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 30;
const PAD_BOTTOM = 30;
const ASPECT = 2.2;
const H_MIN = 220;
const H_MAX = 320;

export type PuntoProyeccion = {
  key: string;
  label: string;
  // null en los meses de proyección (todavía no hay dato real).
  recaudado: number | null;
  tendencia: number;
};

function formatCorto(n: number) {
  const signo = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${signo}$${Math.round(abs / 1000)}k`;
  return `${signo}$${Math.round(abs)}`;
}

export function ProyeccionChart({ datos, primerIndiceProyeccion }: { datos: PuntoProyeccion[]; primerIndiceProyeccion: number }) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const medir = () => {
      const w = el.getBoundingClientRect().width;
      if (w) setWidth(Math.max(240, Math.round(w)));
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (datos.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No hay suficientes meses con pagos para calcular una tendencia.
      </div>
    );
  }

  const W = width;
  const H = Math.min(H_MAX, Math.max(H_MIN, Math.round(W / ASPECT)));
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const baseline = H - PAD_BOTTOM;
  const step = datos.length > 1 ? innerW / (datos.length - 1) : 0;

  const valores = datos.flatMap((d) => [d.recaudado ?? 0, d.tendencia]);
  const maxRaw = Math.max(1, ...valores);
  const minRaw = Math.min(0, ...valores);
  const magnitud = 10 ** Math.floor(Math.log10(Math.max(1, maxRaw - minRaw)));
  const max = Math.ceil((maxRaw * 1.15) / magnitud) * magnitud;
  const min = minRaw < 0 ? Math.floor((minRaw * 1.15) / magnitud) * magnitud : 0;

  function x(i: number) {
    return PAD_LEFT + i * step;
  }
  function y(v: number) {
    return PAD_TOP + innerH - ((v - min) / (max - min)) * innerH;
  }

  const puntosReales = datos
    .map((d, i) => (d.recaudado !== null ? { x: x(i), y: y(d.recaudado) } : null))
    .filter((p): p is { x: number; y: number } => p !== null);
  const areaReales =
    puntosReales.length > 0
      ? `M ${puntosReales[0].x.toFixed(1)},${baseline} ` +
        puntosReales.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
        ` L ${puntosReales[puntosReales.length - 1].x.toFixed(1)},${baseline} Z`
      : "";

  // La tendencia es una sola recta -- basta con sus puntos extremos en
  // cada tramo (real/proyectado) para dibujarla, sin curva.
  const tendSolidaFin = Math.max(0, primerIndiceProyeccion);
  const lineaTendenciaSolida =
    tendSolidaFin > 0
      ? `M ${x(0).toFixed(1)},${y(datos[0].tendencia).toFixed(1)} L ${x(tendSolidaFin).toFixed(1)},${y(
          datos[tendSolidaFin].tendencia
        ).toFixed(1)}`
      : "";
  const lineaTendenciaPunteada =
    primerIndiceProyeccion < datos.length - 1 || datos.length === 1
      ? `M ${x(tendSolidaFin).toFixed(1)},${y(datos[tendSolidaFin].tendencia).toFixed(1)} L ${x(
          datos.length - 1
        ).toFixed(1)},${y(datos[datos.length - 1].tendencia).toFixed(1)}`
      : "";

  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  const maxEtiquetas = W < 420 ? 5 : 8;
  const labelStride = Math.max(1, Math.ceil(datos.length / maxEtiquetas));

  function indiceEnX(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const fracX = (clientX - rect.left) / rect.width;
    const svgX = fracX * W;
    const idx = Math.round((svgX - PAD_LEFT) / (step || 1));
    return Math.min(datos.length - 1, Math.max(0, idx));
  }

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const idx = indiceEnX(e.clientX);
    if (idx !== null) setHoverIndex(idx);
  }
  function handleTouch(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    if (!touch) return;
    const idx = indiceEnX(touch.clientX);
    if (idx !== null) setHoverIndex(idx);
  }

  const hovered = hoverIndex !== null ? datos[hoverIndex] : null;
  const hoveredEsProyeccion = hoverIndex !== null && hoverIndex >= primerIndiceProyeccion;
  const tooltipLeftPct = hoverIndex !== null ? (x(hoverIndex) / W) * 100 : 0;
  const tooltipAlignEnd = tooltipLeftPct > 65;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" />
          <span className="font-medium text-foreground">Recaudado real</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-emerald-600 dark:border-emerald-400" />
          <span className="font-medium text-foreground">Tendencia (mínimos cuadrados)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-emerald-600/70 dark:border-emerald-400/70" />
          <span className="font-medium text-foreground">Proyección</span>
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full touch-pan-y select-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setHoverIndex(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} style={{ height: H }} className="w-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--primary)" }} stopOpacity={0.25} />
              <stop offset="100%" style={{ stopColor: "var(--primary)" }} stopOpacity={0} />
            </linearGradient>
          </defs>

          {ticksY.map((t) => (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : "3 4"}
              />
              <text x={PAD_LEFT - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                {formatCorto(t)}
              </text>
            </g>
          ))}

          {/* Franja sombreada marcando dónde arranca la proyección. */}
          {primerIndiceProyeccion < datos.length - 1 && (
            <rect
              x={x(primerIndiceProyeccion)}
              y={PAD_TOP}
              width={Math.max(0, x(datos.length - 1) - x(primerIndiceProyeccion))}
              height={innerH}
              className="fill-muted-foreground/5"
            />
          )}

          {datos.map((d, i) =>
            i % labelStride === 0 ? (
              <text key={d.key} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {d.label}
              </text>
            ) : null
          )}

          {hoverIndex !== null && (
            <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD_TOP} y2={baseline} className="stroke-border" strokeWidth={1} strokeDasharray="3 3" />
          )}

          <path d={areaReales} fill={`url(#${gradientId})`} stroke="none" />

          <path d={lineaTendenciaPunteada} fill="none" strokeWidth={2.25} strokeLinecap="round" strokeDasharray="6 4" className="stroke-emerald-600 dark:stroke-emerald-400" />
          <path d={lineaTendenciaSolida} fill="none" strokeWidth={2.25} strokeLinecap="round" className="stroke-emerald-600 dark:stroke-emerald-400" />

          {puntosReales.map((p, i) => (
            <circle key={datos[i].key} cx={p.x} cy={p.y} r={2.75} className="fill-primary" />
          ))}

          {hoverIndex !== null && hovered && (
            <>
              <circle cx={x(hoverIndex)} cy={y(hovered.tendencia)} r={4} className="fill-emerald-600 dark:fill-emerald-400" />
              {hovered.recaudado !== null && (
                <>
                  <circle cx={x(hoverIndex)} cy={y(hovered.recaudado)} r={4.5} className="fill-primary" />
                  <circle cx={x(hoverIndex)} cy={y(hovered.recaudado)} r={8} fill="none" strokeWidth={1.5} className="stroke-primary/40" />
                </>
              )}
            </>
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-48 rounded-lg border border-input bg-popover p-2.5 text-xs text-popover-foreground shadow-lg"
            style={{
              left: `${tooltipLeftPct}%`,
              transform: tooltipAlignEnd ? "translateX(-100%)" : "translateX(0%)",
              marginLeft: tooltipAlignEnd ? -8 : 8,
            }}
          >
            <p className="mb-1.5 font-semibold">
              {hovered.label} {hoveredEsProyeccion && <span className="font-normal text-muted-foreground">(proyectado)</span>}
            </p>
            {hovered.recaudado !== null && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Real
                </span>
                <span className="tabular-nums font-medium">{formatCurrency(hovered.recaudado)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                Tendencia
              </span>
              <span className="tabular-nums font-medium">{formatCurrency(hovered.tendencia)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
