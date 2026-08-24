"use client";

import { useEffect, useRef, useState } from "react";
import type { PuntoPeriodo } from "@/lib/reportes";
import { formatCurrency } from "@/lib/format";

const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
// Ancho:alto del área de dibujo — más bajo que un gráfico de escritorio
// típico para que en pantallas angostas no quede ni aplastado ni cortado.
const ASPECT = 2.4;
const H_MIN = 200;
const H_MAX = 300;

function formatCorto(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

export function RecaudadoGastosChart({ datos }: { datos: PuntoPeriodo[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Se mide el ancho real del contenedor (en vez de un viewBox fijo que
  // luego el navegador escala) para que el trazo y el texto del SVG
  // siempre midan 1:1 con los píxeles reales — en un celular angosto, un
  // viewBox fijo de 760 quedaba "letterboxeado" y el texto se veía
  // diminuto.
  const [width, setWidth] = useState(760);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Mide de una vez con getBoundingClientRect (no espera al primer aviso
    // async del ResizeObserver) para que el primer render en el cliente ya
    // tenga el tamaño correcto en vez de arrancar con el default de 760.
    const medir = () => {
      const w = el.getBoundingClientRect().width;
      if (w) setWidth(Math.max(240, Math.round(w)));
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hayActividad = datos.some((d) => d.recaudado > 0 || d.gastos > 0);
  if (datos.length === 0 || !hayActividad) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No hay movimientos en este rango de fechas.
      </div>
    );
  }

  const W = width;
  const H = Math.min(H_MAX, Math.max(H_MIN, Math.round(W / ASPECT)));
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const step = datos.length > 1 ? innerW / (datos.length - 1) : 0;

  const maxRaw = Math.max(1, ...datos.map((d) => Math.max(d.recaudado, d.gastos)));
  // Redondea el techo del eje Y a un número "bonito" para que las líneas de
  // referencia no queden en valores arbitrarios como $17,342.
  const magnitud = 10 ** Math.floor(Math.log10(maxRaw));
  const max = Math.ceil((maxRaw * 1.1) / magnitud) * magnitud;

  function x(i: number) {
    return PAD_LEFT + i * step;
  }
  function y(v: number) {
    return PAD_TOP + innerH - (v / max) * innerH;
  }

  const lineaRecaudado = datos.map((d, i) => `${x(i).toFixed(1)},${y(d.recaudado).toFixed(1)}`).join(" ");
  const lineaGastos = datos.map((d, i) => `${x(i).toFixed(1)},${y(d.gastos).toFixed(1)}`).join(" ");

  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  // Muestra como máximo ~6 etiquetas en el eje X para que no se amontonen
  // (en móvil, con menos ancho disponible, un poco menos que en escritorio).
  const maxEtiquetas = W < 420 ? 5 : 7;
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
  const tooltipLeftPct = hoverIndex !== null ? (x(hoverIndex) / W) * 100 : 0;
  const tooltipAlignEnd = tooltipLeftPct > 65;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" />
          <span className="text-muted-foreground">Recaudado</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-orange-500 dark:bg-orange-400" />
          <span className="text-muted-foreground">Gastos</span>
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
          {ticksY.map((t) => (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {formatCorto(t)}
              </text>
            </g>
          ))}

          {datos.map((d, i) =>
            i % labelStride === 0 ? (
              <text
                key={d.key}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {d.label}
              </text>
            ) : null
          )}

          {hoverIndex !== null && (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={PAD_TOP}
              y2={H - PAD_BOTTOM}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          <polyline
            points={lineaGastos}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-orange-500 dark:stroke-orange-400"
          />
          <polyline
            points={lineaRecaudado}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-primary"
          />

          {hoverIndex !== null && hovered && (
            <>
              <circle cx={x(hoverIndex)} cy={y(hovered.gastos)} r={3.5} className="fill-orange-500 dark:fill-orange-400" />
              <circle cx={x(hoverIndex)} cy={y(hovered.recaudado)} r={3.5} className="fill-primary" />
            </>
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-40 rounded-lg border border-input bg-popover p-2 text-xs text-popover-foreground shadow-md"
            style={{
              left: `${tooltipLeftPct}%`,
              transform: tooltipAlignEnd ? "translateX(-100%)" : "translateX(0%)",
              marginLeft: tooltipAlignEnd ? -8 : 8,
            }}
          >
            <p className="mb-1 font-medium">{hovered.label}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Recaudado
              </span>
              <span className="tabular-nums">{formatCurrency(hovered.recaudado)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
                Gastos
              </span>
              <span className="tabular-nums">{formatCurrency(hovered.gastos)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
