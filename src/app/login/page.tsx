import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Code2, Mail, Lock } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/clientes",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw err;
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1220] p-4 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-blue-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 size-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="absolute left-6 top-6 flex items-center gap-2 text-white sm:left-10 sm:top-10">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600">
          <Code2 className="size-4.5" />
        </div>
        <span className="text-sm font-semibold tracking-wide">ADMX DEV</span>
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111827] shadow-2xl shadow-black/50">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />

        <div className="p-8 sm:p-10">
          <div className="flex items-center gap-2 sm:hidden">
            <div className="flex size-7 items-center justify-center rounded-md bg-blue-600">
              <Code2 className="size-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-white">
              ADMX DEV
            </span>
          </div>

          <h1 className="mt-6 text-2xl font-semibold text-white sm:mt-0">
            Bienvenido de vuelta
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Entra con tu cuenta para continuar
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              Correo o contraseña incorrectos.
            </p>
          )}

          <form action={login} className="mt-7 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-slate-300">
                Correo
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="tucorreo@empresa.com"
                  className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-300">
                  Contraseña
                </Label>
                <a
                  href="#"
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 w-full bg-blue-600 font-medium text-white transition-colors hover:bg-blue-500"
            >
              Entrar
            </Button>
          </form>
        </div>

        <div className="border-t border-white/10 bg-white/[0.02] px-8 py-4 sm:px-10">
          <p className="text-center text-xs text-slate-500">
            Panel de administración · Admx Dev
          </p>
        </div>
      </div>
    </div>
  );
}
