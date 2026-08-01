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
import { ClienteForm } from "@/components/clientes/cliente-form";
import type { Cliente } from "@/generated/prisma/client";
import type { ClienteFormState } from "@/app/admin/clientes/actions";

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

export function ClienteFormDialog({
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
    prevState: ClienteFormState,
    formData: FormData
  ) => Promise<ClienteFormState>;
  defaultValues?: ClienteDefaults;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ClienteForm
          action={action}
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
