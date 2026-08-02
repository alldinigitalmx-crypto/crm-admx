"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

export type VentaDetalle = {
  id: number;
  fecha: Date;
  origen: string;
  canal: string | null;
  nombreComprador: string | null;
  emailComprador: string | null;
  metodoPago: string | null;
  total: number;
  tipoEntrega: string;
  referidoPor: { nombre: string } | null;
  comisionReferido: number | null;
  detalles: { productoNombre: string; cantidad: number; precioUnitario: number; subtotal: number }[];
};

export function VentaDetalleDialog({ venta }: { venta: VentaDetalle }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="size-7">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Venta #{String(venta.id).padStart(4, "0")}</DialogTitle>
          <DialogDescription>
            {venta.nombreComprador ?? "Comprador sin nombre"}
            {venta.emailComprador ? ` — ${venta.emailComprador}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p>{formatDate(venta.fecha)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Origen</p>
              <Badge variant={venta.origen === "TiendaOnline" ? "default" : "outline"}>
                {venta.origen === "TiendaOnline" ? "Tienda Online" : "Manual"}
              </Badge>
            </div>
            {venta.canal && (
              <div>
                <p className="text-muted-foreground">Canal</p>
                <p>{venta.canal}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Método de pago</p>
              <p>{venta.metodoPago ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Entrega</p>
              <p>{venta.tipoEntrega === "Inmediata" ? "Inmediata" : "Largo plazo"}</p>
            </div>
            {venta.referidoPor && (
              <div>
                <p className="text-muted-foreground">Referido por</p>
                <p>
                  {venta.referidoPor.nombre}
                  {venta.comisionReferido ? ` (${formatCurrency(venta.comisionReferido)})` : ""}
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-muted-foreground">Productos</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">P. unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venta.detalles.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.productoNombre}</TableCell>
                    <TableCell className="text-right">{d.cantidad}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.precioUnitario)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-2 flex justify-end border-t pt-2 text-base font-semibold">
              Total: {formatCurrency(venta.total)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
