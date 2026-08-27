// Tipo de cambio del día (Frankfurter/BCE, gratis, sin llave) para
// convertir montos en otra moneda a un estimado en pesos -- se usa donde
// se necesita UN SOLO número total mezclando cotizaciones de varias
// monedas (ej. el embudo de venta del panel), a diferencia de
// src/lib/pago-monto.ts (que usa el equivalente que la persona ya
// capturó a mano para un pago puntual). No es el tipo exacto que aplicó
// ninguna pasarela, es una referencia para "cuánto es esto en pesos hoy".
// Frankfurter no cubre COP.
export type Moneda1a1 = "USD" | "EUR";

export async function obtenerTasasAMXN(): Promise<Record<Moneda1a1, number | null>> {
  const monedas: Moneda1a1[] = ["USD", "EUR"];
  const resultados = await Promise.all(
    monedas.map(async (moneda) => {
      try {
        const res = await fetch(
          `https://api.frankfurter.app/latest?amount=1&from=${moneda}&to=MXN`,
          { next: { revalidate: 3600 } } // 1h -- no hace falta más fresco para un estimado
        );
        if (!res.ok) return [moneda, null] as const;
        const data = (await res.json()) as { rates?: { MXN?: number } };
        const tasa = data.rates?.MXN;
        return [moneda, typeof tasa === "number" ? tasa : null] as const;
      } catch {
        return [moneda, null] as const;
      }
    })
  );
  return Object.fromEntries(resultados) as Record<Moneda1a1, number | null>;
}

export type ResumenMontoMulti = {
  count: number;
  montoMXN: number;
  // Monedas que no se pudieron convertir (COP, o si Frankfurter falló) —
  // se suman aparte para no perderlas ni fingir que sí se convirtieron.
  sinConvertir: { moneda: string; monto: number }[];
};

export function resumirMontoMulti(
  items: { monto: number; moneda: string | null }[],
  tasas: Record<string, number | null>
): ResumenMontoMulti {
  let montoMXN = 0;
  const sinConvertirPorMoneda = new Map<string, number>();

  for (const item of items) {
    const moneda = item.moneda ?? "MXN";
    if (moneda === "MXN") {
      montoMXN += item.monto;
      continue;
    }
    const tasa = tasas[moneda];
    if (tasa) {
      montoMXN += item.monto * tasa;
    } else {
      sinConvertirPorMoneda.set(moneda, (sinConvertirPorMoneda.get(moneda) ?? 0) + item.monto);
    }
  }

  return {
    count: items.length,
    montoMXN,
    sinConvertir: Array.from(sinConvertirPorMoneda, ([moneda, monto]) => ({ moneda, monto })),
  };
}
