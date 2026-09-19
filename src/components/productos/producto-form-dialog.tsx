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
import { ProductoForm, type ProductoDefaults } from "@/components/productos/producto-form";
import type { ProductoFormState } from "@/app/admin/productos/actions";

export function ProductoFormDialog({
  trigger,
  title,
  description,
  action,
  defaultValues,
  submitLabel,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  action: (prevState: ProductoFormState, formData: FormData) => Promise<ProductoFormState>;
  defaultValues?: ProductoDefaults;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Nuevo producto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ProductoForm
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
