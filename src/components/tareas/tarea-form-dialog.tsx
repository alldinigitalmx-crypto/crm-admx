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
import { TareaForm, type VinculoOption } from "@/components/tareas/tarea-form";
import type { TareaFormState } from "@/app/admin/tareas/actions";

export function TareaFormDialog({
  action,
  vinculos,
  vinculoFijo,
  triggerLabel = "Nueva tarea",
}: {
  action: (
    prevState: TareaFormState,
    formData: FormData
  ) => Promise<TareaFormState>;
  vinculos?: VinculoOption[];
  vinculoFijo?: { value: string; label: string };
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>
            Tareas libres con prioridad y fecha límite — aparecen en tu panel.
          </DialogDescription>
        </DialogHeader>
        <TareaForm
          action={action}
          vinculos={vinculos}
          vinculoFijo={vinculoFijo}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
