"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
import type { VentaFormState } from "@/app/admin/ventas/actions";

export type ProductoOption = { id: number; nombre: string; precio: number };
export type ClienteOption = { id: number; nombre: string };

type LineaItem = { productoId: string; cantidad: number; precioUnitario: number };

type VentaDefaults = {
  fecha: Date;
  origen: string;
  canal: string | null;
  nombreComprador: string | null;
  emailComprador: string | null;
  metodoPago: string | null;
  tipoEntrega: string;
  referidoPorId: number | null;
  comisionReferido: (number | string | { toString(): string }) | null;
  items: LineaItem[];
};

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return new Date().toISOString().slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

export function VentaForm({
  action,
  productos,
  clientes,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prevState: VentaFormState, formData: FormData) => Promise<VentaFormState>;
  productos: ProductoOption[];
  clientes: ClienteOption[];
  defaultValues?: VentaDefaults;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: VentaFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) onSuccess?.();
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);

  const [origen, setOrigen] = useState(defaultValues?.origen ?? "Manual");
  const [referidoPorId, setReferidoPorId] = useState(
    defaultValues?.referidoPorId ? String(defaultValues.referidoPorId) : "none"
  );
  const [items, setItems] = useState<LineaItem[]>(
    defaultValues?.items && defaultValues.items.length > 0
      ? defaultValues.items
      : [{ productoId: productos[0] ? String(productos[0].id) : "", cantidad: 1, precioUnitario: productos[0]?.precio ?? 0 }]
  );

  function actualizarLinea(index: number, cambios: Partial<LineaItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...cambios } : it)));
  }

  function agregarLinea() {
    const primerProducto = productos[0];
    setItems((prev) => [
      ...prev,
      {
        productoId: primerProducto ? String(primerProducto.id) : "",
        cantidad: 1,
        precioUnitario: primerProducto?.precio ?? 0,
      },
    ]);
  }

  function quitarLinea(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const total = items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nombreComprador">Comprador</Label>
          <Input
            id="nombreComprador"
            name="nombreComprador"
            defaultValue={defaultValues?.nombreComprador ?? ""}
            placeholder="Nombre (opcional)"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="emailComprador">Correo del comprador</Label>
          <Input
            id="emailComprador"
            name="emailComprador"
            type="email"
            defaultValue={defaultValues?.emailComprador ?? ""}
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.fecha)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="origen">Origen *</Label>
          <Select name="origen" value={origen} onValueChange={setOrigen}>
            <SelectTrigger id="origen" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Manual">Manual</SelectItem>
              <SelectItem value="TiendaOnline">Tienda Online</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {origen === "Manual" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="canal">Canal</Label>
            <Select name="canal" defaultValue={defaultValues?.canal ?? "Directo"}>
              <SelectTrigger id="canal" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Directo">Directo</SelectItem>
                <SelectItem value="Referido">Referido</SelectItem>
                <SelectItem value="GrupoWhatsApp">Grupo de WhatsApp</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="metodoPago">Método de pago</Label>
          <Select name="metodoPago" defaultValue={defaultValues?.metodoPago ?? "none"}>
            <SelectTrigger id="metodoPago" className="w-full">
              <SelectValue placeholder="Sin especificar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin especificar</SelectItem>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Transferencia">Transferencia</SelectItem>
              <SelectItem value="MercadoPago">Mercado Pago</SelectItem>
              <SelectItem value="PayPal">PayPal</SelectItem>
              <SelectItem value="Tarjeta">Tarjeta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tipoEntrega">Tipo de entrega</Label>
          <Select name="tipoEntrega" defaultValue={defaultValues?.tipoEntrega ?? "Inmediata"}>
            <SelectTrigger id="tipoEntrega" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Inmediata">Inmediata</SelectItem>
              <SelectItem value="LargoPlazo">Largo plazo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="referidoPorId">Referido por</Label>
          <Select name="referidoPorId" value={referidoPorId} onValueChange={setReferidoPorId}>
            <SelectTrigger id="referidoPorId" className="w-full">
              <SelectValue placeholder="Sin referido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin referido</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {referidoPorId !== "none" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="comisionReferido">Comisión del referido</Label>
            <Input
              id="comisionReferido"
              name="comisionReferido"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                defaultValues?.comisionReferido ? String(defaultValues.comisionReferido) : ""
              }
              placeholder="0.00"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <Label>Productos *</Label>
          <Button type="button" size="sm" variant="outline" onClick={agregarLinea}>
            <Plus />
            Agregar producto
          </Button>
        </div>

        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border border-input p-2">
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Producto</Label>
              <Select
                value={item.productoId}
                onValueChange={(v) => {
                  const producto = productos.find((p) => String(p.id) === v);
                  actualizarLinea(index, {
                    productoId: v,
                    precioUnitario: producto?.precio ?? item.precioUnitario,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-20 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={item.cantidad}
                onChange={(e) => actualizarLinea(index, { cantidad: Number(e.target.value) || 1 })}
              />
            </div>

            <div className="flex w-28 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Precio unit.</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={item.precioUnitario}
                onChange={(e) =>
                  actualizarLinea(index, { precioUnitario: Number(e.target.value) || 0 })
                }
              />
            </div>

            <div className="flex w-24 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Subtotal</Label>
              <p className="py-1.5 text-sm font-medium">
                {formatCurrency(item.cantidad * item.precioUnitario)}
              </p>
            </div>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => quitarLinea(index)}
              disabled={items.length === 1}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <p className="self-end text-sm">
          Total: <span className="font-semibold">{formatCurrency(total)}</span>
        </p>
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
