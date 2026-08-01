"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import type { CotizacionFormState } from "@/app/admin/cotizaciones/actions";

type CotizacionDefaults = {
  descuentoTipo: string | null;
  descuentoValor: number | string | { toString(): string } | null;
  descuentoMotivo: string | null;
  fechaVencimiento: Date | null;
};

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function CotizacionForm({
  action,
  montoSubtotal,
  defaultValues,
  submitLabel,
  onCancel,
}: {
  action: (
    prevState: CotizacionFormState,
    formData: FormData
  ) => Promise<CotizacionFormState>;
  montoSubtotal: number;
  defaultValues?: CotizacionDefaults;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Subtotal actual del servicio:{" "}
        <span className="font-medium text-foreground">
          {formatCurrency(montoSubtotal)}
        </span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="descuentoTipo">Descuento</Label>
          <Select
            name="descuentoTipo"
            defaultValue={defaultValues?.descuentoTipo ?? "none"}
          >
            <SelectTrigger id="descuentoTipo" className="w-full">
              <SelectValue placeholder="Sin descuento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin descuento</SelectItem>
              <SelectItem value="Monto">Monto fijo</SelectItem>
              <SelectItem value="Porcentaje">Porcentaje</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="descuentoValor">Valor del descuento</Label>
          <Input
            id="descuentoValor"
            name="descuentoValor"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              defaultValues?.descuentoValor ? String(defaultValues.descuentoValor) : ""
            }
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="descuentoMotivo">Motivo del descuento</Label>
          <Input
            id="descuentoMotivo"
            name="descuentoMotivo"
            defaultValue={defaultValues?.descuentoMotivo ?? ""}
            placeholder="Requerido si aplicas un descuento"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fechaVencimiento">Fecha de vencimiento</Label>
          <Input
            id="fechaVencimiento"
            name="fechaVencimiento"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.fechaVencimiento)}
          />
        </div>

        {!defaultValues && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="moneda">Moneda</Label>
            <Select name="moneda" defaultValue="MXN">
              <SelectTrigger id="moneda" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="COP">COP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
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
