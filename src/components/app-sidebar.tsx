"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
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
  GalleryHorizontalEnd,
  Wallet,
  PiggyBank,
  BarChart3,
  Gauge,
  LineChart,
  LogOut,
} from "lucide-react";

import type { ModuloSistema } from "@/generated/prisma/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Grupo = "general" | "operacion" | "negocio" | "admin";

const GRUPO_LABEL: Record<Grupo, string> = {
  general: "General",
  operacion: "Operación",
  negocio: "Negocio",
  admin: "Administración",
};

const navPrincipal = [
  { title: "Panel", href: "/admin", icon: LayoutDashboard, modulo: null, grupo: "general" },
  {
    title: "Reportes",
    href: "/admin/reportes",
    icon: BarChart3,
    modulo: null,
    grupo: "general",
    // Financieros de todo el negocio — exclusivos del dueño, nunca
    // otorgables a un usuario interno (ver alcance.ts: requiereAdmin).
    soloAdmin: true,
  },
  {
    title: "KPIs",
    href: "/admin/kpis",
    icon: Gauge,
    modulo: null,
    grupo: "general",
    // Mismo criterio que Reportes: solo el dueño.
    soloAdmin: true,
  },
  {
    title: "Proyección",
    href: "/admin/proyeccion",
    icon: LineChart,
    modulo: null,
    grupo: "general",
    // Mismo criterio que Reportes/KPIs: solo el dueño.
    soloAdmin: true,
  },
  { title: "Clientes", href: "/admin/clientes", icon: Users, modulo: "Clientes", grupo: "operacion" },
  {
    title: "Prospectos",
    href: "/admin/prospectos",
    icon: UserPlus,
    modulo: "Clientes",
    grupo: "operacion",
  },
  { title: "Servicios", href: "/admin/servicios", icon: Briefcase, modulo: "Servicios", grupo: "operacion" },
  { title: "Cotizaciones", href: "/admin/cotizaciones", icon: FileText, modulo: "Cotizaciones", grupo: "operacion" },
  { title: "Pagos", href: "/admin/pagos", icon: CreditCard, modulo: "Pagos", grupo: "operacion" },
  { title: "Tareas", href: "/admin/tareas", icon: ListTodo, modulo: "Tareas", grupo: "operacion" },
  { title: "Quejas / Help Desk", href: "/admin/quejas", icon: LifeBuoy, modulo: "Quejas", grupo: "operacion" },
  { title: "Productos", href: "/admin/productos", icon: Package, modulo: "Productos", grupo: "negocio" },
  { title: "Ventas", href: "/admin/ventas", icon: ShoppingBag, modulo: "Ventas", grupo: "negocio" },
  {
    title: "Intermediarios",
    href: "/admin/intermediarios",
    icon: Handshake,
    modulo: "Intermediarios",
    grupo: "negocio",
  },
  {
    title: "Portafolio",
    href: "/admin/portafolio",
    icon: GalleryHorizontalEnd,
    modulo: "Portafolio",
    grupo: "negocio",
  },
  {
    title: "Gastos",
    href: "/admin/gastos",
    icon: Wallet,
    modulo: null,
    grupo: "negocio",
    // Igual que Reportes: solo el dueño, nunca otorgable.
    soloAdmin: true,
  },
  {
    title: "Cuentas",
    href: "/admin/cuentas",
    icon: PiggyBank,
    modulo: null,
    grupo: "negocio",
    // Igual que Gastos: saldos reales del dueño, solo Admin.
    soloAdmin: true,
  },
  {
    title: "Usuarios y Accesos",
    href: "/admin/usuarios",
    icon: ShieldCheck,
    modulo: null,
    grupo: "admin",
    soloAdmin: true,
  },
] as const satisfies readonly { title: string; href: string; icon: typeof LayoutDashboard; modulo: ModuloSistema | null; grupo: Grupo; soloAdmin?: boolean }[];

// Estado activo con el acento de marca (token --sidebar-accent/--sidebar-primary)
// en vez del gris genérico de shadcn.
const ITEM_ACTIVE_CLASS =
  "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:hover:bg-sidebar-accent data-[active=true]:hover:text-sidebar-accent-foreground [&[data-active=true]_svg]:text-sidebar-primary";

export function AppSidebar({
  modulosVisibles,
  esAdmin,
  userEmail,
  userName,
  onSignOut,
  counts,
}: {
  modulosVisibles: ModuloSistema[];
  esAdmin: boolean;
  userEmail?: string | null;
  userName?: string | null;
  onSignOut?: () => Promise<void>;
  // Contador junto al nombre del módulo (como en el diseño: Servicios,
  // Cotizaciones, Tareas, Usuarios y Accesos) -- llave = href del item.
  counts?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const modulosSet = new Set(modulosVisibles);

  const items = navPrincipal.filter((item) => {
    if ("soloAdmin" in item && item.soloAdmin) return esAdmin;
    if (!item.modulo) return true;
    return modulosSet.has(item.modulo as ModuloSistema);
  });

  const grupos = (["general", "operacion", "negocio", "admin"] as const)
    .map((grupo) => ({ grupo, items: items.filter((item) => item.grupo === grupo) }))
    .filter((g) => g.items.length > 0);

  const initial = (userName ?? userEmail ?? "?").charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className={`flex items-center gap-2.5 px-2 ${isMobile ? "py-3" : "py-2"}`}>
          <div
            className={`flex shrink-0 items-center justify-center rounded-md bg-sidebar-primary ${
              isMobile ? "size-9" : "size-7"
            }`}
          >
            <Code2
              className={
                isMobile
                  ? "size-5 text-sidebar-primary-foreground"
                  : "size-4 text-sidebar-primary-foreground"
              }
            />
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
        {grupos.map(({ grupo, items: itemsGrupo }) => (
          <SidebarGroup key={grupo}>
            <SidebarGroupLabel>{GRUPO_LABEL[grupo]}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className={isMobile ? "gap-1.5" : undefined}>
                {itemsGrupo.map((item) => (
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
                      className={`${ITEM_ACTIVE_CLASS} ${isMobile ? "gap-3 text-base [&_svg]:size-5" : ""}`}
                      onClick={() => isMobile && setOpenMobile(false)}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                        {!!counts?.[item.href] && (
                          <span className="ml-auto font-mono text-[11px] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
                            {counts[item.href]}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Antes solo en móvil (el logout de PC vivía en el dropdown de la
          topbar) -- el diseño lo quiere siempre presente, debajo de la
          última sección del menú, así que ahora se muestra en ambos. */}
      <SidebarFooter>
        <div
          className={`flex items-center gap-3 rounded-lg border border-sidebar-border px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:px-0 ${
            isMobile ? "py-2.5" : "py-2"
          }`}
        >
          <Avatar className={`shrink-0 ${isMobile ? "size-9" : "size-8"}`}>
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className={`truncate font-medium ${isMobile ? "text-sm" : "text-xs"}`}>{userName ?? "Usuario"}</p>
            <p className={`truncate text-sidebar-foreground/60 ${isMobile ? "text-xs" : "text-[11px]"}`}>{userEmail}</p>
          </div>
          {onSignOut && (
            <form action={onSignOut} className="group-data-[collapsible=icon]:hidden">
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className={`flex shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                  isMobile ? "size-9" : "size-8"
                }`}
              >
                <LogOut className={isMobile ? "size-5" : "size-4"} />
              </button>
            </form>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
