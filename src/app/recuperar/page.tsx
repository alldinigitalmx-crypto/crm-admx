import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemedLogo } from "@/components/themed-logo";
import { Mail } from "lucide-react";
import { solicitarRecuperacion } from "./actions";

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const { error, enviado } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-end p-6">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <ThemedLogo className="mb-6 h-14 w-auto" />

          <h2 className="text-2xl font-semibold">Recuperar contraseña</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escribe tu correo y te enviaremos un enlace para restablecerla.
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Escribe un correo válido.
            </p>
          )}

          {enviado ? (
            <p className="mt-6 rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm">
              Si ese correo tiene una cuenta activa, te enviamos un enlace para restablecer tu
              contraseña. Revisa tu bandeja de entrada (y spam).
            </p>
          ) : (
            <form action={solicitarRecuperacion} className="mt-7 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Correo</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="tucorreo@empresa.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="submit" className="mt-2 w-full">
                Enviar enlace
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
