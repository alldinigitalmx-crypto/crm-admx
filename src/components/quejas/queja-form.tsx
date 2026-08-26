"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuejaFormState } from "@/app/admin/quejas/actions";

type ServicioOption = { id: number; descripcion: string };
export type ClienteOption = { id: number; nombre: string; servicios: ServicioOption[] };

const CATEGORIAS = ["Falla", "Cobro", "Atencion", "Sugerencia", "Otro"];

export function QuejaForm({
  action,
  clientes,
  clienteFijo,
  onSuccess,
  onCancel,
}: {
  action: (prevState: QuejaFormState, formData: FormData) => Promise<QuejaFormState>;
  clientes?: ClienteOption[];
  clienteFijo?: ClienteOption;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: QuejaFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) onSuccess?.();
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);

  const [clienteId, setClienteId] = useState<string>(
    clientes?.[0] ? String(clientes[0].id) : ""
  );
  const [servicioId, setServicioId] = useState<string>("none");

  const clienteSeleccionado = clienteFijo ?? clientes?.find((c) => String(c.id) === clienteId);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {clientes && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="clienteId">Cliente *</Label>
          <Select
            name="clienteId"
            required
            value={clienteId}
            onValueChange={(v) => {
              setClienteId(v);
              setServicioId("none");
            }}
          >
            <SelectTrigger id="clienteId" className="w-full">
              <SelectValue placeholder="Selecciona un cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {clienteFijo && (
        <>
          <input type="hidden" name="clienteId" value={clienteFijo.id} />
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clienteFijo.nombre}</span>
          </p>
        </>
      )}

      {clienteSeleccionado && clienteSeleccionado.servicios.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="servicioId">Servicio relacionado</Label>
          <Select name="servicioId" value={servicioId} onValueChange={setServicioId}>
            <SelectTrigger id="servicioId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin servicio específico</SelectItem>
              {clienteSeleccionado.servicios.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="categoria">Categoría *</Label>
        <Select name="categoria" required defaultValue="Otro">
          <SelectTrigger id="categoria" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descripcion">Descripción *</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          required
          rows={4}
          placeholder="Cuéntanos qué pasó..."
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enviando..." : "Enviar queja"}
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
