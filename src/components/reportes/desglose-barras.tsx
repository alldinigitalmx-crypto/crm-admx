import { formatCurrency } from "@/lib/format";

export type ItemBarra = {
  label: string;
  valor: number;
  /** Texto secundario opcional bajo el valor, ej. "12 pagos". */
  detalle?: string;
  colorClass: string;
};

/** Lista de barras horizontales para desgloses categóricos (status, método de
 * pago, categoría de gasto). Sin JS — el orden y el recorte a "Otros" ya
 * vienen resueltos desde quien arma `items`. */
export function DesgloseBarras({
  items,
  formato = "moneda",
  vacio = "Sin datos en este rango.",
}: {
  items: ItemBarra[];
  formato?: "moneda" | "numero";
  vacio?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{vacio}</p>;
  }

  const max = Math.max(1, ...items.map((i) => i.valor));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
              <span className={`size-2 shrink-0 rounded-full ${item.colorClass}`} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formato === "moneda" ? formatCurrency(item.valor) : item.valor}
              {item.detalle && <span className="ml-1.5">· {item.detalle}</span>}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${item.colorClass} transition-all duration-500`}
              style={{ width: `${Math.max(2, (item.valor / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
