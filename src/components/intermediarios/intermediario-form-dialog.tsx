"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IntermediarioForm } from "@/components/intermediarios/intermediario-form";
import type { IntermediarioFormState } from "@/app/admin/intermediarios/actions";

type IntermediarioDefaults = {
  nombre: string;
  telefono: string | null;
  email: string | null;
  notas: string | null;
};

export function IntermediarioFormDialog({
  trigger,
  title,
  description,
  action,
  defaultValues,
  submitLabel,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (
    prevState: IntermediarioFormState,
    formData: FormData
  ) => Promise<IntermediarioFormState>;
  defaultValues?: IntermediarioDefaults;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <IntermediarioForm
          action={action}
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
