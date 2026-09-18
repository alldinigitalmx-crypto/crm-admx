import { montoNetoEnMXN, type PagoParaNeto } from "@/lib/pago-monto";

type DecimalLike = number | string | { toString(): string };

type CuentaBase = {
  id: number;
  tipo: string;
  saldoInicial: DecimalLike;
};

type GastoParaCuenta = { cuentaId: number | null; monto: DecimalLike };

export type RetiroParaCuenta = {
  id: number;
  cuentaId: number;
  fecha: Date;
  monto: DecimalLike;
  comentario: string | null;
};

type PagoConCuenta = PagoParaNeto & { cuentaId: number | null };

export type CuentaConSaldo<C extends CuentaBase> = C & {
  pagos: number;
  gastos: number;
  retirosMonto: number;
  ingresosPorRetiros: number;
  saldo: number;
  retirosLista: RetiroParaCuenta[];
};

// Un retiro es plata que sale de una cuenta (banco/billetera) para
// convertirse en efectivo — así que además de restarle a la cuenta de
// origen, se le suma a Efectivo. Si el origen ya era Efectivo (retirar de
// la caja chica misma) no cuenta dos veces: solo resta ahí, no se vuelve
// a sumar a sí mismo. Fórmula idéntica a la que ya vivía en
// admin/cuentas/page.tsx -- portada tal cual, es dinero real.
export function calcularSaldosCuentas<C extends CuentaBase>(
  cuentas: C[],
  pagos: PagoConCuenta[],
  gastos: GastoParaCuenta[],
  retiros: RetiroParaCuenta[]
): CuentaConSaldo<C>[] {
  const pagosMap = new Map<number, number>();
  for (const p of pagos) {
    if (p.cuentaId == null) continue;
    pagosMap.set(p.cuentaId, (pagosMap.get(p.cuentaId) ?? 0) + montoNetoEnMXN(p));
  }

  const gastosMap = new Map<number, number>();
  for (const g of gastos) {
    if (g.cuentaId == null) continue;
    gastosMap.set(g.cuentaId, (gastosMap.get(g.cuentaId) ?? 0) + Number(g.monto));
  }

  const retirosMap = new Map<number, number>();
  const retirosPorCuentaLista = new Map<number, RetiroParaCuenta[]>();
  for (const r of retiros) {
    retirosMap.set(r.cuentaId, (retirosMap.get(r.cuentaId) ?? 0) + Number(r.monto));
    const lista = retirosPorCuentaLista.get(r.cuentaId) ?? [];
    lista.push(r);
    retirosPorCuentaLista.set(r.cuentaId, lista);
  }

  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
  const retirosHaciaEfectivo = retiros
    .filter((r) => cuentaPorId.get(r.cuentaId)?.tipo !== "Efectivo")
    .reduce((acc, r) => acc + Number(r.monto), 0);

  return cuentas.map((c) => {
    const pagosC = pagosMap.get(c.id) ?? 0;
    const gastosC = gastosMap.get(c.id) ?? 0;
    const retirosMonto = retirosMap.get(c.id) ?? 0;
    const ingresosPorRetiros = c.tipo === "Efectivo" ? retirosHaciaEfectivo : 0;
    const saldo = Number(c.saldoInicial) + pagosC - gastosC - retirosMonto + ingresosPorRetiros;
    return {
      ...c,
      pagos: pagosC,
      gastos: gastosC,
      retirosMonto,
      ingresosPorRetiros,
      saldo,
      retirosLista: retirosPorCuentaLista.get(c.id) ?? [],
    };
  });
}

export type Movimiento = {
  id: string;
  fecha: Date;
  concepto: string;
  tipo: "Pago" | "Gasto" | "Retiro" | "Retiro recibido";
  monto: number;
};

// Mezcla pagos + gastos + retiros de todas las cuentas en una sola línea
// de tiempo por cuenta -- para el panel de "Movimientos" del detalle de
// cada cuenta. Mismo criterio de "retiro hacia Efectivo" que
// calcularSaldosCuentas: un retiro que sale de una cuenta no-Efectivo
// también aparece como ingreso en las cuentas de tipo Efectivo.
export function movimientosPorCuenta(
  cuentas: { id: number; tipo: string }[],
  pagos: (PagoConCuenta & { id: number; fecha: Date; servicio?: { descripcion: string } | null })[],
  gastos: (GastoParaCuenta & { id: number; fecha: Date; descripcion: string })[],
  retiros: RetiroParaCuenta[],
  limite = 12
): Map<number, Movimiento[]> {
  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
  const porCuenta = new Map<number, Movimiento[]>();

  function push(cuentaId: number | null, mov: Movimiento) {
    if (cuentaId == null) return;
    const lista = porCuenta.get(cuentaId) ?? [];
    lista.push(mov);
    porCuenta.set(cuentaId, lista);
  }

  for (const p of pagos) {
    push(p.cuentaId, {
      id: `pago:${p.id}`,
      fecha: p.fecha,
      concepto: p.servicio?.descripcion ?? "Pago",
      tipo: "Pago",
      monto: montoNetoEnMXN(p),
    });
  }

  for (const g of gastos) {
    push(g.cuentaId, {
      id: `gasto:${g.id}`,
      fecha: g.fecha,
      concepto: g.descripcion,
      tipo: "Gasto",
      monto: -Number(g.monto),
    });
  }

  for (const r of retiros) {
    push(r.cuentaId, {
      id: `retiro:${r.id}`,
      fecha: r.fecha,
      concepto: r.comentario ?? "Retiro",
      tipo: "Retiro",
      monto: -Number(r.monto),
    });

    if (cuentaPorId.get(r.cuentaId)?.tipo !== "Efectivo") {
      for (const c of cuentas) {
        if (c.tipo !== "Efectivo") continue;
        push(c.id, {
          id: `retiro-recibido:${r.id}:${c.id}`,
          fecha: r.fecha,
          concepto: r.comentario ?? "Retiro recibido",
          tipo: "Retiro recibido",
          monto: Number(r.monto),
        });
      }
    }
  }

  for (const [id, lista] of porCuenta) {
    lista.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    porCuenta.set(id, lista.slice(0, limite));
  }

  return porCuenta;
}
