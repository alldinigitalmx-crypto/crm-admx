import { redirect } from "next/navigation";
import { Plus, Pencil, Wallet, ArrowDownCircle, X } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requiereAdmin } from "@/lib/alcance";
import { formatCurrency, formatDate } from "@/lib/format";
import { TIPO_CUENTA_COLOR } from "@/lib/status-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CuentaFormDialog } from "@/components/cuentas/cuenta-form-dialog";
import { RetiroFormDialog } from "@/components/cuentas/retiro-form-dialog";
import { actualizarCuenta, crearCuenta, crearRetiro, eliminarRetiro } from "@/app/admin/cuentas/actions";

export default async function CuentasPage() {
  if (!(await requiereAdmin())) redirect("/admin");

  const cuentas = await prisma.cuenta.findMany({
    orderBy: [{ activa: "desc" }, { alias: "asc" }],
  });

  const [pagosPorCuenta, gastosPorCuenta, retirosPorCuenta, retiros] = await Promise.all([
    prisma.pago.groupBy({
      by: ["cuentaId"],
      _sum: { monto: true },
      where: { confirmado: true, cuentaId: { not: null } },
    }),
    prisma.gasto.groupBy({
      by: ["cuentaId"],
      _sum: { monto: true },
      where: { cuentaId: { not: null } },
    }),
    prisma.retiro.groupBy({ by: ["cuentaId"], _sum: { monto: true } }),
    prisma.retiro.findMany({ orderBy: { fecha: "desc" }, take: 200 }),
  ]);

  const pagosMap = new Map(pagosPorCuenta.map((p) => [p.cuentaId, Number(p._sum.monto ?? 0)]));
  const gastosMap = new Map(gastosPorCuenta.map((g) => [g.cuentaId, Number(g._sum.monto ?? 0)]));
  const retirosMap = new Map(retirosPorCuenta.map((r) => [r.cuentaId, Number(r._sum.monto ?? 0)]));
  const retirosPorCuentaLista = new Map<number, typeof retiros>();
  for (const r of retiros) {
    const lista = retirosPorCuentaLista.get(r.cuentaId) ?? [];
    lista.push(r);
    retirosPorCuentaLista.set(r.cuentaId, lista);
  }

  // Un retiro es plata que sale de una cuenta (banco/billetera) para
  // convertirse en efectivo — así que además de restarle a la cuenta de
  // origen, se le suma a Efectivo. Si el origen ya era Efectivo (retirar
  // de la caja chica misma) no cuenta dos veces: solo resta ahí, no se
  // vuelve a sumar a sí mismo.
  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
  const retirosHaciaEfectivo = retiros
    .filter((r) => cuentaPorId.get(r.cuentaId)?.tipo !== "Efectivo")
    .reduce((acc, r) => acc + Number(r.monto), 0);

  const cuentasConSaldo = cuentas.map((c) => {
    const pagos = pagosMap.get(c.id) ?? 0;
    const gastos = gastosMap.get(c.id) ?? 0;
    const retirosMonto = retirosMap.get(c.id) ?? 0;
    const ingresosPorRetiros = c.tipo === "Efectivo" ? retirosHaciaEfectivo : 0;
    const saldo = Number(c.saldoInicial) + pagos - gastos - retirosMonto + ingresosPorRetiros;
    return {
      ...c,
      pagos,
      gastos,
      retirosMonto,
      ingresosPorRetiros,
      saldo,
      retirosLista: retirosPorCuentaLista.get(c.id) ?? [],
    };
  });

  const totalDisponible = cuentasConSaldo.reduce((acc, c) => acc + (c.activa ? c.saldo : 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cuentas</h1>
          <p className="text-sm text-muted-foreground">
            Dónde vive el dinero — {cuentas.length} cuenta{cuentas.length === 1 ? "" : "s"}
            {" — Total disponible: "}
            {formatCurrency(totalDisponible)}
          </p>
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

      {cuentasConSaldo.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aún no hay cuentas registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cuentasConSaldo.map((c) => (
            <Card key={c.id} className={c.activa ? undefined : "opacity-60"}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Wallet className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-medium">{c.alias}</CardTitle>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.banco ?? "—"}
                      {c.numeroCuenta ? ` · ${c.numeroCuenta}` : ""}
                    </p>
                  </div>
                </div>
                <Badge className={TIPO_CUENTA_COLOR[c.tipo] ?? ""}>{c.tipo}</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p className={`text-2xl font-semibold ${c.saldo < 0 ? "text-destructive" : ""}`}>
                    {formatCurrency(c.saldo)}
                  </p>
                  {!c.activa && (
                    <Badge variant="outline" className="mt-1">
                      Inactiva
                    </Badge>
                  )}
                </div>

                <div className={`grid gap-2 text-xs text-muted-foreground ${c.ingresosPorRetiros > 0 ? "grid-cols-2" : "grid-cols-3"}`}>
                  <div>
                    <p className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(c.pagos)}</p>
                    <p>Pagos</p>
                  </div>
                  <div>
                    <p className="text-destructive">-{formatCurrency(c.gastos)}</p>
                    <p>Gastos</p>
                  </div>
                  <div>
                    <p className="text-destructive">-{formatCurrency(c.retirosMonto)}</p>
                    <p>Retiros</p>
                  </div>
                  {c.ingresosPorRetiros > 0 && (
                    <div>
                      <p className="text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(c.ingresosPorRetiros)}
                      </p>
                      <p>Retiros recibidos</p>
                    </div>
                  )}
                </div>

                {c.retirosLista.length > 0 && (
                  <details className="group rounded-lg border border-input open:bg-muted/20">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground marker:content-none">
                      {c.retirosLista.length} retiro{c.retirosLista.length === 1 ? "" : "s"}
                      <span className="text-xs transition group-open:rotate-180">▾</span>
                    </summary>
                    <div className="flex flex-col gap-1.5 border-t border-input px-3 py-2">
                      {c.retirosLista.slice(0, 8).map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-muted-foreground">
                            {formatDate(r.fecha)}
                            {r.comentario ? ` — ${r.comentario}` : ""}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="tabular-nums">{formatCurrency(r.monto)}</span>
                            <form action={eliminarRetiro.bind(null, r.id)}>
                              <button
                                type="submit"
                                aria-label="Eliminar retiro"
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="size-3.5" />
                              </button>
                            </form>
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="flex gap-2">
                  <RetiroFormDialog
                    cuentaAlias={c.alias}
                    action={crearRetiro.bind(null, c.id)}
                    trigger={
                      <Button size="sm" variant="outline" className="flex-1">
                        <ArrowDownCircle />
                        Retiro
                      </Button>
                    }
                  />
                  <CuentaFormDialog
                    trigger={
                      <Button size="sm" variant="outline" className="flex-1">
                        <Pencil />
                        Editar
                      </Button>
                    }
                    title="Editar cuenta"
                    action={actualizarCuenta.bind(null, c.id)}
                    defaultValues={{
                      alias: c.alias,
                      tipo: c.tipo,
                      banco: c.banco,
                      numeroCuenta: c.numeroCuenta,
                      clabe: c.clabe,
                      swift: c.swift,
                      saldoInicial: Number(c.saldoInicial),
                      activa: c.activa,
                      notas: c.notas,
                    }}
                    submitLabel="Guardar cambios"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
