export type DonutItem = {
  label: string;
  value: number;
  /** Color CSS válido (hex, oklch, var(--token)...) — a diferencia de
   * DesgloseBarras, aquí no sirven clases bg-* porque el segmento es un
   * <circle> con stroke, no un div con background. */
  color: string;
};

/** Dona SVG a mano (sin librería de charts) armada con stroke-dasharray por
 * segmento — mismo espíritu que RecaudadoGastosChart. Pensada para
 * proporciones de un total (p. ej. pagos por método), con el total o el
 * porcentaje del segmento principal en el centro. */
export function DonutChart({
  items,
  centerLabel,
  centerSub,
  size = 168,
  thickness = 22,
}: {
  items: DonutItem[];
  centerLabel?: string;
  centerSub?: string;
  size?: number;
  thickness?: number;
}) {
  const total = items.reduce((acc, i) => acc + i.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const itemsPositivos = items.filter((i) => i.value > 0);
  const largos = itemsPositivos.map((item) => (total > 0 ? (item.value / total) * circumference : 0));
  // Prefijo de sumas de forma inmutable: el offset de cada segmento es la
  // suma acumulada de los largos anteriores (sin mutar variables externas).
  const offsets = largos.reduce<number[]>((acc, largo) => [...acc, (acc.at(-1) ?? 0) + largo], []);
  const segmentos = itemsPositivos.map((item, i) => ({
    ...item,
    largo: largos[i],
    dashoffset: -(offsets[i] - largos[i]),
  }));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted"
        />
        {segmentos.map((s) => (
          <circle
            key={s.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${s.largo} ${circumference - s.largo}`}
            strokeDashoffset={s.dashoffset}
            strokeLinecap={segmentos.length > 1 ? "butt" : "round"}
          />
        ))}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && <span className="text-xl font-semibold">{centerLabel}</span>}
          {centerSub && <span className="text-xs text-muted-foreground">{centerSub}</span>}
        </div>
      )}
    </div>
  );
}
