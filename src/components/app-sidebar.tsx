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
  LifeBuoy,
  Globe,
  ShieldCheck,
  Code2,
  ListTodo,
  Wallet,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navPrincipal = [
  { title: "Panel", href: "/admin", icon: LayoutDashboard },
  { title: "Clientes", href: "/admin/clientes", icon: Users },
  { title: "Servicios", href: "/admin/servicios", icon: Briefcase },
  { title: "Cotizaciones", href: "/admin/cotizaciones", icon: FileText },
  { title: "Pagos", href: "/admin/pagos", icon: CreditCard },
  { title: "Tareas", href: "/admin/tareas", icon: ListTodo },
  { title: "Gastos", href: "/admin/gastos", icon: Wallet },
];

const navProximamente = [
  { title: "Productos y Ventas", icon: ShoppingBag },
  { title: "Quejas / Help Desk", icon: LifeBuoy },
  { title: "Portal del Cliente", icon: Globe },
  { title: "Usuarios y Accesos", icon: ShieldCheck },
];

export function AppSidebar() {
  const pathname = usePathname();

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
              {navPrincipal.map((item) => (
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

              {navProximamente.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton disabled tooltip={item.title}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>Pronto</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
