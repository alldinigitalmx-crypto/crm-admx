"use client";

import { Fragment, useState } from "react";
import { ArrowDownCircle, Pencil, Wallet, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CuentaFormDialog } from "@/components/cuentas/cuenta-form-dialog";
import { RetiroFormDialog } from "@/components/cuentas/retiro-form-dialog";
import { actualizarCuenta, crearRetiro, eliminarRetiro } from "@/app/admin/cuentas/actions";
import { formatCurrency, formatDate } from "@/lib/format";
import { TIPO_CUENTA_COLOR } from "@/lib/status-colors";
import type { Movimiento } from "@/lib/cuenta";

const TIPOS = ["Banco", "Efectivo", "Billetera"] as const;

export type CuentaVista = {
  id: number;
  alias: string;
  tipo: string;
  banco: string | null;
  numeroCuenta: string | null;
  clabe: string | null;
  swift: string | null;
  notas: string | null;
  activa: boolean;
  saldoInicial: number;
  pagos: number;
  gastos: number;
  retirosMonto: number;
  ingresosPorRetiros: number;
  saldo: number;
  retirosLista: { id: number; fecha: Date; monto: number; comentario: string | null }[];
  movimientos: Movimiento[];
  color: string;
};

const MOVIMIENTO_COLOR: Record<Movimiento["tipo"], string> = {
  Pago: "text-emerald-600 dark:text-emerald-400",
  "Retiro recibido": "text-emerald-600 dark:text-emerald-400",
  Gasto: "text-destructive",
  Retiro: "text-destructive",
};

