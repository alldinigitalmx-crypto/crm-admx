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
import type { Cliente } from "@/generated/prisma/client";
import type { ClienteFormState } from "@/app/admin/clientes/actions";

const ETIQUETAS = ["VIP", "Premium", "Platinum"] as const;

const MEDIOS = [
  { value: "FacebookAds", label: "Facebook Ads" },
  { value: "Grupo", label: "Grupo" },
  { value: "Intermediario", label: "Intermediario" },
  { value: "Otro", label: "Otro" },
];

type ClienteDefaults = Pick<
  Cliente,
  | "nombre"
  | "etiqueta"
  | "pais"
  | "telefono"
  | "email"
  | "medioCaptacion"
  | "codigoReferido"
  | "notas"
>;

export function ClienteForm({
  action,
  defaultValues,
  submitLabel,
  onCancel,
}: {
  action: (
    prevState: ClienteFormState,
    formData: FormData
  ) => Promise<ClienteFormState>;
  defaultValues?: ClienteDefaults;
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
          <Label htmlFor="nombre">Nombre *</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            defaultValue={defaultValues?.nombre}
            placeholder="Nombre completo o razón social"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="etiqueta">Etiqueta</Label>
          <Select name="etiqueta" defaultValue={defaultValues?.etiqueta ?? "none"}>
            <SelectTrigger id="etiqueta" className="w-full">
              <SelectValue placeholder="Sin etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin etiqueta</SelectItem>
              {ETIQUETAS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="medioCaptacion">Medio de captación</Label>
          <Select
            name="medioCaptacion"
            defaultValue={defaultValues?.medioCaptacion ?? "none"}
          >
            <SelectTrigger id="medioCaptacion" className="w-full">
              <SelectValue placeholder="Sin especificar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin especificar</SelectItem>
              {MEDIOS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="pais">País</Label>
          <Input
            id="pais"
            name="pais"
            defaultValue={defaultValues?.pais ?? ""}
            placeholder="México"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            defaultValue={defaultValues?.telefono ?? ""}
            placeholder="+52 55 0000 0000"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            placeholder="cliente@empresa.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="codigoReferido">Código de referido</Label>
          <Input
            id="codigoReferido"
            name="codigoReferido"
            defaultValue={defaultValues?.codigoReferido ?? ""}
            placeholder="Opcional, único"
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="notas">Notas</Label>
          <Textarea
            id="notas"
            name="notas"
            rows={4}
            defaultValue={defaultValues?.notas ?? ""}
            placeholder="Notas libres del administrador"
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
