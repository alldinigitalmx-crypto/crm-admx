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
} from "lucide-react";

import type { ModuloSistema } from "@/generated/prisma/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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
}: {
  modulosVisibles: ModuloSistema[];
  esAdmin: boolean;
}) {
  const pathname = usePathname();
  const modulosSet = new Set(modulosVisibles);

  const items = navPrincipal.filter((item) => {
    if ("soloAdmin" in item && item.soloAdmin) return esAdmin;
    if (!item.modulo) return true;
    return modulosSet.has(item.modulo as ModuloSistema);
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-600">
            <Code2 className="size-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-wide group-data-[collapsible=icon]:hidden">
            ADMX DEV
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Fase 1</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/admin"
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                    }
                    tooltip={item.title}
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
    </Sidebar>
  );
}
