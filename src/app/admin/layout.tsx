import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { currentUsuario } from "@/lib/current-usuario";
import { esAdmin, permisosModulo } from "@/lib/alcance";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ModuloSistema } from "@/generated/prisma/client";

const MODULOS_SIDEBAR: ModuloSistema[] = [
  "Clientes",
  "Servicios",
  "Cotizaciones",
  "Pagos",
  "Productos",
  "Ventas",
  "Quejas",
  "Tareas",
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/login");
  }

  const usuario = await currentUsuario();
  if (!usuario?.activo) {
    redirect("/login");
  }

  const esAdminUsuario = esAdmin(usuario);
  const modulosVisibles = esAdminUsuario
    ? MODULOS_SIDEBAR
    : (
        await Promise.all(
          MODULOS_SIDEBAR.map(async (modulo) => {
            const permisos = await permisosModulo(usuario, modulo);
            return permisos.puedeVer ? modulo : null;
          })
        )
      ).filter((m): m is ModuloSistema => m !== null);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SidebarProvider>
      <AppSidebar
        modulosVisibles={modulosVisibles}
        esAdmin={esAdminUsuario}
        userEmail={session.user.email}
        userName={session.user.name}
        onSignOut={signOutAction}
      />
      <SidebarInset>
        <AdminTopbar
          userEmail={session.user.email}
          userName={session.user.name}
          onSignOut={signOutAction}
        />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
