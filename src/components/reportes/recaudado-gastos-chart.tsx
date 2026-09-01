"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PuntoPeriodo } from "@/lib/reportes";
import { formatCurrency } from "@/lib/format";

const PAD_LEFT = 52;
const PAD_RIGHT = 12;
// Un poco más de aire arriba que abajo: ahí viven las etiquetas de monto
// de cada punto (ver mostrarValores más abajo).
const PAD_TOP = 30;
const PAD_BOTTOM = 30;
// Ancho:alto del área de dibujo — más bajo que un gráfico de escritorio
// típico para que en pantallas angostas no quede ni aplastado ni cortado.
const ASPECT = 2.4;
const H_MIN = 200;
const H_MAX = 300;
// Con más puntos que esto (vista por día) escribir el monto junto a cada
// uno se amontona — ahí se deja solo el tooltip al tocar/pasar el mouse.
const MAX_PUNTOS_CON_ETIQUETA = 13;

type Punto = { x: number; y: number };

function formatCorto(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

/** Curva suave (Catmull-Rom → Bézier) en vez de segmentos rectos — mismo
 * espíritu artesanal que el resto de los gráficos del módulo (sin
 * librería), solo que con una curva más agradable a la vista. */
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

/** Texto con un "halo" del color de fondo de la tarjeta detrás del trazo,
 * para que se lea bien encima de la línea/rejilla sin necesitar medir el
 * ancho del texto para dibujar una placa detrás. */
function EtiquetaValor({
  x: cx,
  y: cy,
  text,
  className,
}: {
  x: number;
  y: number;
  text: string;
  className: string;
}) {
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      className={`text-[10px] font-semibold tabular-nums ${className}`}
      style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 3, strokeLinejoin: "round" }}
    >
      {text}
    </text>
  );
}

