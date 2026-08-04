import { createHash } from "crypto";
import Link from "next/link";
import { Lock } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemedLogo } from "@/components/themed-logo";
import { restablecerPassword } from "./actions";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const ERRORES: Record<string, string> = {
  corta: "La contraseña debe tener al menos 6 caracteres.",
  nocoincide: "Las contraseñas no coinciden.",
  invalido: "Este enlace ya no es válido. Solicita uno nuevo.",
};

export default async function RestablecerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const usuario = await prisma.usuario.findFirst({
    where: { resetTokenHash: hashToken(token), resetTokenExpiraEn: { gt: new Date() } },
    select: { id: true },
  });

  const boundRestablecer = restablecerPassword.bind(null, token);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-end p-6">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <ThemedLogo className="mb-6 h-14 w-auto" />

          <h2 className="text-2xl font-semibold">Nueva contraseña</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escribe tu nueva contraseña para tu cuenta.
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {ERRORES[error] ?? "No se pudo restablecer la contraseña."}
            </p>
          )}

          {!usuario ? (
            <div className="mt-6 flex flex-col gap-3">
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Este enlace ya expiró o no es válido.
              </p>
              <Link
                href="/recuperar"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Solicitar un enlace nuevo
              </Link>
            </div>
          ) : (
            <form action={boundRestablecer} className="mt-7 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmar">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmar"
                    name="confirmar"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 w-full bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-500/40"
              >
                Guardar contraseña
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
