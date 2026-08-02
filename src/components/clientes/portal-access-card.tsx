"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Dices } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PortalFormState } from "@/app/admin/clientes/actions";

function generarPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function PasswordDialog({
  triggerLabel,
  action,
}: {
  triggerLabel: string;
  action: (prevState: PortalFormState, formData: FormData) => Promise<PortalFormState>;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const wrappedAction = async (prevState: PortalFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) setSaved(true);
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);

  async function copiar() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSaved(false);
          setPassword("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Contraseña del portal</DialogTitle>
          <DialogDescription>
            Compártela por WhatsApp con el cliente — no queda guardada en texto plano.
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              Contraseña guardada. Cópiala ahora — no se volverá a mostrar.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={password} className="font-mono" />
              <Button type="button" size="icon" variant="outline" onClick={copiar}>
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            {state?.error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="password"
                  name="password"
                  className="font-mono"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Generar contraseña"
                  onClick={() => setPassword(generarPassword())}
                >
                  <Dices />
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PortalAccessCard({
  email,
  portalActivo,
  ultimoAcceso,
  guardarPassword,
  desactivar,
}: {
  email: string | null;
  portalActivo: boolean;
  ultimoAcceso: string | null;
  guardarPassword: (
    prevState: PortalFormState,
    formData: FormData
  ) => Promise<PortalFormState>;
  desactivar: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">Portal del cliente</CardTitle>
        <Badge variant={portalActivo ? "secondary" : "outline"}>
          {portalActivo ? "Activo" : "Inactivo"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!email && (
          <p className="text-muted-foreground">
            Este cliente no tiene correo registrado — agrégalo para poder activar el portal.
          </p>
        )}
        {email && !portalActivo && (
          <p className="text-muted-foreground">
            Activa el acceso para que {email} pueda entrar a{" "}
            <span className="font-medium text-foreground">/portal/login</span> y ver sus
            proyectos, cotizaciones y quejas.
          </p>
        )}
        {email && portalActivo && (
          <div className="text-muted-foreground">
            <p>
              Acceso con <span className="font-medium text-foreground">{email}</span>
            </p>
            <p>
              Último acceso: {ultimoAcceso ?? "aún no ha entrado"}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {email && (
            <PasswordDialog
              triggerLabel={portalActivo ? "Restablecer contraseña" : "Activar portal"}
              action={guardarPassword}
            />
          )}
          {portalActivo && (
            <form action={desactivar}>
              <Button type="submit" variant="outline" size="sm">
                Desactivar
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
