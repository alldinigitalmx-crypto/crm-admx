import Link from "next/link";
import Image from "next/image";
import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemedLogo } from "@/components/themed-logo";
import { PasswordField } from "@/components/ui/password-field";
import {
  Mail,
  Briefcase,
  FileText,
  CreditCard,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; restablecido?: string }>;
}) {
  const { error, restablecido } = await searchParams;

  // Si el ícono de "agregar a pantalla de inicio" (start_url en el
  // manifest) abre directo aquí, y la sesión sigue viva (con "Mantener
  // sesión iniciada" puede durar hasta 90 días), no tiene sentido
  // mostrar el formulario de nuevo — se manda directo al panel.
  const session = await auth();
  if (session?.user && (session.user as { role?: string }).role === "admin") {
    redirect("/admin");
  }

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("admin-login", {
        email: formData.get("email"),
        password: formData.get("password"),
        remember: formData.get("remember") === "on" ? "true" : "false",
        redirectTo: "/admin",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw err;
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca (izquierda) — siempre oscuro, sin importar el tema
          que el usuario elija para el resto del sitio; el toggle de tema
          solo afecta el panel del formulario, a la derecha. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[oklch(0.13_0.012_260)] p-12 lg:flex xl:px-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.96 0.006 260 / 0.06) 1px, transparent 1px)",
            backgroundSize: "72px 100%",
          }}
        />
        <div className="pointer-events-none absolute -bottom-40 -left-36 size-[520px] rounded-full bg-primary/15 blur-[90px]" />

        <div className="relative flex items-center justify-between gap-4">
          <Image
            src="/admx-logo-gold.png"
            alt="Admx Dev"
            width={1037}
            height={608}
            priority
            className="h-11 w-auto"
          />
          <span className="font-mono text-[11px] tracking-[0.12em] text-white/35">
            PANEL INTERNO
          </span>
        </div>

        <div className="relative max-w-[520px]">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-pretty text-white">
            Toda tu operación, en un solo panel.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Servicios, cotizaciones, pagos y clientes centralizados para Admx
            Dev.
          </p>

          <div className="mt-10 border-t border-white/10">
            <div className="flex items-center gap-3.5 border-b border-white/10 py-4">
              <Briefcase className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm text-white/85">
                Servicios y cotizaciones en un solo lugar
              </span>
            </div>
            <div className="flex items-center gap-3.5 border-b border-white/10 py-4">
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm text-white/85">
                Portal de clientes con seguimiento de avance
              </span>
            </div>
            <div className="flex items-center gap-3.5 border-b border-white/10 py-4">
              <CreditCard className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm text-white/85">
                Cobros con Mercado Pago, PayPal y transferencia
              </span>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/35">
          © {new Date().getFullYear()} Admx Dev · Acceso restringido a
          personal autorizado
        </p>
      </div>

      {/* Panel de formulario (derecha) — este sí sigue el tema claro/oscuro
          del sitio a través de los tokens (bg-background, bg-card, etc.). */}
      <div className="relative flex flex-col bg-background">
        <div className="flex items-center justify-end gap-2 p-6">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10 lg:px-14">
          <div className="w-full max-w-sm">
            {/* Logo junto al formulario, siempre visible (móvil, tablet y
                PC) -- en PC convive con el logo grande del panel de marca
                de la izquierda, pero éste, chico y junto a "Bienvenido de
                vuelta", es el que de verdad identifica el formulario como
                el CRM y no una pantalla de login genérica. */}
            <ThemedLogo className="mb-6 h-14 w-auto" />

            <h2 className="text-[26px] leading-tight font-semibold tracking-tight">
              Bienvenido de vuelta
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Entra con tu cuenta para continuar al panel.
            </p>

            {error && (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Correo o contraseña incorrectos.
              </p>
            )}

            {restablecido && (
              <p className="mt-4 rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm">
                Tu contraseña se actualizó. Ya puedes iniciar sesión.
              </p>
            )}

            <div className="mt-7 rounded-2xl border bg-card p-6 shadow-sm">
              <form action={login} className="flex flex-col gap-[18px]">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="email"
                    className="text-[12.5px] font-medium text-muted-foreground"
                  >
                    Correo
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="tucorreo@admxdev.com"
                      className="h-[42px] pl-10"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="password"
                      className="text-[12.5px] font-medium text-muted-foreground"
                    >
                      Contraseña
                    </Label>
                    <Link
                      href="/recuperar"
                      className="text-xs text-primary hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <PasswordField
                    id="password"
                    name="password"
                    required
                    className="h-[42px] pl-10"
                  />
                </div>

                <div className="flex items-start gap-2.5">
                  <Checkbox id="remember" name="remember" defaultChecked className="mt-0.5" />
                  <Label
                    htmlFor="remember"
                    className="flex-col items-start gap-0.5 text-[13px] leading-snug font-normal text-muted-foreground"
                  >
                    <span>Mantener sesión iniciada en este dispositivo</span>
                    <span className="text-[11.5px] text-muted-foreground/75">
                      Hasta 90 días. No la uses en equipos compartidos.
                    </span>
                  </Label>
                </div>

                <Button type="submit" className="mt-1 h-[42px] w-full gap-2 text-[14px] font-semibold">
                  Entrar al panel <ArrowRight className="size-4" />
                </Button>
              </form>
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" />
              Conexión cifrada · los accesos quedan registrados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
