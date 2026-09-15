import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { esAdmin, permisosModulo } from "@/lib/alcance";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ModuloSistema } from "@/generated/prisma/client";

const FORMATO_ACTUALIZADO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Mexico_City",
});

const MODULOS_SIDEBAR: ModuloSistema[] = [
  "Clientes",
  "Servicios",
  "Cotizaciones",
  "Pagos",
  "Productos",
  "Ventas",
  "Quejas",
  "Tareas",
  "Intermediarios",
  "Portafolio",
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

  // Contadores junto a Servicios/Cotizaciones/Tareas/Usuarios y Accesos en
  // el menú lateral (como en el diseño) -- "propio" para un usuario interno
  // (mismo criterio que su Panel), sin acotar para el dueño o quien tenga
  // alcance "Todo" en ese módulo. permisosModulo() ya resuelve al dueño
  // sin ir a la base de datos, así que llamarlo aquí no cuesta extra.
  const [permisosServiciosBadge, permisosCotizacionesBadge, permisosTareasBadge] = await Promise.all([
    permisosModulo(usuario, "Servicios"),
    permisosModulo(usuario, "Cotizaciones"),
    permisosModulo(usuario, "Tareas"),
  ]);
  const serviciosBadgeWhere = permisosServiciosBadge.verTodo ? {} : { responsableId: usuario.id };
  const cotizacionesBadgeWhere = permisosCotizacionesBadge.verTodo
    ? {}
    : { OR: [{ creadoPorId: usuario.id }, { servicio: { responsableId: usuario.id } }] };
  const tareasBadgeWhere = permisosTareasBadge.verTodo ? {} : { asignadoAId: usuario.id };

  const [serviciosCount, cotizacionesCount, tareasCount, ticketsCount] = await Promise.all([
    modulosVisibles.includes("Servicios")
      ? prisma.servicio.count({ where: { status: { in: ["Aprobado", "EnProceso"] }, ...serviciosBadgeWhere } })
      : Promise.resolve(0),
    modulosVisibles.includes("Cotizaciones")
      ? prisma.cotizacion.count({ where: { status: "Enviada", ...cotizacionesBadgeWhere } })
      : Promise.resolve(0),
    modulosVisibles.includes("Tareas")
      ? prisma.tarea.count({ where: { completada: false, ...tareasBadgeWhere } })
      : Promise.resolve(0),
    // Tickets de acceso son exclusivos del dueño (mismo criterio que
    // "Usuarios y Accesos" en el menú, ver soloAdmin en app-sidebar.tsx).
    esAdminUsuario ? prisma.ticketAcceso.count({ where: { status: "Pendiente" } }) : Promise.resolve(0),
  ]);
  const sidebarCounts = {
    "/admin/servicios": serviciosCount,
    "/admin/cotizaciones": cotizacionesCount,
    "/admin/tareas": tareasCount,
    "/admin/usuarios": ticketsCount,
  };

  const actualizadoEn = FORMATO_ACTUALIZADO.format(new Date());

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
        counts={sidebarCounts}
      />
      <SidebarInset>
        <AdminTopbar
          userEmail={session.user.email}
          userName={session.user.name}
          onSignOut={signOutAction}
          actualizadoEn={actualizadoEn}
        />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
