import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ChevronRight, Download, Search, X } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";
import { ClienteMobileCard } from "@/components/clientes/cliente-mobile-card";
import { createCliente } from "@/app/admin/clientes/actions";
import { CLIENTE_ETIQUETA_COLOR as ETIQUETA_COLOR } from "@/lib/status-colors";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { construirMetricasClientes, metricaVacia } from "@/lib/cliente-metricas";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/pagination";
import type { Etiqueta, Prisma, StatusServicio } from "@/generated/prisma/client";

const ETIQUETAS = ["VIP", "Premium", "Platinum", "Prospecto"];
const STATUS_SERVICIO_ACTIVO: StatusServicio[] = ["Aprobado", "EnProceso"];
const SESENTA_DIAS_MS = 60 * 24 * 60 * 60 * 1000;

const pillClass =
  "h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const AVATAR_DEFAULT = "bg-primary/10 text-primary";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    etiqueta?: string;
    pais?: string;
    desde?: string;
    hasta?: string;
    saldo?: string;
    page?: string;
  }>;
}) {
  const { q, etiqueta, pais, desde, hasta, saldo, page: pageParam } = await searchParams;
  const query = q?.trim();
  const soloConSaldo = saldo === "1";
  const page = parsePage(pageParam);

  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Clientes");
  if (!permisos.puedeVer) redirect("/admin");

  const where: Prisma.ClienteWhereInput = {};
  if (query) {
    where.OR = [
      { nombre: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { pais: { contains: query, mode: "insensitive" } },
    ];
  }
  if (etiqueta === "ninguna") {
    where.etiqueta = null;
  } else if (etiqueta) {
    where.etiqueta = etiqueta as Etiqueta;
  }
  if (pais) where.pais = pais;
  if (desde || hasta) {
    where.creadoEn = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  // Las métricas (facturado, saldo, última actividad) no son columnas de
  // Cliente -- salen de un solo query de Servicio (y uno de Queja) sobre
  // TODA la base, y de ahí se derivan tanto los KPIs del encabezado (que
  // son del negocio completo, sin filtrar) como las columnas por fila y el
  // orden por última actividad. Ver src/lib/cliente-metricas.ts.
  const [clientesFiltrados, clientesBase, carteraActivaCount, serviciosAgg, quejasAgg, paisesDisponibles] =
    await Promise.all([
      prisma.cliente.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          etiqueta: true,
          pais: true,
          email: true,
          telefono: true,
          medioCaptacion: true,
          creadoEn: true,
        },
      }),
      prisma.cliente.findMany({ select: { id: true, creadoEn: true } }),
      prisma.cliente.count({
        where: { servicios: { some: { status: { in: STATUS_SERVICIO_ACTIVO } } } },
      }),
      prisma.servicio.findMany({
        select: {
          clienteId: true,
          status: true,
          fechaInicio: true,
          actualizadoEn: true,
          montoInicial: true,
          montoInicialMXN: true,
          moneda: true,
          ordenesCambio: { select: { status: true, monto: true } },
          pagos: {
            select: { monto: true, moneda: true, montoMXN: true, confirmado: true, fecha: true },
          },
        },
      }),
      prisma.queja.findMany({ select: { clienteId: true, creadoEn: true } }),
      prisma.cliente.findMany({
        where: { pais: { not: null } },
        select: { pais: true },
        distinct: ["pais"],
        orderBy: { pais: "asc" },
      }),
    ]);

  const metricas = construirMetricasClientes(clientesBase, serviciosAgg, quejasAgg);

  const totalClientesGlobal = clientesBase.length;
  const nuevosEsteMes = clientesBase.filter((c) => c.creadoEn >= inicioMes).length;
  const facturadoAnioGlobal = [...metricas.values()].reduce((acc, m) => acc + m.facturadoAnioActual, 0);
  const saldoPorCobrarGlobal = [...metricas.values()].reduce((acc, m) => acc + m.saldo, 0);
  const cutoff60 = new Date();
  cutoff60.setTime(cutoff60.getTime() - SESENTA_DIAS_MS);
  const sinActividad60d = [...metricas.values()].filter((m) => m.ultimaActividad < cutoff60).length;

  const hasFiltros = Boolean(query || etiqueta || pais || desde || hasta || soloConSaldo);

  let resultado = clientesFiltrados;
  if (soloConSaldo) {
    resultado = resultado.filter((c) => (metricas.get(c.id)?.saldo ?? 0) > 0);
  }
  resultado = [...resultado].sort((a, b) => {
    const fa = metricas.get(a.id)?.ultimaActividad ?? a.creadoEn;
    const fb = metricas.get(b.id)?.ultimaActividad ?? b.creadoEn;
    return fb.getTime() - fa.getTime();
  });

  const totalCount = resultado.length;
  const paginas = totalPages(totalCount);
  const clientes = resultado.slice(paginationSkip(page), paginationSkip(page) + PAGE_SIZE);

  function paramsActuales() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (etiqueta) params.set("etiqueta", etiqueta);
    if (pais) params.set("pais", pais);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (soloConSaldo) params.set("saldo", "1");
    return params;
  }

  function buildHref(targetPage: number) {
    const params = paramsActuales();
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/clientes?${qs}` : "/admin/clientes";
  }

  const toggleSaldoHref = (() => {
    const params = paramsActuales();
    if (soloConSaldo) params.delete("saldo");
    else params.set("saldo", "1");
    const qs = params.toString();
    return qs ? `/admin/clientes?${qs}` : "/admin/clientes";
  })();

  const exportParams = paramsActuales();

  const verTodo = permisos.verTodo;
  let clientesPropios: Set<number> | null = null;
  if (!verTodo && usuario) {
    const servicios = await prisma.servicio.findMany({
      where: { responsableId: usuario.id },
      select: { clienteId: true },
    });
    clientesPropios = new Set(servicios.map((s) => s.clienteId));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ================= HERO + KPIs ================= */}
      <div className="overflow-hidden rounded-xl bg-[linear-gradient(103deg,oklch(0.24_0.045_264)_0%,oklch(0.3_0.07_268)_100%)] text-white">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Clientes</h1>
            <p className="mt-0.5 text-sm text-white/70">
              {totalClientesGlobal} cliente{totalClientesGlobal === 1 ? "" : "s"} registrado
              {totalClientesGlobal === 1 ? "" : "s"} · {nuevosEsteMes} nuevo{nuevosEsteMes === 1 ? "" : "s"} este mes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" asChild>
              <a href={`/admin/clientes/export?${exportParams.toString()}`}>
                <Download />
                Exportar Excel
              </a>
            </Button>
            {permisos.puedeCrear && (
              <ClienteFormDialog
                trigger={
                  <Button className="bg-white text-[oklch(0.24_0.045_264)] hover:bg-white/90">
                    <Plus />
                    Nuevo cliente
                  </Button>
                }
                title="Nuevo cliente"
                description="Registra un nuevo cliente en el sistema."
                action={createCliente}
                submitLabel="Crear cliente"
              />
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
          <div className="min-w-0 bg-[oklch(0.26_0.05_264)] px-4 py-2.5">
            <p className="text-[10.5px] font-semibold tracking-wide text-white/65 uppercase">Cartera activa</p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-xl">{carteraActivaCount}</p>
          </div>
          <div className="min-w-0 bg-[oklch(0.26_0.05_264)] px-4 py-2.5">
            <p className="text-[10.5px] font-semibold tracking-wide text-white/65 uppercase">Facturado (año)</p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-xl">
              {formatCurrency(facturadoAnioGlobal)}
            </p>
          </div>
          <div className="min-w-0 bg-[oklch(0.26_0.05_264)] px-4 py-2.5">
            <p className="text-[10.5px] font-semibold tracking-wide text-white/65 uppercase">Saldo por cobrar</p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-warning sm:text-xl">
              {formatCurrency(saldoPorCobrarGlobal)}
            </p>
          </div>
          <div className="min-w-0 bg-[oklch(0.26_0.05_264)] px-4 py-2.5">
            <p className="text-[10.5px] font-semibold tracking-wide text-white/65 uppercase">Sin actividad +60d</p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-xl">{sinActividad60d}</p>
          </div>
        </div>
      </div>

      {/* ================= FILTROS ================= */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <form className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-input bg-background px-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              name="q"
              placeholder="Buscar por nombre, email o país…"
              defaultValue={query ?? ""}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <select name="etiqueta" defaultValue={etiqueta ?? ""} className={pillClass}>
            <option value="">Etiqueta: todas</option>
            {ETIQUETAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
            <option value="ninguna">Sin etiqueta</option>
          </select>
          <select name="pais" defaultValue={pais ?? ""} className={pillClass}>
            <option value="">País: todos</option>
            {paisesDisponibles.map((p) => (
              <option key={p.pais} value={p.pais!}>
                {p.pais}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="desde"
            defaultValue={desde ?? ""}
            aria-label="Alta desde"
            className={pillClass}
          />
          <input
            type="date"
            name="hasta"
            defaultValue={hasta ?? ""}
            aria-label="Alta hasta"
            className={pillClass}
          />
          <Button type="submit" size="sm">
            Filtrar
          </Button>

          <span className="h-6 w-px bg-border" />

          <Button variant="outline" size="sm" className={soloConSaldo ? "border-accent-foreground/20 bg-accent text-accent-foreground" : ""} asChild>
            <Link href={toggleSaldoHref}>
              Con saldo
              {soloConSaldo && <X className="size-3.5" />}
            </Link>
          </Button>

          {hasFiltros && (
            <Button type="button" size="sm" variant="ghost" className="text-primary" asChild>
              <Link href="/admin/clientes">Limpiar</Link>
            </Button>
          )}
        </form>
      </div>

      {clientes.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {hasFiltros ? "No hay clientes con esos filtros." : "Aún no hay clientes registrados."}
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between px-1">
            <p className="text-sm text-muted-foreground">
              <b className="font-semibold text-foreground tabular-nums">{totalCount}</b> resultado
              {totalCount === 1 ? "" : "s"}
              {hasFiltros ? " con estos filtros" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Ordenar por <b className="font-semibold text-foreground">Última actividad</b>
            </p>
          </div>

          {/* Escritorio: tabla densa */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead className="text-right">Serv.</TableHead>
                  <TableHead className="text-right">Facturado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => {
                  const esPropio = !clientesPropios || clientesPropios.has(c.id);
                  const inicialFila = c.nombre.trim().charAt(0).toUpperCase() || "?";
                  const colorFila = c.etiqueta ? ETIQUETA_COLOR[c.etiqueta] : undefined;
                  const m = metricas.get(c.id) ?? metricaVacia();
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className="flex items-center gap-2.5 hover:underline"
                        >
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorFila ?? AVATAR_DEFAULT}`}
                          >
                            {inicialFila}
                          </span>
                          {c.nombre}
                        </Link>
                        {esPropio && c.email && (
                          <p className="ml-9.5 truncate text-xs text-muted-foreground">{c.email}</p>
                        )}
                      </TableCell>
                      {esPropio ? (
                        <>
                          <TableCell>
                            {c.etiqueta ? (
                              <Badge variant="outline">{c.etiqueta}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{c.pais ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{m.serviciosActivosCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(m.facturado)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {m.saldo > 0 ? (
                              <span className="text-destructive">{formatCurrency(m.saldo)}</span>
                            ) : (
                              <span className="text-muted-foreground font-normal">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatRelativeDate(m.ultimaActividad)}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell colSpan={6} className="text-muted-foreground">
                          No tienes servicios asignados de este cliente
                        </TableCell>
                      )}
                      <TableCell>
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Ver detalle de ${c.nombre}`}
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Móvil: tarjetas ricas */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {clientes.map((c) => {
              const esPropio = !clientesPropios || clientesPropios.has(c.id);
              const m = metricas.get(c.id) ?? metricaVacia();
              return (
                <ClienteMobileCard
                  key={c.id}
                  cliente={c}
                  esPropio={esPropio}
                  serviciosActivos={m.serviciosActivosCount}
                  facturado={m.facturado}
                  saldo={m.saldo}
                  ultimaActividad={m.ultimaActividad}
                />
              );
            })}
          </div>

          {paginas > 1 && (
            <div className="rounded-xl border border-border bg-card px-4 pb-3 shadow-sm">
              <Pagination
                page={page}
                totalPages={paginas}
                totalCount={totalCount}
                pageSize={PAGE_SIZE}
                buildHref={buildHref}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
