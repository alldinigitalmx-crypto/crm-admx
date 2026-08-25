"use client";

import { useActionState, useState } from "react";

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
import type { RetiroFormState } from "@/app/admin/cuentas/actions";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function RetiroFormDialog({
  trigger,
  cuentaAlias,
  action,
}: {
  trigger: React.ReactNode;
  cuentaAlias: string;
  action: (prevState: RetiroFormState, formData: FormData) => Promise<RetiroFormState>;
}) {
  const [open, setOpen] = useState(false);

  const wrappedAction = async (prevState: RetiroFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) setOpen(false);
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar retiro</DialogTitle>
          <DialogDescription>
            Dinero que sale de {cuentaAlias} sin ser un gasto categorizado — resta del
            disponible.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" name="fecha" type="date" defaultValue={toDateInputValue(new Date())} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="monto">Monto *</Label>
            <Input id="monto" name="monto" type="number" step="0.01" min="0.01" required placeholder="0.00" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="comentario">Comentario</Label>
            <Input id="comentario" name="comentario" placeholder="Opcional" />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Registrar retiro"}
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
