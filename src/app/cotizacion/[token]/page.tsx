import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FirmaForm } from "@/components/cotizaciones/firma-form";
import { PagoTransferenciaForm } from "@/components/cotizaciones/pago-transferencia-form";
import { MetodosPagoElectronicos } from "@/components/cotizaciones/metodos-pago-electronicos";
import {
  firmarCotizacion,
  reportarPagoTransferencia,
} from "@/app/admin/cotizaciones/actions";
import {
  nombreClienteCotizacion,
  montoAPagarAhora,
  montoPagadoCotizacion,
  montoPendienteCotizacion,
} from "@/lib/cotizacion";
import { esVisitanteDeMexico } from "@/lib/geo";

const STATUS_LABEL: Record<string, string> = {
  Enviada: "Enviada",
  Firmada: "Firmada",
  Pagada: "Pagada",
  Vencida: "Vencida",
  Perdida: "Perdida",
};

const MP_MENSAJE: Record<string, { texto: string; tono: "success" | "warning" | "error" }> = {
  success: { texto: "¡Pago recibido! En cuanto Mercado Pago lo confirme, actualizaremos el estatus.", tono: "success" },
  pending: { texto: "Tu pago quedó pendiente de confirmación en Mercado Pago.", tono: "warning" },
  failure: { texto: "El pago no se completó. Puedes intentarlo de nuevo.", tono: "error" },
  error: { texto: "No pudimos iniciar el pago con Mercado Pago. Intenta de nuevo en un momento.", tono: "error" },
  no_configurado: { texto: "El pago con Mercado Pago no está disponible por ahora.", tono: "error" },
  sin_cliente: { texto: "Contáctanos para completar tu registro antes de poder cobrarte.", tono: "warning" },
  pais: { texto: "Mercado Pago no está disponible en tu país. Usa PayPal u otro método.", tono: "warning" },
  moneda: { texto: "Mercado Pago no acepta cotizaciones en USD. Usa PayPal.", tono: "warning" },
};

const PP_MENSAJE: Record<string, { texto: string; tono: "success" | "warning" | "error" }> = {
  success: { texto: "¡Pago con PayPal confirmado! Gracias.", tono: "success" },
  pending: { texto: "Tu pago con PayPal quedó pendiente de confirmación.", tono: "warning" },
  cancelado: { texto: "Cancelaste el pago con PayPal. Puedes intentarlo de nuevo cuando quieras.", tono: "warning" },
  error: { texto: "No pudimos completar el pago con PayPal. Intenta de nuevo en un momento.", tono: "error" },
  no_configurado: { texto: "El pago con PayPal no está disponible por ahora.", tono: "error" },
  sin_cliente: { texto: "Contáctanos para completar tu registro antes de poder cobrarte.", tono: "warning" },
};

