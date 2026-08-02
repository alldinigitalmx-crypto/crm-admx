"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServicioFormState } from "@/app/admin/servicios/actions";

const STATUSES = ["Cotizado", "Aprobado", "EnProceso", "Entregado", "Cancelado"] as const;

type ServicioDefaults = {
  clienteId: number;
  descripcion: string;
  detalles: string | null;
  fechaInicio: Date;
  fechaFin: Date | null;
  montoInicial: number | string | { toString(): string };
  status: string;
  intermediarioId: number | null;
  porcentajeIntermediario: (number | string | { toString(): string }) | null;
  responsableId: number | null;
};

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function ServicioForm({
  action,
  clientes,
  intermediarios,
  usuarios,
  usuarioActualId,
  defaultValues,
  submitLabel,
  onCancel,
}: {
  action: (
    prevState: ServicioFormState,
    formData: FormData
  ) => Promise<ServicioFormState>;
  clientes: { id: number; nombre: string }[];
  intermediarios: { id: number; nombre: string }[];
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
  defaultValues?: ServicioDefaults;
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="descripcion">Descripción *</Label>
          <Input
            id="descripcion"
            name="descripcion"
            required
            defaultValue={defaultValues?.descripcion}
            placeholder="Ej. Sitio web corporativo"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="clienteId">Cliente *</Label>
          <Select
            name="clienteId"
            required
            defaultValue={
              defaultValues ? String(defaultValues.clienteId) : undefined
            }
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={defaultValues?.status ?? "Cotizado"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fechaInicio">Fecha de inicio *</Label>
          <Input
            id="fechaInicio"
            name="fechaInicio"
            type="date"
            required
            defaultValue={toDateInputValue(defaultValues?.fechaInicio)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fechaFin">Fecha de fin</Label>
          <Input
            id="fechaFin"
            name="fechaFin"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.fechaFin)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="montoInicial">Monto inicial *</Label>
          <Input
            id="montoInicial"
            name="montoInicial"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={
              defaultValues ? String(defaultValues.montoInicial) : ""
            }
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="intermediarioId">Intermediario</Label>
          <Select
            name="intermediarioId"
            defaultValue={
              defaultValues?.intermediarioId
                ? String(defaultValues.intermediarioId)
                : "none"
            }
          >
            <SelectTrigger id="intermediarioId" className="w-full">
              <SelectValue placeholder="Ninguno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno</SelectItem>
              {intermediarios.map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>
                  {i.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="responsableId">Responsable *</Label>
          <Select
            name="responsableId"
            required
            defaultValue={
              defaultValues?.responsableId
                ? String(defaultValues.responsableId)
                : usuarioActualId
                  ? String(usuarioActualId)
                  : undefined
            }
          >
            <SelectTrigger id="responsableId" className="w-full">
              <SelectValue placeholder="Selecciona un responsable" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="porcentajeIntermediario">% comisión intermediario</Label>
          <Input
            id="porcentajeIntermediario"
            name="porcentajeIntermediario"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={
              defaultValues?.porcentajeIntermediario
                ? String(defaultValues.porcentajeIntermediario)
                : ""
            }
            placeholder="Ej. 10"
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="detalles">Detalles</Label>
          <Textarea
            id="detalles"
            name="detalles"
            rows={4}
            defaultValue={defaultValues?.detalles ?? ""}
            placeholder="Alcance y notas del servicio"
          />
        </div>
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
