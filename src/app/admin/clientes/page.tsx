import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";
import { createCliente } from "@/app/admin/clientes/actions";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  const clientes = await prisma.cliente.findMany({
    where: query
      ? {
          OR: [
            { nombre: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { pais: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {clientes.length} cliente{clientes.length === 1 ? "" : "s"}
            {query ? ` encontrado${clientes.length === 1 ? "" : "s"} para "${query}"` : " registrado" + (clientes.length === 1 ? "" : "s")}
          </p>
        </div>
        <ClienteFormDialog
          trigger={
            <Button>
              <Plus />
              Nuevo cliente
            </Button>
          }
          title="Nuevo cliente"
          description="Registra un nuevo cliente en el sistema."
          action={createCliente}
          submitLabel="Crear cliente"
        />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-sm font-medium">Listado</CardTitle>
          <form className="max-w-xs">
            <Input
              type="search"
              name="q"
              placeholder="Buscar por nombre, email o país..."
              defaultValue={query ?? ""}
            />
          </form>
        </CardHeader>
        <CardContent>
          {clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {query
                ? "No se encontraron clientes con ese criterio."
                : "Aún no hay clientes registrados."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Captación</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="hover:underline"
                      >
                        {c.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {c.etiqueta ? (
                        <Badge variant="outline">{c.etiqueta}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{c.pais ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{c.medioCaptacion ?? "—"}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
