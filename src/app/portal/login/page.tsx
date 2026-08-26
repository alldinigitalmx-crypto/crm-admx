import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemedLogo } from "@/components/themed-logo";
import { Code2, Mail, Lock, Briefcase, FileText, LifeBuoy } from "lucide-react";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Mismo caso que /login: si el ícono de la app en el celular abre
  // directo aquí y la sesión del cliente sigue viva, no tiene caso
  // pedirle que inicie sesión de nuevo.
  const session = await auth();
  if (session?.user && (session.user as { role?: string }).role === "cliente") {
    redirect("/portal");
  }

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("cliente-login", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/portal",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/portal/login?error=1");
      }
      throw err;
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca (izquierda) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 lg:flex xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 size-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-1/3 size-56 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative flex items-center gap-2 text-white">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Code2 className="size-4.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-wide">ADMX DEV</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold text-white xl:text-4xl">
            Tu proyecto, siempre a la vista.
          </h1>
          <p className="mt-3 text-slate-400">
            Portal de clientes de Admx Dev — avance, cotizaciones y soporte en un solo lugar.
          </p>

          <ul className="mt-9 space-y-4">
            <li className="flex items-center gap-3 text-sm text-slate-300">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                <Briefcase className="size-3.5 text-primary" />
              </span>
              Avance y evidencia de tu proyecto
            </li>
            <li className="flex items-center gap-3 text-sm text-slate-300">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                <FileText className="size-3.5 text-violet-400" />
              </span>
              Cotizaciones pendientes de firma o pago
            </li>
            <li className="flex items-center gap-3 text-sm text-slate-300">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                <LifeBuoy className="size-3.5 text-teal-400" />
              </span>
              Reporta y da seguimiento a tus quejas
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} Admx Dev · Portal del cliente
        </p>
      </div>

      {/* Panel de formulario (derecha) */}
      <div className="relative flex flex-col bg-background">
        <div className="flex items-center justify-end p-6">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-16 lg:px-12 xl:px-16">
          <div className="w-full max-w-sm">
            <ThemedLogo className="mb-6 h-14 w-auto" />

            <h2 className="text-2xl font-semibold">Portal del cliente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Entra con el correo y contraseña que te compartió Admx Dev
            </p>

            {error && (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Correo o contraseña incorrectos.
              </p>
            )}

            <form action={login} className="mt-7 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Correo</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="tucorreo@ejemplo.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="submit" className="mt-2 w-full">
                Entrar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