export function RecaudadoGastosChart({ datos }: { datos: PuntoPeriodo[] }) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // "Unificar gastos" es una preferencia de vista, no de datos -- el
  // usuario decide cuándo quiere ver empresa y personal por separado (2
  // líneas de gasto) y cuándo junto como un solo total (1 línea de
  // gasto, para comparar de un vistazo contra lo recaudado).
  const [unificado, setUnificado] = useState(false);
  const hayGastosPersonales = datos.some((d) => d.gastosPersonales > 0);
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

  const hayActividad = datos.some((d) => d.recaudado > 0 || d.gastos > 0 || d.gastosPersonales > 0);
  if (datos.length === 0 || !hayActividad) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No hay movimientos en este rango de fechas.
      </div>
    );
  }

  // Unificado: una sola línea de "gasto total" (empresa + personal), para
  // comparar de un vistazo contra lo recaudado. Sin unificar: cada uno por
  // su lado, para no perder de vista qué es del negocio y qué es propio.
  const gastosCombinados = datos.map((d) => d.gastos + d.gastosPersonales);

  const W = width;
  const H = Math.min(H_MAX, Math.max(H_MIN, Math.round(W / ASPECT)));
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const baseline = H - PAD_BOTTOM;
  const step = datos.length > 1 ? innerW / (datos.length - 1) : 0;

  const maxRaw = Math.max(
    1,
    ...datos.map((d, i) =>
      unificado ? Math.max(d.recaudado, gastosCombinados[i]) : Math.max(d.recaudado, d.gastos, d.gastosPersonales)
    )
  );
  // Redondea el techo del eje Y a un número "bonito" para que las líneas de
  // referencia no queden en valores arbitrarios como $17,342.
  const magnitud = 10 ** Math.floor(Math.log10(maxRaw));
  const max = Math.ceil((maxRaw * 1.15) / magnitud) * magnitud;

  function x(i: number) {
    return PAD_LEFT + i * step;
  }
  function y(v: number) {
    return PAD_TOP + innerH - (v / max) * innerH;
  }

  const puntosRecaudado = datos.map((d, i) => ({ x: x(i), y: y(d.recaudado) }));
  const puntosGastos = datos.map((d, i) => ({ x: x(i), y: y(unificado ? gastosCombinados[i] : d.gastos) }));
  const puntosGastosPersonales = datos.map((d, i) => ({ x: x(i), y: y(d.gastosPersonales) }));
  const lineaRecaudado = pathSuave(puntosRecaudado);
  const lineaGastos = pathSuave(puntosGastos);
  const lineaGastosPersonales = pathSuave(puntosGastosPersonales);
  const areaRecaudado =
    puntosRecaudado.length > 0
      ? `${lineaRecaudado} L ${x(datos.length - 1).toFixed(1)},${baseline} L ${x(0).toFixed(1)},${baseline} Z`
      : "";

  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  // Muestra como máximo ~6 etiquetas en el eje X para que no se amontonen
  // (en móvil, con menos ancho disponible, un poco menos que en escritorio).
  const maxEtiquetas = W < 420 ? 5 : 7;
  const labelStride = Math.max(1, Math.ceil(datos.length / maxEtiquetas));
  // Con pocos puntos (vista por mes, el caso típico) se ve el monto junto a
  // cada punto; con muchos (vista por día) se amontonaría, así que ahí solo
  // queda el tooltip al tocar/pasar el mouse.
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary" />
            <span className="font-medium text-foreground">Recaudado</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-orange-500 dark:bg-orange-400" />
            <span className="font-medium text-foreground">
              {unificado ? "Gastos (empresa + personal)" : "Gastos empresa"}
            </span>
          </span>
          {!unificado && hayGastosPersonales && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-violet-500 dark:bg-violet-400" />
              <span className="font-medium text-foreground">Gastos personales</span>
            </span>
          )}
        </div>

        {hayGastosPersonales && (
          <button
            type="button"
            onClick={() => setUnificado((v) => !v)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              unificado
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {unificado ? "Viendo unificado" : "Unificar gastos"}
          </button>
        )}
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
              y2={baseline}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          <path d={areaRecaudado} fill={`url(#${gradientId})`} stroke="none" />

          {!unificado && hayGastosPersonales && (
            <path
              d={lineaGastosPersonales}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.85}
              strokeDasharray="5 3"
              className="stroke-violet-500 dark:stroke-violet-400"
            />
          )}
          <path
            d={lineaGastos}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.85}
            className="stroke-orange-500 dark:stroke-orange-400"
          />
          <path
            d={lineaRecaudado}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-primary"
          />

          {/* Puntos + monto de cada punto (cuando hay pocos, ver
              mostrarValores) — así se ve la cifra sin tener que pasar el
              mouse o tocar cada uno. */}
          {!unificado &&
            hayGastosPersonales &&
            puntosGastosPersonales.map((p, i) =>
              datos[i].gastosPersonales > 0 ? (
                <circle key={`pgp-${datos[i].key}`} cx={p.x} cy={p.y} r={2.5} className="fill-violet-500 dark:fill-violet-400" />
              ) : null
            )}
          {puntosGastos.map((p, i) =>
            (unificado ? datos[i].gastos + datos[i].gastosPersonales : datos[i].gastos) > 0 ? (
              <circle key={`pg-${datos[i].key}`} cx={p.x} cy={p.y} r={2.5} className="fill-orange-500 dark:fill-orange-400" />
            ) : null
          )}
          {puntosRecaudado.map((p, i) => (
            <circle key={`pr-${datos[i].key}`} cx={p.x} cy={p.y} r={2.5} className="fill-primary" />
          ))}

          {mostrarValores &&
            datos.map((d, i) => (
              <g key={`v-${d.key}`}>
                <EtiquetaValor x={x(i)} y={y(d.recaudado) - 9} text={formatCorto(d.recaudado)} className="fill-primary" />
                {(unificado ? d.gastos + d.gastosPersonales : d.gastos) > 0 && (
                  <EtiquetaValor
                    x={x(i)}
                    y={y(unificado ? d.gastos + d.gastosPersonales : d.gastos) + 15}
                    text={formatCorto(unificado ? d.gastos + d.gastosPersonales : d.gastos)}
                    className="fill-orange-600 dark:fill-orange-400"
                  />
                )}
                {!unificado && d.gastosPersonales > 0 && (
                  <EtiquetaValor
                    x={x(i)}
                    y={y(d.gastosPersonales) + 15}
                    text={formatCorto(d.gastosPersonales)}
                    className="fill-violet-600 dark:fill-violet-400"
                  />
                )}
              </g>
            ))}

          {hoverIndex !== null && hovered && (
            <>
              {!unificado && hayGastosPersonales && (
                <circle
                  cx={x(hoverIndex)}
                  cy={y(hovered.gastosPersonales)}
                  r={4.5}
                  className="fill-violet-500 dark:fill-violet-400"
                />
              )}
              <circle
                cx={x(hoverIndex)}
                cy={y(unificado ? hovered.gastos + hovered.gastosPersonales : hovered.gastos)}
                r={4.5}
                className="fill-orange-500 dark:fill-orange-400"
              />
              <circle cx={x(hoverIndex)} cy={y(hovered.recaudado)} r={4.5} className="fill-primary" />
              <circle
                cx={x(hoverIndex)}
                cy={y(hovered.recaudado)}
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
            className="pointer-events-none absolute top-0 z-10 w-48 rounded-lg border border-input bg-popover p-2.5 text-xs text-popover-foreground shadow-lg"
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
                Recaudado
              </span>
              <span className="tabular-nums font-medium">{formatCurrency(hovered.recaudado)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
                {unificado ? "Gastos (todo)" : "Gastos empresa"}
              </span>
              <span className="tabular-nums font-medium">
                {formatCurrency(unificado ? hovered.gastos + hovered.gastosPersonales : hovered.gastos)}
              </span>
            </div>
            {!unificado && hovered.gastosPersonales > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-violet-500 dark:bg-violet-400" />
                  Gastos personales
                </span>
                <span className="tabular-nums font-medium">{formatCurrency(hovered.gastosPersonales)}</span>
              </div>
            )}
            {(() => {
              // Siempre contra el gasto total (empresa + personal), sin
              // importar si la vista está unificada o no -- "a favor" es
              // sobre el dinero real que entró y salió, no sobre cómo se
              // está dibujando el gráfico en este momento.
              const favor = hovered.recaudado - hovered.gastos - hovered.gastosPersonales;
              return (
                <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border pt-1.5">
                  <span className="text-muted-foreground">{favor >= 0 ? "A favor" : "En contra"}</span>
                  <span
                    className={`tabular-nums font-semibold ${favor >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {formatCurrency(Math.abs(favor))}
                  </span>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
