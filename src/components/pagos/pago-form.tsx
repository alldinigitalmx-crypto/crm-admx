"use client";

import { useActionState, useRef, useState } from "react";
import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PagoFormState } from "@/app/admin/pagos/actions";

export type ServicioOption = { id: number; descripcion: string; clienteNombre: string };

type PagoDefaults = {
  servicioId: number;
  fecha: Date;
  metodoPago: string;
  monto: number | string | { toString(): string };
  comision: (number | string | { toString(): string }) | null;
  moneda: string | null;
  montoMXN: (number | string | { toString(): string }) | null;
  cuentaId: number | null;
  comprobante: string | null;
  confirmado: boolean;
};

export type CuentaOption = { id: number; alias: string };

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function PagoForm({
  action,
  servicios,
  servicioFijo,
  cuentas,
  defaultValues,
  comprobanteExistente,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prevState: PagoFormState, formData: FormData) => Promise<PagoFormState>;
  servicios?: ServicioOption[];
  servicioFijo?: { id: number; label: string };
  // Solo se pasa para un Admin — Cuentas es información exclusiva del
  // dueño (igual que Reportes/Gastos), un usuario interno normal no debe
  // ver ni elegir a qué cuenta bancaria entró un pago.
  cuentas?: CuentaOption[];
  defaultValues?: PagoDefaults;
  comprobanteExistente?: { nombre: string } | null;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: PagoFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) onSuccess?.();
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);
  const [archivoDataUrl, setArchivoDataUrl] = useState<string | null>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  // El check arranca marcado si el pago que se edita ya venía en otra
  // moneda -- así no se le "esconde" el dato al abrir para editarlo.
  const [monedaEsExtranjera, setMonedaEsExtranjera] = useState(
    Boolean(defaultValues?.moneda && defaultValues.moneda !== "MXN")
  );
  const [moneda, setMoneda] = useState(
    defaultValues?.moneda && defaultValues.moneda !== "MXN" ? defaultValues.moneda : "USD"
  );
  const montoRef = useRef<HTMLInputElement>(null);
  const comisionRef = useRef<HTMLInputElement>(null);
  const montoMXNRef = useRef<HTMLInputElement>(null);
  const [neto, setNeto] = useState<number | null>(
    defaultValues?.comision ? Number(defaultValues.monto) - Number(defaultValues.comision) : null
  );

  // El campo "Monto" siempre es lo que le cobraron al cliente (el bruto);
  // "Comisión" es lo que se quedó la pasarela. Este preview es lo único
  // que hace falta para no volver a confundir bruto con neto: se ve al
  // teclear, antes de guardar, y se compara fácil contra lo que el
  // banco/PayPal/Mercado Pago de verdad depositó.
  function actualizarNeto() {
    const monto = Number(montoRef.current?.value ?? "");
    const comision = Number(comisionRef.current?.value ?? "");
    setNeto(monto > 0 && comision > 0 ? monto - comision : null);
  }
  const [cargandoTipoCambio, setCargandoTipoCambio] = useState(false);
  const [tipoCambioInfo, setTipoCambioInfo] = useState<{ rate: number; fecha: string | null } | null>(
    null
  );
  const [tipoCambioError, setTipoCambioError] = useState<string | null>(null);

  // PayPal sí convierte solo a pesos cuando el cobro es en dólares, pero
  // ese tipo de cambio (con el margen que le aplica PayPal) solo lo sabe
  // PayPal -- este botón nada más sugiere un punto de partida con el tipo
  // de cambio del día (Frankfurter/BCE), que el usuario puede ajustar si
  // PayPal le mostró otro número.
  async function usarTipoCambioDeHoy() {
    const montoActual = Number(montoRef.current?.value ?? "");
    if (!montoActual || montoActual <= 0) {
      setTipoCambioError("Captura primero el monto en dólares.");
      return;
    }
    setCargandoTipoCambio(true);
    setTipoCambioError(null);
    try {
      const res = await fetch(`/api/tipo-cambio?from=${moneda}&monto=${montoActual}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo obtener el tipo de cambio.");
      if (montoMXNRef.current) montoMXNRef.current.value = Number(data.mxn).toFixed(2);
      setTipoCambioInfo({ rate: data.rate, fecha: data.fecha });
    } catch (err) {
      setTipoCambioError(
        err instanceof Error ? err.message : "No se pudo obtener el tipo de cambio."
      );
    } finally {
      setCargandoTipoCambio(false);
    }
  }

  function onArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoNombre(file.name);
    const reader = new FileReader();
    reader.onload = () => setArchivoDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {servicios && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="servicioId">Servicio *</Label>
          <Select
            name="servicioId"
            required
            defaultValue={
              defaultValues?.servicioId
                ? String(defaultValues.servicioId)
                : servicios[0]
                  ? String(servicios[0].id)
                  : undefined
            }
          >
            <SelectTrigger id="servicioId" className="w-full">
              <SelectValue placeholder="Selecciona un servicio" />
            </SelectTrigger>
            <SelectContent>
              {servicios.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.descripcion} — {s.clienteNombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {servicioFijo && (
        <>
          <input type="hidden" name="servicioId" value={servicioFijo.id} />
          <p className="text-sm text-muted-foreground">
            Servicio: <span className="font-medium text-foreground">{servicioFijo.label}</span>
          </p>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.fecha) || toDateInputValue(new Date())}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="metodoPago">Método de pago *</Label>
          <Select name="metodoPago" required defaultValue={defaultValues?.metodoPago ?? "Transferencia"}>
            <SelectTrigger id="metodoPago" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Transferencia">Transferencia</SelectItem>
              <SelectItem value="MercadoPago">Mercado Pago</SelectItem>
              <SelectItem value="PayPal">PayPal</SelectItem>
              <SelectItem value="Tarjeta">Tarjeta</SelectItem>
              <SelectItem value="WesternUnion">Western Union</SelectItem>
              <SelectItem value="Binance">Binance</SelectItem>
              <SelectItem value="Deposito">Depósito</SelectItem>
              <SelectItem value="Spin">Spin by OXXO</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="monto">Monto (lo que le cobraron al cliente) *</Label>
          <Input
            id="monto"
            name="monto"
            ref={montoRef}
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaultValues?.monto ? String(defaultValues.monto) : ""}
            placeholder="0.00"
            onChange={actualizarNeto}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="comision">Comisión de la pasarela</Label>
          <Input
            id="comision"
            name="comision"
            ref={comisionRef}
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.comision ? String(defaultValues.comision) : ""}
            placeholder="0.00"
            onChange={actualizarNeto}
          />
          {neto != null && (
            <p className="text-xs text-muted-foreground">
              Te depositan (neto): <span className="font-medium text-foreground">{neto.toFixed(2)}</span> —
              compáralo con lo que de verdad te llegó antes de guardar.
            </p>
          )}
        </div>

        {cuentas && (
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="cuentaId">Cuenta</Label>
            <Select name="cuentaId" defaultValue={defaultValues?.cuentaId ? String(defaultValues.cuentaId) : "none"}>
              <SelectTrigger id="cuentaId" className="w-full">
                <SelectValue placeholder="Sin cuenta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cuenta</SelectItem>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.alias}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-input p-3 sm:col-span-2">
          <input type="hidden" name="moneda" value={monedaEsExtranjera ? moneda : "MXN"} />
          <div className="flex items-center gap-2">
            <Checkbox
              id="monedaEsExtranjera"
              checked={monedaEsExtranjera}
              onCheckedChange={(v) => setMonedaEsExtranjera(v === true)}
            />
            <Label htmlFor="monedaEsExtranjera" className="font-normal">
              Este pago fue en otra moneda (no pesos)
            </Label>
          </div>

          {monedaEsExtranjera && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="monedaSelect">Moneda</Label>
                <Select value={moneda} onValueChange={setMoneda}>
                  <SelectTrigger id="monedaSelect" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="COP">COP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="montoMXN">Equivalente en pesos (MXN) *</Label>
                <div className="flex gap-2">
                  <Input
                    id="montoMXN"
                    name="montoMXN"
                    ref={montoMXNRef}
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={defaultValues?.montoMXN ? String(defaultValues.montoMXN) : ""}
                    placeholder="0.00"
                    onChange={() => setTipoCambioInfo(null)}
                  />
                  {(moneda === "USD" || moneda === "EUR") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Sugerir con el tipo de cambio de hoy"
                      disabled={cargandoTipoCambio}
                      onClick={usarTipoCambioDeHoy}
                    >
                      <Wand2 className={cargandoTipoCambio ? "animate-pulse" : undefined} />
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground sm:col-span-2">
                <p>
                  El campo &quot;Monto&quot; de arriba es en {moneda}. Aquí captura cuánto
                  representó en pesos mexicanos — los reportes siempre suman en MXN, así que sin
                  este dato un pago en {moneda} no cuenta bien.
                </p>
                {(moneda === "USD" || moneda === "EUR") && (
                  <p className="mt-1">
                    {tipoCambioError ? (
                      <span className="text-destructive">{tipoCambioError}</span>
                    ) : tipoCambioInfo ? (
                      <>
                        Sugerido con 1 {moneda} ≈ {tipoCambioInfo.rate.toFixed(2)} MXN (
                        {tipoCambioInfo.fecha ?? "hoy"}) — ajústalo si PayPal te mostró otro
                        número, el suyo trae su propio margen.
                      </>
                    ) : (
                      <>
                        Usa <Wand2 className="inline size-3" /> para partir del tipo de cambio de
                        hoy — PayPal aplica el suyo (con su margen), así que revisa que coincida
                        con lo que a ti te mostró.
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="comprobante">Referencia</Label>
          <Input
            id="comprobante"
            name="comprobante"
            defaultValue={defaultValues?.comprobante ?? ""}
            placeholder="Número de referencia o notas (opcional)"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="comprobanteArchivo">Comprobante (imagen o PDF)</Label>
          <Input
            id="comprobanteArchivo"
            type="file"
            accept="image/*,application/pdf"
            onChange={onArchivoChange}
          />
          {archivoNombre ? (
            <p className="text-xs text-muted-foreground">{archivoNombre}</p>
          ) : comprobanteExistente ? (
            <p className="text-xs text-muted-foreground">
              Ya tiene un comprobante subido ({comprobanteExistente.nombre}). Selecciona otro
              archivo para reemplazarlo.
            </p>
          ) : null}
          <input type="hidden" name="comprobanteArchivo" value={archivoDataUrl ?? ""} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="confirmado"
          name="confirmado"
          defaultChecked={defaultValues?.confirmado ?? true}
        />
        <Label htmlFor="confirmado" className="font-normal">
          Marcar como confirmado
        </Label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
