import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requiereAdmin } from "@/lib/alcance";
import { formatCurrency } from "@/lib/format";
import { hoyEnMexico } from "@/lib/fecha";
import { calcularSaldosCuentas, movimientosPorCuenta } from "@/lib/cuenta";
import { montoNetoEnMXN } from "@/lib/pago-monto";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CuentaFormDialog } from "@/components/cuentas/cuenta-form-dialog";
import { CuentasPanel, type CuentaVista } from "@/components/cuentas/cuentas-panel";
import { crearCuenta } from "@/app/admin/cuentas/actions";

// Ciclo de color por cuenta -- para la barra de reparto y el acento de
// cada fila. No es por tipo (ya hay badge para eso): puede haber varias
// cuentas del mismo tipo (ej. dos Billeteras) que necesitan verse
// distintas en la barra.
const PALETA = ["bg-primary", "bg-sky-500", "bg-amber-500", "bg-fuchsia-500", "bg-teal-500", "bg-rose-500"];

export default async function CuentasPage() {
  if (!(await requiereAdmin())) redirect("/admin");

  const cuentas = await prisma.cuenta.findMany({
    orderBy: [{ activa: "desc" }, { alias: "asc" }],
  });

  const hoy = hoyEnMexico();
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));

  const [pagosDetalle, gastosDetalle, retiros] = await Promise.all([
    // select en vez de groupBy -- además de sumar para el saldo, esta
    // misma consulta alimenta el panel de "Movimientos" (necesita fecha y
    // concepto por pago, no solo el total).
    prisma.pago.findMany({
      where: { confirmado: true, cuentaId: { not: null } },
      select: {
        id: true,
        fecha: true,
        cuentaId: true,
        monto: true,
        moneda: true,
        montoMXN: true,
        comision: true,
        montoIncluyeComision: true,
        servicio: { select: { descripcion: true } },
      },
    }),
    prisma.gasto.findMany({
      where: { cuentaId: { not: null } },
      select: { id: true, fecha: true, cuentaId: true, monto: true, descripcion: true },
    }),
    prisma.retiro.findMany({ orderBy: { fecha: "desc" }, take: 200 }),
  ]);

  const cuentasConSaldo = calcularSaldosCuentas(
    cuentas,
    pagosDetalle,
    gastosDetalle.map((g) => ({ cuentaId: g.cuentaId, monto: g.monto })),
    retiros
  );
  const movimientos = movimientosPorCuenta(cuentas, pagosDetalle, gastosDetalle, retiros);

  const totalDisponible = cuentasConSaldo.reduce((acc, c) => acc + (c.activa ? c.saldo : 0), 0);

  const cuentasVista: CuentaVista[] = cuentasConSaldo.map((c, i) => ({
    id: c.id,
    alias: c.alias,
    tipo: c.tipo,
    banco: c.banco,
    numeroCuenta: c.numeroCuenta,
    clabe: c.clabe,
    swift: c.swift,
    notas: c.notas,
    activa: c.activa,
    saldoInicial: Number(c.saldoInicial),
    pagos: c.pagos,
    gastos: c.gastos,
    retirosMonto: c.retirosMonto,
    ingresosPorRetiros: c.ingresosPorRetiros,
    saldo: c.saldo,
    retirosLista: c.retirosLista.map((r) => ({ id: r.id, fecha: r.fecha, monto: Number(r.monto), comentario: r.comentario })),
    movimientos: movimientos.get(c.id) ?? [],
    color: PALETA[i % PALETA.length],
  }));

  const reparto = cuentasVista
    .filter((c) => c.activa && c.saldo > 0)
    .map((c) => ({
      alias: c.alias,
      color: c.color,
      pct: totalDisponible > 0 ? (c.saldo / totalDisponible) * 100 : 0,
    }));

  const activasCount = cuentasVista.filter((c) => c.activa).length;

  const mesPagos = pagosDetalle
    .filter((p) => p.fecha >= inicioMes)
    .reduce((acc, p) => acc + montoNetoEnMXN(p), 0);
  const mesGastos = gastosDetalle.filter((g) => g.fecha >= inicioMes).reduce((acc, g) => acc + Number(g.monto), 0);
  const mesNeto = mesPagos - mesGastos;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <span className="text-[10.5px] font-medium tracking-wider text-primary uppercase">Total disponible</span>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-[34px] leading-none font-semibold tabular-nums">{formatCurrency(totalDisponible)}</span>
            <span className="text-xs text-muted-foreground">
              MXN · {activasCount} cuenta{activasCount === 1 ? "" : "s"} activa{activasCount === 1 ? "" : "s"} de {cuentasVista.length}
            </span>
          </div>

          {reparto.length > 0 && (
            <>
              <div className="mt-1 flex h-2.5 gap-0.5">
                {reparto.map((r) => (
                  <span key={r.alias} title={r.alias} className={`block rounded-sm ${r.color}`} style={{ width: `${r.pct}%` }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                {reparto.map((r) => (
                  <span key={r.alias} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={`size-2 rounded-sm ${r.color}`} />
                    {r.alias} <span className="text-muted-foreground/70">{Math.round(r.pct)}%</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Entró este mes</span>
              <span className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(mesPagos)}
              </span>
            </div>
            <div className="flex flex-col gap-1 border-l border-border pl-5">
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Salió este mes</span>
              <span className="text-lg font-semibold tabular-nums text-destructive">−{formatCurrency(mesGastos)}</span>
            </div>
            <div className="flex flex-col gap-1 border-l border-border pl-5">
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Neto</span>
              <span className="text-lg font-semibold tabular-nums">
                {mesNeto >= 0 ? "+" : ""}
                {formatCurrency(mesNeto)}
              </span>
            </div>
          </div>
          <CuentaFormDialog
            trigger={
              <Button>
                <Plus />
                Nueva cuenta
              </Button>
            }
            title="Nueva cuenta"
            action={crearCuenta}
            submitLabel="Crear cuenta"
          />
        </div>
      </div>

      {cuentasVista.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aún no hay cuentas registradas.
          </CardContent>
        </Card>
      ) : (
        <CuentasPanel cuentas={cuentasVista} puedeEditar />
      )}
    </div>
  );
}