export default async function CotizacionPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mp?: string; pp?: string }>;
}) {
  const { token } = await params;
  const { mp, pp } = await searchParams;
  const mensajeMp = mp ? MP_MENSAJE[mp] : undefined;
  const mensajePp = pp ? PP_MENSAJE[pp] : undefined;
  const esMexico = await esVisitanteDeMexico();

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { token },
    include: {
      cliente: true,
      servicio: true,
      pagos: { orderBy: { fecha: "desc" } },
    },
  });

  if (!cotizacion) notFound();

  const descripcion = cotizacion.servicio?.descripcion ?? cotizacion.descripcion ?? "";
  const detalles = cotizacion.servicio?.detalles ?? cotizacion.detalles;

  const vencida =
    cotizacion.status !== "Pagada" &&
    !!cotizacion.fechaVencimiento &&
    cotizacion.fechaVencimiento < new Date();

  const pagoPendiente = cotizacion.pagos.find((p) => !p.confirmado);
  const montoPagado = montoPagadoCotizacion(cotizacion, cotizacion.pagos);
  const montoPendiente = montoPendienteCotizacion(cotizacion, cotizacion.pagos);
  const montoAhora = montoAPagarAhora(cotizacion, cotizacion.pagos);
  const esSegundoPago = montoPagado > 0;
  const esCobroPorPartes = Boolean(cotizacion.porcentajeAnticipo);
  const moneda = cotizacion.moneda ?? undefined;
  const esUSD = cotizacion.moneda === "USD";

  const montoDescuento =
    cotizacion.descuentoTipo === "Porcentaje"
      ? Number(cotizacion.montoSubtotal) * (Number(cotizacion.descuentoValor ?? 0) / 100)
      : Number(cotizacion.descuentoValor ?? 0);

  const firmarAction = firmarCotizacion.bind(null, token);
  const pagoAction = reportarPagoTransferencia.bind(null, token);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm font-semibold tracking-wide text-primary">
          ADMX DEV
        </p>
        <h1 className="text-2xl font-semibold">
          Cotización #{String(cotizacion.id).padStart(4, "0")}
        </h1>
        <p className="text-sm text-muted-foreground">Para {nombreClienteCotizacion(cotizacion)}</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">{descripcion}</CardTitle>
          <Badge
            variant={
              cotizacion.status === "Pagada"
                ? "secondary"
                : vencida || cotizacion.status === "Perdida"
                  ? "destructive"
                  : "outline"
            }
          >
            {vencida ? "Vencida" : STATUS_LABEL[cotizacion.status]}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {detalles && <p className="text-muted-foreground">{detalles}</p>}
          <div className="flex justify-between border-t pt-3">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(cotizacion.montoSubtotal, moneda)}</span>
          </div>
          {cotizacion.descuentoTipo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Descuento
                {cotizacion.descuentoMotivo ? ` — ${cotizacion.descuentoMotivo}` : ""}
              </span>
              <span>-{formatCurrency(montoDescuento, moneda)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(cotizacion.montoTotal, moneda)}</span>
          </div>
          {montoPagado > 0 && cotizacion.status !== "Pagada" && (
            <>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Pagado</span>
                <span>{formatCurrency(montoPagado, moneda)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Saldo pendiente</span>
                <span>{formatCurrency(montoPendiente, moneda)}</span>
              </div>
            </>
          )}
          {esCobroPorPartes && montoPagado === 0 && cotizacion.status !== "Pagada" && (
            <p className="rounded-lg border border-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Este proyecto se cobra en dos partes: {cotizacion.porcentajeAnticipo}% de anticipo
              ({formatCurrency(montoAhora, moneda)}) y el resto al terminar.
            </p>
          )}
          {cotizacion.fechaVencimiento && (
            <p className="text-xs text-muted-foreground">
              Vence: {formatDate(cotizacion.fechaVencimiento)}
            </p>
          )}
          <Button variant="outline" size="sm" asChild className="mt-2 self-start">
            <a href={`/cotizacion/${token}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileDown />
              Descargar PDF
            </a>
          </Button>
        </CardContent>
      </Card>

      {cotizacion.status === "Enviada" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Firma de la cotización</CardTitle>
          </CardHeader>
          <CardContent>
            <FirmaForm action={firmarAction} nombreDefault={nombreClienteCotizacion(cotizacion)} />
          </CardContent>
        </Card>
      )}

      {cotizacion.status === "Firmada" && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Firmada por {cotizacion.firmanteNombre} el {formatDate(cotizacion.fechaFirma)}.
          </CardContent>
        </Card>
      )}

      {[mensajeMp, mensajePp].filter(Boolean).map((mensaje, i) => (
        <p
          key={i}
          className={
            "rounded-lg border px-3 py-2 text-sm " +
            (mensaje!.tono === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : mensaje!.tono === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-destructive/30 bg-destructive/10 text-destructive")
          }
        >
          {mensaje!.texto}
        </p>
      ))}

      {cotizacion.status !== "Pagada" && cotizacion.status !== "Perdida" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pagar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!cotizacion.clienteId ? (
              <p className="rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Estamos formalizando este proyecto. Muy pronto podrás pagar aquí.
              </p>
            ) : pagoPendiente ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                Ya reportaste un pago por transferencia. Está pendiente de confirmación.
              </p>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground">
                  {esCobroPorPartes && !esSegundoPago
                    ? `Paga tu anticipo (${cotizacion.porcentajeAnticipo}%) — ${formatCurrency(montoAhora, moneda)}`
                    : esSegundoPago
                      ? `Paga el saldo restante — ${formatCurrency(montoAhora, moneda)}`
                      : "Paga en línea al instante"}
                </p>
                <MetodosPagoElectronicos
                  token={token}
                  mercadoPagoDisponible={esMexico && !esUSD}
                  mercadoPagoNoDisponibleTexto={esUSD ? "No disponible en USD" : "No disponible en tu país"}
                  paypalDisponible
                />

                <details className="group rounded-lg border border-input open:bg-muted/20">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium text-muted-foreground marker:content-none">
                    ¿Prefieres transferencia, Spin o Binance?
                    <span className="text-xs text-muted-foreground transition group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <div className="border-t border-input px-3 pb-3 pt-3">
                    <PagoTransferenciaForm action={pagoAction} montoAPagar={montoAhora} moneda={moneda} />
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {cotizacion.status === "Pagada" && (
        <Card>
          <CardContent className="py-4 text-sm text-emerald-600 dark:text-emerald-400">
            Esta cotización ya fue pagada
            {cotizacion.fechaPago ? ` el ${formatDate(cotizacion.fechaPago)}` : ""}. ¡Gracias!
          </CardContent>
        </Card>
      )}
    </div>
  );
}
