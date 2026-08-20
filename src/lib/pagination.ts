// Tamaño de página compartido por las listas grandes (Clientes, Servicios,
// Cotizaciones, Pagos) — el resto de los módulos todavía tiene pocos
// registros y no lo necesita.
export const PAGE_SIZE = 25;

export function parsePage(pageParam: string | undefined): number {
  const n = Number(pageParam);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function paginationSkip(page: number): number {
  return (page - 1) * PAGE_SIZE;
}

export function totalPages(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE));
}
