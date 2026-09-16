import { montoPendienteServicio, montoTotalServicio } from "@/lib/servicio";

// Métricas de cliente (facturado, saldo, última actividad) que la ficha de
// detalle ya calculaba a mano sobre sus propios `servicios` -- este módulo
// las generaliza para poder calcularlas también para TODOS los clientes a
// la vez (KPIs y columnas del listado), a partir de un solo query de
// Servicio en vez de un `include` pesado por cliente.

type ServicioMetrica = {
  clienteId: number;
  status: string;
  fechaInicio: Date;
  actualizadoEn: Date;
  montoInicial: unknown;
  moneda?: string | null;
  ordenesCambio: { status: string; monto: unknown }[];
  pagos: { monto: unknown; moneda?: string | null; confirmado: boolean; fecha: Date }[];
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

    const total = montoTotalServicio({
      montoInicial: s.montoInicial as number,
      ordenesCambio: s.ordenesCambio as { status: string; monto: number }[],
    });
    m.facturado += total;
    if (s.fechaInicio.getFullYear() === anioActual) m.facturadoAnioActual += total;

    m.saldo += montoPendienteServicio(
      {
        montoInicial: s.montoInicial as number,
        moneda: s.moneda,
        ordenesCambio: s.ordenesCambio as { status: string; monto: number }[],
      },
      s.pagos as { monto: number; moneda?: string | null; confirmado: boolean }[]
    );

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
