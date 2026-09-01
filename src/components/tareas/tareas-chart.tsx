"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PuntoTareas } from "@/lib/tareas-resumen";

// Mismo motor visual que RecaudadoGastosChart (Reportes) -- curva suave a
// mano, gradiente, tooltip al pasar el mouse/tocar -- solo que con una
// sola serie (tareas completadas) y en enteros, no en dinero.
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 30;
const PAD_BOTTOM = 30;
const ASPECT = 2.4;
const H_MIN = 180;
const H_MAX = 280;
const MAX_PUNTOS_CON_ETIQUETA = 13;

type Punto = { x: number; y: number };

function pathSuave(puntos: Punto[]): string {
  if (puntos.length === 0) return "";
  if (puntos.length < 3) {
    return puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }
  let d = `M ${puntos[0].x.toFixed(1)},${puntos[0].y.toFixed(1)}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function EtiquetaValor({ x: cx, y: cy, text }: { x: number; y: number; text: string }) {
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      className="fill-primary text-[10px] font-semibold tabular-nums"
      style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 3, strokeLinejoin: "round" }}
    >
      {text}
    </text>
  );
}

export function TareasChart({ datos }: { datos: PuntoTareas[] }) {
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

  const hayActividad = datos.some((d) => d.completadas > 0);
  if (datos.length === 0 || !hayActividad) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No completaste tareas en este rango.
      </div>
    );
  }

  const W = width;
  const H = Math.min(H_MAX, Math.max(H_MIN, Math.round(W / ASPECT)));
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const baseline = H - PAD_BOTTOM;
  const step = datos.length > 1 ? innerW / (datos.length - 1) : 0;

  const maxRaw = Math.max(1, ...datos.map((d) => d.completadas));
  // Techo del eje Y siempre en enteros "bonitos" (1, 2, 5, 10, 20...).
  const max = Math.ceil(maxRaw * 1.2);

  function x(i: number) {
    return PAD_LEFT + i * step;
  }
  function y(v: number) {
    return PAD_TOP + innerH - (v / max) * innerH;
  }

  const puntos = datos.map((d, i) => ({ x: x(i), y: y(d.completadas) }));
  const linea = pathSuave(puntos);
  const area = puntos.length > 0 ? `${linea} L ${x(datos.length - 1).toFixed(1)},${baseline} L ${x(0).toFixed(1)},${baseline} Z` : "";

  const pasoTicksY = Math.max(1, Math.ceil(max / 4));
  const ticksY: number[] = [];
  for (let t = 0; t <= max; t += pasoTicksY) ticksY.push(t);

  const maxEtiquetas = W < 420 ? 5 : 8;
  const labelStride = Math.max(1, Math.ceil(datos.length / maxEtiquetas));
  const mostrarValores = datos.length <= MAX_PUNTOS_CON_ETIQUETA;

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
  const tooltipLeftPct = hoverIndex !== null ? (x(hoverIndex) / W) * 100 : 0;
  const tooltipAlignEnd = tooltipLeftPct > 65;

  return (
    <div className="flex flex-col gap-3">
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
              <stop offset="0%" style={{ stopColor: "var(--primary)" }} stopOpacity={0.28} />
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
              <text
                x={PAD_LEFT - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {t}
              </text>
            </g>
          ))}

          {datos.map((d, i) =>
            i % labelStride === 0 ? (
              <text key={d.key} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {d.label}
              </text>
            ) : null
          )}

          {hoverIndex !== null && (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={PAD_TOP}
              y2={baseline}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          <path d={area} fill={`url(#${gradientId})`} stroke="none" />
          <path d={linea} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />

          {puntos.map((p, i) => (
            <circle key={datos[i].key} cx={p.x} cy={p.y} r={2.5} className="fill-primary" />
          ))}

          {mostrarValores &&
            datos.map((d, i) =>
              d.completadas > 0 ? (
                <EtiquetaValor key={`v-${d.key}`} x={x(i)} y={y(d.completadas) - 9} text={String(d.completadas)} />
              ) : null
            )}

          {hoverIndex !== null && hovered && (
            <>
              <circle cx={x(hoverIndex)} cy={y(hovered.completadas)} r={4.5} className="fill-primary" />
              <circle
                cx={x(hoverIndex)}
                cy={y(hovered.completadas)}
                r={8}
                fill="none"
                strokeWidth={1.5}
                className="stroke-primary/40"
              />
            </>
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-40 rounded-lg border border-input bg-popover p-2.5 text-xs text-popover-foreground shadow-lg"
            style={{
              left: `${tooltipLeftPct}%`,
              transform: tooltipAlignEnd ? "translateX(-100%)" : "translateX(0%)",
              marginLeft: tooltipAlignEnd ? -8 : 8,
            }}
          >
            <p className="mb-1.5 font-semibold">{hovered.label}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Completadas
              </span>
              <span className="tabular-nums font-medium">{hovered.completadas}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
