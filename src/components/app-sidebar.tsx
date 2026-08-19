"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  CreditCard,
  ShoppingBag,
  Package,
  LifeBuoy,
  ShieldCheck,
  Handshake,
  Code2,
  ListTodo,
  Wallet,
  BarChart3,
  LogOut,
} from "lucide-react";

import type { ModuloSistema } from "@/generated/prisma/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navPrincipal = [
  { title: "Panel", href: "/admin", icon: LayoutDashboard, modulo: null },
  { title: "Reportes", href: "/admin/reportes", icon: BarChart3, modulo: null },
  { title: "Clientes", href: "/admin/clientes", icon: Users, modulo: "Clientes" },
  { title: "Servicios", href: "/admin/servicios", icon: Briefcase, modulo: "Servicios" },
  { title: "Cotizaciones", href: "/admin/cotizaciones", icon: FileText, modulo: "Cotizaciones" },
  { title: "Pagos", href: "/admin/pagos", icon: CreditCard, modulo: "Pagos" },
  { title: "Tareas", href: "/admin/tareas", icon: ListTodo, modulo: "Tareas" },
  { title: "Gastos", href: "/admin/gastos", icon: Wallet, modulo: null },
  { title: "Quejas / Help Desk", href: "/admin/quejas", icon: LifeBuoy, modulo: "Quejas" },
  { title: "Productos", href: "/admin/productos", icon: Package, modulo: "Productos" },
  { title: "Ventas", href: "/admin/ventas", icon: ShoppingBag, modulo: "Ventas" },
  { title: "Intermediarios", href: "/admin/intermediarios", icon: Handshake, modulo: null },
  { title: "Usuarios y Accesos", href: "/admin/usuarios", icon: ShieldCheck, modulo: null, soloAdmin: true },
] as const;

export function AppSidebar({
  modulosVisibles,
  esAdmin,
  userEmail,
  userName,
  onSignOut,
}: {
  modulosVisibles: ModuloSistema[];
  esAdmin: boolean;
  userEmail?: string | null;
  userName?: string | null;
  onSignOut?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const modulosSet = new Set(modulosVisibles);

  const items = navPrincipal.filter((item) => {
    if ("soloAdmin" in item && item.soloAdmin) return esAdmin;
    if (!item.modulo) return true;
    return modulosSet.has(item.modulo as ModuloSistema);
  });

  const initial = (userName ?? userEmail ?? "?").charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className={`flex items-center gap-2.5 px-2 ${isMobile ? "py-3" : "py-1.5"}`}>
          <div
            className={`flex shrink-0 items-center justify-center rounded-md bg-blue-600 ${
              isMobile ? "size-9" : "size-7"
            }`}
          >
            <Code2 className={isMobile ? "size-5 text-white" : "size-4 text-white"} />
          </div>
          <span
            className={`font-semibold tracking-wide group-data-[collapsible=icon]:hidden ${
              isMobile ? "text-base" : "text-sm"
            }`}
          >
            ADMX DEV
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className={isMobile ? "gap-1.5" : undefined}>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    size={isMobile ? "lg" : "default"}
                    isActive={
                      item.href === "/admin"
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                    }
                    tooltip={item.title}
                    className={isMobile ? "gap-3 text-base [&_svg]:size-5" : undefined}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {isMobile && (
        <SidebarFooter>
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border px-2 py-2.5">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName ?? "Usuario"}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{userEmail}</p>
            </div>
            {onSignOut && (
              <form action={onSignOut}>
                <button
                  type="submit"
                  aria-label="Cerrar sesión"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="size-5" />
                </button>
              </form>
            )}
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
