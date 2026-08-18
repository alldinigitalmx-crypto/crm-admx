"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TareaForm, type TareaDefaultValues, type VinculoOption } from "@/components/tareas/tarea-form";
import type { TareaFormState } from "@/app/admin/tareas/actions";

export function TareaFormDialog({
  action,
  vinculos,
  vinculoFijo,
  usuarios,
  usuarioActualId,
  triggerLabel = "Nueva tarea",
  trigger,
  title = "Nueva tarea",
  description = "Tareas libres con prioridad y fecha límite — aparecen en tu panel.",
  defaultValues,
  submitLabel = "Crear tarea",
}: {
  action: (
    prevState: TareaFormState,
    formData: FormData
  ) => Promise<TareaFormState>;
  vinculos?: VinculoOption[];
  vinculoFijo?: { value: string; label: string };
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
  triggerLabel?: string;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  defaultValues?: TareaDefaultValues;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <TareaForm
          action={action}
          vinculos={vinculos}
          vinculoFijo={vinculoFijo}
          usuarios={usuarios}
          usuarioActualId={usuarioActualId}
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
