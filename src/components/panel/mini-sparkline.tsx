// Mini gráfico de tendencia para una tarjeta KPI -- mismo espíritu
// artesanal (SVG a mano, curva suave) que RecaudadoGastosChart/TareasChart,
// pero reducido a lo esencial: sin ejes, sin tooltip, un solo color. Es un
// Server Component (no necesita "use client", no hay interacción) — solo
// decora la cifra grande de al lado con "hacia dónde va".
const W = 120;
const H = 36;
const PAD = 3;

function pathSuave(puntos: { x: number; y: number }[]): string {
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

export function MiniSparkline({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;

  const max = Math.max(1, ...valores);
  const min = Math.min(0, ...valores);
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const step = innerW / (valores.length - 1);

  const puntos = valores.map((v, i) => ({
    x: PAD + i * step,
    y: PAD + innerH - ((v - min) / (max - min || 1)) * innerH,
  }));
  const linea = pathSuave(puntos);
  const baseline = H - PAD;
  const area =
    puntos.length > 0
      ? `${linea} L ${puntos[puntos.length - 1].x.toFixed(1)},${baseline} L ${puntos[0].x.toFixed(1)},${baseline} Z`
      : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0 overflow-visible">
      <path d={area} fill="var(--primary)" fillOpacity={0.15} stroke="none" />
      <path d={linea} fill="none" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />
      <circle cx={puntos[puntos.length - 1].x} cy={puntos[puntos.length - 1].y} r={2.25} className="fill-primary" />
    </svg>
  );
}
