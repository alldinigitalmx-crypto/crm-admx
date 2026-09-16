import { montoEnMXN } from "@/lib/pago-monto";

// Métricas de cliente (facturado, saldo, última actividad) que la ficha de
// detalle ya calculaba a mano sobre sus propios `servicios` -- este módulo
// las generaliza para poder calcularlas también para TODOS los clientes a
// la vez (KPIs y columnas del listado), a partir de un solo query de
// Servicio en vez de un `include` pesado por cliente.
//
// A diferencia de src/lib/servicio.ts (que compara un servicio contra SUS
// PROPIOS pagos en su propia moneda, para saber si YA quedó saldado), aquí
// sumamos montos de servicios de clientes distintos -- que pueden estar
// cotizados en monedas distintas (COP, USD, MXN...) -- en un solo total de
// negocio. Sumar los montos crudos sin convertir mezclaría, por ejemplo,
// pesos colombianos (números grandes) con pesos mexicanos como si fueran
// la misma moneda. Por eso todo se normaliza a MXN con
// Servicio.montoInicialMXN / Pago.montoMXN antes de sumar.

type ServicioMetrica = {
  clienteId: number;
  status: string;
  fechaInicio: Date;
  actualizadoEn: Date;
  montoInicial: unknown;
  montoInicialMXN?: unknown;
  moneda?: string | null;
  ordenesCambio: { status: string; monto: unknown }[];
  pagos: {
    monto: unknown;
    moneda?: string | null;
    montoMXN?: unknown;
    confirmado: boolean;
    fecha: Date;
  }[];
};

type QuejaMetrica = { clienteId: number; creadoEn: Date };
type ClienteBase = { id: number; creadoEn: Date };

export type MetricaCliente = {
  serviciosCount: number;
  serviciosActivosCount: number;
  facturado: number;
  facturadoAnioActual: number;
  saldo: number;
  ultimaActividad: Date;
};

const STATUS_SERVICIO_ACTIVO = new Set(["Aprobado", "EnProceso"]);

// Total del servicio en MXN. Las órdenes de cambio no tienen su propio
// campo "monto en MXN" (a diferencia de montoInicial/Pago.monto) -- se sí
// mantiene sin convertir, una aproximación menor y poco frecuente (la
// mayoría de los servicios no llevan órdenes de cambio en moneda
// extranjera). Si montoInicialMXN nunca se capturó para un servicio
// extranjero viejo, se usa el monto crudo como último recurso -- mismo
// criterio que montoEnMXN() para pagos históricos sin equivalente.
export function totalServicioMXN(s: {
  montoInicial: unknown;
  montoInicialMXN?: unknown;
  moneda?: string | null;
  ordenesCambio: { status: string; monto: unknown }[];
}): number {
  const ordenesAprobadas = s.ordenesCambio
    .filter((o) => o.status === "Aprobada")
    .reduce((acc, o) => acc + Number(o.monto), 0);
  const baseMXN =
    s.moneda && s.moneda !== "MXN"
      ? Number(s.montoInicialMXN ?? s.montoInicial)
      : Number(s.montoInicial);
  return baseMXN + ordenesAprobadas;
}

export function pendienteServicioMXN(
  s: {
    montoInicial: unknown;
    montoInicialMXN?: unknown;
    moneda?: string | null;
    ordenesCambio: { status: string; monto: unknown }[];
  },
  pagos: { monto: unknown; moneda?: string | null; montoMXN?: unknown; confirmado: boolean }[]
): number {
  const pagadoMXN = pagos
    .filter((p) => p.confirmado)
    .reduce(
      (acc, p) =>
        acc +
        montoEnMXN({ monto: p.monto as number, moneda: p.moneda, montoMXN: p.montoMXN as number | null }),
      0
    );
  return Math.max(totalServicioMXN(s) - pagadoMXN, 0);
}

/** Construye un mapa clienteId -> métricas a partir de los tres queries de
 * origen (servicios, quejas, clientes base). Un cliente sin servicios ni
 * quejas aparece de todas formas, con su fecha de alta como única
 * actividad. */
export function construirMetricasClientes(
  clientesBase: ClienteBase[],
  servicios: ServicioMetrica[],
  quejas: QuejaMetrica[]
): Map<number, MetricaCliente> {
  const anioActual = new Date().getFullYear();
  const mapa = new Map<number, MetricaCliente>();

  for (const c of clientesBase) {
    mapa.set(c.id, {
      serviciosCount: 0,
      serviciosActivosCount: 0,
      facturado: 0,
      facturadoAnioActual: 0,
      saldo: 0,
      ultimaActividad: c.creadoEn,
    });
  }

  for (const s of servicios) {
    const m = mapa.get(s.clienteId);
    if (!m) continue; // servicio de un cliente fuera del set base (no debería pasar)

    m.serviciosCount += 1;
    if (STATUS_SERVICIO_ACTIVO.has(s.status)) m.serviciosActivosCount += 1;

    const total = totalServicioMXN(s);
    m.facturado += total;
    if (s.fechaInicio.getFullYear() === anioActual) m.facturadoAnioActual += total;

    m.saldo += pendienteServicioMXN(s, s.pagos);

    if (s.actualizadoEn > m.ultimaActividad) m.ultimaActividad = s.actualizadoEn;
    for (const p of s.pagos) {
      if (p.confirmado && p.fecha > m.ultimaActividad) m.ultimaActividad = p.fecha;
    }
  }

  for (const q of quejas) {
    const m = mapa.get(q.clienteId);
    if (m && q.creadoEn > m.ultimaActividad) m.ultimaActividad = q.creadoEn;
  }

  return mapa;
}

export function metricaVacia(): MetricaCliente {
  return {
    serviciosCount: 0,
    serviciosActivosCount: 0,
    facturado: 0,
    facturadoAnioActual: 0,
    saldo: 0,
    ultimaActividad: new Date(0),
  };
}
