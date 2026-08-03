"use client";

import { useActionState, useState } from "react";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import type { QuejaFormState } from "@/app/admin/quejas/actions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Nueva: "outline",
  EnRevision: "default",
  Resuelta: "secondary",
  Cerrada: "secondary",
};

const STATUSES = ["Nueva", "EnRevision", "Resuelta", "Cerrada"];

export type QuejaDetalle = {
  id: number;
  categoria: string;
  descripcion: string;
  status: string;
  respuesta: string | null;
  creadoEn: Date;
  respondidoEn: Date | null;
  cliente: { nombre: string };
  servicio: { descripcion: string } | null;
  asignadoAId: number | null;
};

function ResponderForm({
  quejaId,
  status,
  respuesta,
  asignadoAId,
  usuarios,
  action,
  onSuccess,
}: {
  quejaId: number;
  status: string;
  respuesta: string | null;
  asignadoAId: number | null;
  usuarios: { id: number; nombre: string }[];
  action: (prevState: QuejaFormState, formData: FormData) => Promise<QuejaFormState>;
  onSuccess?: () => void;
}) {
  const wrappedAction = async (prevState: QuejaFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) onSuccess?.();
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t pt-3">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`status-${quejaId}`}>Status</Label>
        <Select name="status" defaultValue={status}>
          <SelectTrigger id={`status-${quejaId}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`respuesta-${quejaId}`}>Respuesta</Label>
        <Textarea
          id={`respuesta-${quejaId}`}
          name="respuesta"
          rows={3}
          defaultValue={respuesta ?? ""}
          placeholder="Escribe tu respuesta para el cliente..."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`asignadoAId-${quejaId}`}>Asignado a</Label>
        <Select
          name="asignadoAId"
          defaultValue={asignadoAId ? String(asignadoAId) : "none"}
        >
          <SelectTrigger id={`asignadoAId-${quejaId}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignar</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}

export function QuejaDetalleDialog({
  queja,
  action,
  usuarios = [],
}: {
  queja: QuejaDetalle;
  action?: (prevState: QuejaFormState, formData: FormData) => Promise<QuejaFormState>;
  usuarios?: { id: number; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="size-7">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Queja #{String(queja.id).padStart(4, "0")}</DialogTitle>
          <DialogDescription>
            {queja.cliente.nombre}
            {queja.servicio ? ` — ${queja.servicio.descripcion}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Categoría</p>
              <p>{queja.categoria}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant={STATUS_VARIANT[queja.status] ?? "outline"}>{queja.status}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Reportada</p>
              <p>{formatDate(queja.creadoEn)}</p>
            </div>
            {queja.respondidoEn && (
              <div>
                <p className="text-muted-foreground">Respondida</p>
                <p>{formatDate(queja.respondidoEn)}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-muted-foreground">Descripción</p>
            <p className="whitespace-pre-wrap">{queja.descripcion}</p>
          </div>

          {!action && (
            <div className="border-t pt-3">
              <p className="text-muted-foreground">Respuesta</p>
              {queja.respuesta ? (
                <p className="whitespace-pre-wrap">{queja.respuesta}</p>
              ) : (
                <p className="text-muted-foreground">Aún no hay respuesta.</p>
              )}
            </div>
          )}

          {action && (
            <ResponderForm
              quejaId={queja.id}
              status={queja.status}
              respuesta={queja.respuesta}
              asignadoAId={queja.asignadoAId}
              usuarios={usuarios}
              action={action}
              onSuccess={() => setOpen(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
