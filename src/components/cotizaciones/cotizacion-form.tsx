"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  clienteId?: number;
  servicioId?: number | null;
  descripcion?: string | null;
  detalles?: string | null;
  montoSubtotal?: number | string | { toString(): string } | null;
  descuentoTipo: string | null;
  descuentoValor: number | string | { toString(): string } | null;
  descuentoMotivo: string | null;
  fechaVencimiento: Date | null;
  porcentajeAnticipo?: number | null;
};

type OrdenOption = { id: number; descripcion: string; monto: number; status: string };

export type ServicioOption = {
  id: number;
  descripcion: string;
  clienteNombre: string;
  montoTotal: number;
  ordenesCambio: OrdenOption[];
};

export type ClienteOption = { id: number; nombre: string };

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function CotizacionForm({
  action,
  servicios,
  clientes,
  montoSubtotal,
  defaultValues,
  submitLabel,
  onCancel,
}: {
  action: (
    prevState: CotizacionFormState,
    formData: FormData
  ) => Promise<CotizacionFormState>;
  servicios?: ServicioOption[];
  clientes?: ClienteOption[];
  montoSubtotal?: number;
  defaultValues?: CotizacionDefaults;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  const editandoSinServicio = Boolean(defaultValues) && !defaultValues?.servicioId;
  const puedeElegirModo = Boolean(servicios?.length) && Boolean(clientes?.length) && !defaultValues;
  const [modo, setModo] = useState<"servicio" | "negociacion">(
    editandoSinServicio ? "negociacion" : "servicio"
  );
  const usaServicio = Boolean(servicios && (modo === "servicio" || !puedeElegirModo) && !editandoSinServicio);

  const [servicioId, setServicioId] = useState<string>(
    servicios?.[0] ? String(servicios[0].id) : ""
  );
  const [ordenCambioId, setOrdenCambioId] = useState<string>("none");
  const [moneda, setMoneda] = useState<string>("MXN");
  const [requiereAnticipo, setRequiereAnticipo] = useState(
    Boolean(defaultValues?.porcentajeAnticipo)
  );
  const [clienteId, setClienteId] = useState<string>(
    defaultValues?.clienteId ? String(defaultValues.clienteId) : (clientes?.[0] ? String(clientes[0].id) : "")
  );

  const servicioSeleccionado = servicios?.find((s) => String(s.id) === servicioId);
  const ordenSeleccionada = servicioSeleccionado?.ordenesCambio.find(
    (o) => String(o.id) === ordenCambioId
  );
  const subtotalPreview = usaServicio
    ? (ordenSeleccionada ? ordenSeleccionada.monto : (servicioSeleccionado?.montoTotal ?? 0))
    : (montoSubtotal ?? 0);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {puedeElegirModo && (
        <div className="flex gap-2 rounded-lg border border-input bg-muted/40 p-1 text-sm">
          <button
            type="button"
            onClick={() => setModo("servicio")}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${modo === "servicio" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Para un servicio existente
          </button>
          <button
            type="button"
            onClick={() => setModo("negociacion")}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${modo === "negociacion" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Nueva negociación (sin servicio)
          </button>
        </div>
      )}

      {usaServicio && servicios && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="servicioId">Servicio *</Label>
            <Select
              name="servicioId"
              required
              value={servicioId}
              onValueChange={(v) => {
                setServicioId(v);
                setOrdenCambioId("none");
              }}
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="ordenCambioId">Vincular a</Label>
            <Select name="ordenCambioId" value={ordenCambioId} onValueChange={setOrdenCambioId}>
              <SelectTrigger id="ordenCambioId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Servicio completo</SelectItem>
                {servicioSeleccionado?.ordenesCambio
                  .filter((o) => o.status !== "Rechazada")
                  .map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      Orden de cambio: {o.descripcion} ({formatCurrency(o.monto)})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {!usaServicio && (clientes || editandoSinServicio) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {clientes && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="clienteId">Cliente *</Label>
              <Select name="clienteId" required value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id="clienteId" className="w-full">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__prospecto__">+ Prospecto nuevo (sin registrar)</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {clienteId === "__prospecto__" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="prospectoNombre">Nombre del prospecto *</Label>
              <Input
                id="prospectoNombre"
                name="prospectoNombre"
                required
                placeholder="Nombre de quien está cotizando"
              />
              <p className="text-xs text-muted-foreground">
                Se guarda como prospecto — podrás darlo de alta como cliente después.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="montoSubtotal">Monto *</Label>
            <Input
              id="montoSubtotal"
              name="montoSubtotal"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={
                defaultValues?.montoSubtotal ? String(defaultValues.montoSubtotal) : ""
              }
              placeholder="0.00"
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Input
              id="descripcion"
              name="descripcion"
              required
              defaultValue={defaultValues?.descripcion ?? ""}
              placeholder="Ej. Sistema de reservas para..."
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="detalles">Detalles</Label>
            <Textarea
              id="detalles"
              name="detalles"
              rows={3}
              defaultValue={defaultValues?.detalles ?? ""}
              placeholder="Alcance, entregables, notas de la negociación..."
            />
          </div>
        </div>
      )}

      {usaServicio && (
        <p className="text-sm text-muted-foreground">
          Subtotal {ordenSeleccionada ? "de la orden de cambio" : "actual del servicio"}:{" "}
          <span className="font-medium text-foreground">{formatCurrency(subtotalPreview)}</span>
        </p>
      )}

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
            <Select name="moneda" value={moneda} onValueChange={setMoneda}>
              <SelectTrigger id="moneda" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="COP">COP</SelectItem>
              </SelectContent>
            </Select>
            {(moneda === "USD" || moneda === "EUR") && (
              <p className="text-xs text-muted-foreground">
                En {moneda} el cliente solo podrá pagar con PayPal — Mercado Pago no acepta esa
                moneda.
              </p>
            )}
            {moneda === "COP" && (
              <p className="text-xs text-muted-foreground">
                En COP no hay pago electrónico disponible (ni Mercado Pago ni PayPal la aceptan)
                — el cliente solo podrá pagar por transferencia bancaria.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-input p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="requiereAnticipo"
            checked={requiereAnticipo}
            onCheckedChange={(v) => setRequiereAnticipo(v === true)}
          />
          <Label htmlFor="requiereAnticipo" className="font-normal">
            Cobrar en dos partes (anticipo + liquidación al terminar)
          </Label>
        </div>
        {requiereAnticipo && (
          <div className="flex flex-col gap-2 sm:w-48">
            <Label htmlFor="porcentajeAnticipo">% de anticipo</Label>
            <Input
              id="porcentajeAnticipo"
              name="porcentajeAnticipo"
              type="number"
              min="1"
              max="99"
              defaultValue={defaultValues?.porcentajeAnticipo ?? 50}
            />
            <p className="text-xs text-muted-foreground">
              El cliente paga este % primero; el resto se le pide cuando la cotización
              quede con el saldo pendiente (por ejemplo, al terminar el proyecto).
            </p>
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
