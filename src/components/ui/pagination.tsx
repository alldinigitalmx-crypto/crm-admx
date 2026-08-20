import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Prev/Next + "Página X de Y", preservando los filtros ya aplicados en la
 * URL — cada lista pasa `buildHref` para armar el query string con su
 * propio conjunto de filtros más el número de página. */
export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  buildHref,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <p className="text-xs text-muted-foreground">
        {desde}–{hasta} de {totalCount}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
          {page > 1 ? (
            <Link href={buildHref(page - 1)}>
              <ChevronLeft />
              Anterior
            </Link>
          ) : (
            <>
              <ChevronLeft />
              Anterior
            </>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
          {page < totalPages ? (
            <Link href={buildHref(page + 1)}>
              Siguiente
              <ChevronRight />
            </Link>
          ) : (
            <>
              Siguiente
              <ChevronRight />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
