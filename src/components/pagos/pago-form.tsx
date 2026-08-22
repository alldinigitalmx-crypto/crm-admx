"use client";

import { useActionState } from "react";

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
  cuenta: string | null;
  comprobante: string | null;
  confirmado: boolean;
};

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function PagoForm({
  action,
  servicios,
  servicioFijo,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prevState: PagoFormState, formData: FormData) => Promise<PagoFormState>;
  servicios?: ServicioOption[];
  servicioFijo?: { id: number; label: string };
  defaultValues?: PagoDefaults;
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.fecha) || toDateInputValue(new Date())}
          />
        </div>

        <div className="flex flex-col gap-2">
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="monto">Monto *</Label>
          <Input
            id="monto"
            name="monto"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaultValues?.monto ? String(defaultValues.monto) : ""}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="comision">Comisión</Label>
          <Input
            id="comision"
            name="comision"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.comision ? String(defaultValues.comision) : ""}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cuenta">Cuenta</Label>
          <Input
            id="cuenta"
            name="cuenta"
            list="cuentas-pago"
            defaultValue={defaultValues?.cuenta ?? ""}
            placeholder="Ej. BBVA, Binance, PayPal..."
          />
          <datalist id="cuentas-pago">
            <option value="BBVA" />
            <option value="Binance" />
            <option value="PayPal" />
            <option value="Efectivo" />
          </datalist>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="moneda">Moneda</Label>
          <Select name="moneda" defaultValue={defaultValues?.moneda ?? "MXN"}>
            <SelectTrigger id="moneda" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="COP">COP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="comprobante">Comprobante / referencia</Label>
          <Input
            id="comprobante"
            name="comprobante"
            defaultValue={defaultValues?.comprobante ?? ""}
            placeholder="Opcional"
          />
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
