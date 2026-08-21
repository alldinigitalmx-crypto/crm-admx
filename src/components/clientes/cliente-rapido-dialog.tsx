"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ClienteRapidoState } from "@/app/admin/clientes/actions";

/** Alta rápida de cliente en un modal chico (solo nombre/teléfono/email) —
 * usado tanto para "+ Nuevo cliente" dentro del alta de Servicio, como para
 * "Convertir en cliente" desde una cotización de prospecto. Al crearse con
 * éxito, avisa al padre vía onCreated en vez de navegar a ningún lado. */
export function ClienteRapidoDialog({
  trigger,
  title = "Nuevo cliente",
  description,
  defaultNombre,
  action,
  onCreated,
}: {
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  defaultNombre?: string;
  action: (
    prevState: ClienteRapidoState,
    formData: FormData
  ) => Promise<ClienteRapidoState>;
  onCreated: (cliente: { id: number; nombre: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(action, undefined);
  const lastHandled = useRef<{ id: number } | null>(null);

  useEffect(() => {
    if (state && "cliente" in state && state.cliente.id !== lastHandled.current?.id) {
      lastHandled.current = { id: state.cliente.id };
      onCreated(state.cliente);
      setOpen(false);
    }
  }, [state, onCreated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Plus />
            Nuevo cliente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {state && "error" in state && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="cr-nombre">Nombre *</Label>
            <Input
              id="cr-nombre"
              name="nombre"
              required
              defaultValue={defaultNombre}
              placeholder="Nombre completo o razón social"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cr-telefono">Teléfono</Label>
            <Input id="cr-telefono" name="telefono" placeholder="+52 55 0000 0000" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cr-email">Email</Label>
            <Input id="cr-email" name="email" type="email" placeholder="cliente@empresa.com" />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Crear cliente"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