function DetalleCuenta({ cuenta, puedeEditar }: { cuenta: CuentaVista; puedeEditar: boolean }) {
  const desglose = [
    { label: "Saldo inicial", valor: formatCurrency(cuenta.saldoInicial) },
    { label: "Pagos confirmados", valor: `+${formatCurrency(cuenta.pagos)}` },
    ...(cuenta.ingresosPorRetiros > 0
      ? [{ label: "Retiros recibidos", valor: `+${formatCurrency(cuenta.ingresosPorRetiros)}` }]
      : []),
    { label: "Gastos", valor: `−${formatCurrency(cuenta.gastos)}` },
    { label: "Retiros", valor: `−${formatCurrency(cuenta.retirosMonto)}` },
  ];

  const datos = [
    { label: "Tipo", valor: cuenta.tipo },
    { label: "Banco", valor: cuenta.banco ?? "—" },
    { label: "Cuenta", valor: cuenta.numeroCuenta ?? "—" },
    { label: "CLABE", valor: cuenta.clabe ?? "—" },
    { label: "SWIFT", valor: cuenta.swift ?? "—" },
    ...(cuenta.notas ? [{ label: "Notas", valor: cuenta.notas }] : []),
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2.5 pb-4">
        <span className="text-[10px] font-medium tracking-wider text-primary uppercase">{cuenta.alias}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{formatCurrency(cuenta.saldo)}</span>
          <span className="text-[11px] text-muted-foreground">disponible</span>
        </div>
        <div className="flex flex-col">
          {desglose.map((d) => (
            <div key={d.label} className="flex items-center justify-between border-b border-border/60 py-1.5 text-[11.5px]">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="tabular-nums text-foreground/80">{d.valor}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Movimientos</span>
          <span className="text-[10.5px] text-muted-foreground">últimos {cuenta.movimientos.length}</span>
        </div>
        {cuenta.movimientos.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Sin movimientos todavía.</p>
        ) : (
          <div className="flex flex-col">
            {cuenta.movimientos.map((m) => {
              // Solo un "Retiro" (no "Retiro recibido", que es el reflejo
              // en la cuenta destino) tiene de verdad un registro propio
              // que se pueda borrar -- mismo botón que ya existía en el
              // acordeón de retiros de la tarjeta vieja.
              const retiroId = m.tipo === "Retiro" ? Number(m.id.split(":")[1]) : null;
              return (
                <div key={m.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-border/60 py-2">
                  <span className="text-[10.5px] text-muted-foreground">{formatDate(m.fecha)}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[12.5px]">{m.concepto}</span>
                    <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{m.tipo}</span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={`whitespace-nowrap text-[12px] tabular-nums ${MOVIMIENTO_COLOR[m.tipo]}`}>
                      {m.monto > 0 ? "+" : ""}
                      {formatCurrency(m.monto)}
                    </span>
                    {puedeEditar && retiroId !== null && (
                      <form action={eliminarRetiro.bind(null, retiroId)}>
                        <button type="submit" aria-label="Eliminar retiro" className="text-muted-foreground hover:text-destructive">
                          <X className="size-3.5" />
                        </button>
                      </form>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border py-4">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Datos de la cuenta</span>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1.5">
          {datos.map((d) => (
            <Fragment key={d.label}>
              <span className="text-[10.5px] tracking-wide text-muted-foreground uppercase">{d.label}</span>
              <span className="truncate text-right text-[11.5px] text-foreground/80">{d.valor}</span>
            </Fragment>
          ))}
        </div>

        {puedeEditar && (
          <div className="mt-2 flex gap-2">
            <RetiroFormDialog
              cuentaAlias={cuenta.alias}
              action={crearRetiro.bind(null, cuenta.id)}
              trigger={
                <Button className="flex-1" variant="secondary">
                  <ArrowDownCircle />
                  Registrar retiro
                </Button>
              }
            />
            <CuentaFormDialog
              trigger={
                <Button className="flex-1" variant="outline">
                  <Pencil />
                  Editar cuenta
                </Button>
              }
              title="Editar cuenta"
              action={actualizarCuenta.bind(null, cuenta.id)}
              defaultValues={{
                alias: cuenta.alias,
                tipo: cuenta.tipo,
                banco: cuenta.banco,
                numeroCuenta: cuenta.numeroCuenta,
                clabe: cuenta.clabe,
                swift: cuenta.swift,
                saldoInicial: cuenta.saldoInicial,
                activa: cuenta.activa,
                notas: cuenta.notas,
              }}
              submitLabel="Guardar cambios"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function CuentasPanel({ cuentas, puedeEditar }: { cuentas: CuentaVista[]; puedeEditar: boolean }) {
  const [filtro, setFiltro] = useState<"Todas" | (typeof TIPOS)[number]>("Todas");
  const [verInactivas, setVerInactivas] = useState(false);
  const [seleccionada, setSeleccionada] = useState<number>(cuentas[0]?.id ?? 0);
  const [sheetAbierta, setSheetAbierta] = useState(false);

  const visibles = cuentas.filter((c) => (verInactivas || c.activa) && (filtro === "Todas" || c.tipo === filtro));
  const cuentaSel = cuentas.find((c) => c.id === seleccionada) ?? cuentas[0];
  const maxFlujo = Math.max(1, ...cuentas.map((c) => c.pagos + c.ingresosPorRetiros + c.gastos + c.retirosMonto));
  const sumaVisible = visibles.reduce((a, c) => a + c.saldo, 0);

  function abrirDetalleMobile(id: number) {
    setSeleccionada(id);
    setSheetAbierta(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Escritorio ---------- */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-border px-7 py-3">
            <div className="flex gap-1.5">
              {(["Todas", ...TIPOS] as const).map((f) => {
                const activo = filtro === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltro(f)}
                    className={`h-7.5 rounded-md border px-3 text-[13px] ${
                      activo ? "border-foreground bg-foreground text-background font-medium" : "border-input bg-background hover:bg-muted/50"
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setVerInactivas((v) => !v)}
              className="h-7.5 rounded-md border border-input px-2.5 text-[11px] tracking-wide text-foreground/80 uppercase hover:bg-muted/50"
            >
              {verInactivas ? "Ocultar inactivas" : "Mostrar inactivas"}
            </button>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_150px_172px_110px] items-end gap-4 border-b border-foreground px-7 pt-2.5 pb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            <span>Cuenta</span>
            <span className="text-right">Disponible</span>
            <span>Flujo acumulado</span>
            <span className="text-right">Acciones</span>
          </div>

          {visibles.map((c) => {
            const entra = c.pagos + c.ingresosPorRetiros;
            const sale = c.gastos + c.retirosMonto;
            const wIn = Math.round((entra / maxFlujo) * 100);
            const wOut = Math.round((sale / maxFlujo) * 100);
            const activa = c.id === seleccionada;
            return (
              <div
                key={c.id}
                onClick={() => setSeleccionada(c.id)}
                className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_150px_172px_110px] items-center gap-4 border-b border-border/60 px-7 py-3.5 ${
                  activa ? "bg-primary/5" : "hover:bg-muted/30"
                }`}
                style={{ borderLeft: `2px solid ${activa ? "var(--primary)" : "transparent"}` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-7.5 w-[3px] shrink-0 rounded-sm ${c.color}`} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-semibold">{c.alias}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {c.tipo}
                      </Badge>
                      {!c.activa && (
                        <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {[c.banco, c.numeroCuenta].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <span className={`text-[17px] font-semibold tabular-nums ${c.saldo < 0 ? "text-destructive" : ""}`}>
                    {formatCurrency(c.saldo)}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex h-1.5 gap-0.5">
                    <span className="rounded-sm bg-emerald-500" style={{ width: `${wIn}%` }} />
                    <span className="rounded-sm bg-destructive" style={{ width: `${wOut}%` }} />
                    <span className="flex-1 rounded-sm bg-muted" />
                  </div>
                  <div className="flex gap-2.5 text-[10.5px] tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(entra)}</span>
                    <span className="text-destructive">−{formatCurrency(sale)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {puedeEditar && (
                    <>
                      <RetiroFormDialog
                        cuentaAlias={c.alias}
                        action={crearRetiro.bind(null, c.id)}
                        trigger={
                          <Button size="sm" variant="outline" className="h-7.5 px-2 text-[11px]">
                            Retiro
                          </Button>
                        }
                      />
                      <CuentaFormDialog
                        trigger={
                          <Button size="icon" variant="outline" className="size-7.5">
                            <Pencil className="size-3.5" />
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
                          saldoInicial: c.saldoInicial,
                          activa: c.activa,
                          notas: c.notas,
                        }}
                        submitLabel="Guardar cambios"
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-[minmax(0,1fr)_150px_172px_110px] gap-4 px-7 py-3.5">
            <span className="pl-[18px] text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              {visibles.length} cuenta{visibles.length === 1 ? "" : "s"}
            </span>
            <span className="text-right text-[17px] font-semibold tabular-nums">{formatCurrency(sumaVisible)}</span>
            <span className="self-center text-[10.5px] text-muted-foreground">Saldo inicial + pagos − gastos − retiros</span>
            <span />
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto border-l border-border px-5 py-1">
          {cuentaSel && <DetalleCuenta cuenta={cuentaSel} puedeEditar={puedeEditar} />}
        </div>
      </div>

      {/* ---------- Móvil ---------- */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {(["Todas", ...TIPOS] as const).map((f) => {
            const activo = filtro === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                  activo ? "border-foreground bg-foreground text-background" : "border-input bg-card text-foreground/80"
                }`}
              >
                {f}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setVerInactivas((v) => !v)}
            className="shrink-0 rounded-full border border-input px-3.5 py-1.5 text-[12px] text-foreground/80"
          >
            {verInactivas ? "Ocultar inactivas" : "Mostrar inactivas"}
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {visibles.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => abrirDetalleMobile(c.id)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm active:scale-[0.98]"
            >
              <div className={`flex size-11 shrink-0 items-center justify-center rounded-full text-primary ${TIPO_CUENTA_COLOR[c.tipo] ?? "bg-primary/10"}`}>
                <Wallet className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{c.alias}</span>
                  {!c.activa && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Inactiva
                    </Badge>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {[c.banco, c.numeroCuenta].filter(Boolean).join(" · ") || c.tipo}
                </p>
              </div>
              <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${c.saldo < 0 ? "text-destructive" : ""}`}>
                {formatCurrency(c.saldo)}
              </span>
            </button>
          ))}
        </div>

        <Sheet open={sheetAbierta} onOpenChange={setSheetAbierta}>
          <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-4 pb-6">
            <SheetHeader className="px-0">
              <SheetTitle>Detalle de cuenta</SheetTitle>
            </SheetHeader>
            {cuentaSel && <DetalleCuenta cuenta={cuentaSel} puedeEditar={puedeEditar} />}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
