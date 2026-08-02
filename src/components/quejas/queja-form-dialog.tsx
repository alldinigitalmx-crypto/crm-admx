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
import { QuejaForm, type ClienteOption } from "@/components/quejas/queja-form";
import type { QuejaFormState } from "@/app/admin/quejas/actions";

export function QuejaFormDialog({
  trigger,
  triggerLabel = "Nueva queja",
  title = "Nueva queja",
  description,
  action,
  clientes,
  clienteFijo,
}: {
  trigger?: React.ReactNode;
  triggerLabel?: string;
  title?: string;
  description?: string;
  action: (prevState: QuejaFormState, formData: FormData) => Promise<QuejaFormState>;
  clientes?: ClienteOption[];
  clienteFijo?: ClienteOption;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <QuejaForm
          action={action}
          clientes={clientes}
          clienteFijo={clienteFijo}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
