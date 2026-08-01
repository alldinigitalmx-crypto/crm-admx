"use client";

import { useActionState, useEffect, useState } from "react";
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
import type { OrdenCambioFormState } from "@/app/admin/servicios/actions";

export function OrdenCambioFormDialog({
  action,
}: {
  action: (
    prevState: OrdenCambioFormState,
    formData: FormData
  ) => Promise<OrdenCambioFormState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    // Closes the dialog once the server action reports success.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus />
          Nueva orden de cambio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva orden de cambio</DialogTitle>
          <DialogDescription>
            Ajuste solicitado por el cliente sobre este servicio.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Input
              id="descripcion"
              name="descripcion"
              required
              placeholder="Ej. Agregar módulo de reportes"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="monto">Monto adicional *</Label>
            <Input
              id="monto"
              name="monto"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Registrar"}
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
