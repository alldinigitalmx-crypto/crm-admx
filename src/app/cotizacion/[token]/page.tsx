import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ThemedLogo } from "@/components/themed-logo";
import { FirmaForm } from "@/components/cotizaciones/firma-form";
import { PagoTransferenciaForm } from "@/components/cotizaciones/pago-transferencia-form";
import { MetodosPagoElectronicos } from "@/components/cotizaciones/metodos-pago-electronicos";
import { COTIZACION_STATUS_COLOR } from "@/lib/status-colors";
import { businessInfo } from "@/lib/business-info";
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
  moneda: { texto: "Mercado Pago solo acepta cotizaciones en pesos mexicanos. Usa PayPal u otro método.", tono: "warning" },
};

const PP_MENSAJE: Record<string, { texto: string; tono: "success" | "warning" | "error" }> = {
  success: { texto: "¡Pago con PayPal confirmado! Gracias.", tono: "success" },
  pending: { texto: "Tu pago con PayPal quedó pendiente de confirmación.", tono: "warning" },
  cancelado: { texto: "Cancelaste el pago con PayPal. Puedes intentarlo de nuevo cuando quieras.", tono: "warning" },
  error: { texto: "No pudimos completar el pago con PayPal. Intenta de nuevo en un momento.", tono: "error" },
  no_configurado: { texto: "El pago con PayPal no está disponible por ahora.", tono: "error" },
  sin_cliente: { texto: "Contáctanos para completar tu registro antes de poder cobrarte.", tono: "warning" },
  moneda: { texto: "PayPal no acepta cotizaciones en pesos colombianos. Usa transferencia bancaria.", tono: "warning" },
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
  // Mercado Pago solo cobra en MXN (ver mercadopago.ts) -- cualquier otra
  // moneda queda fuera. PayPal sí acepta MXN/USD/EUR, pero no COP.
  const mpBloqueadaPorMoneda = Boolean(cotizacion.moneda) && cotizacion.moneda !== "MXN";
  const paypalBloqueadoPorMoneda = cotizacion.moneda === "COP";

  const montoDescuento =
    cotizacion.descuentoTipo === "Porcentaje"
      ? Number(cotizacion.montoSubtotal) * (Number(cotizacion.descuentoValor ?? 0) / 100)
      : Number(cotizacion.descuentoValor ?? 0);

  const esPagable = cotizacion.status !== "Pagada" && cotizacion.status !== "Perdida";
  const progresoPct = Math.max(
    0,
    Math.min(100, Math.round((montoPagado / Number(cotizacion.montoTotal)) * 100))
  );

  const firmarAction = firmarCotizacion.bind(null, token);
  const pagoAction = reportarPagoTransferencia.bind(null, token);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-8 sm:py-12">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-6 border-b p-6 sm:p-8">
          <div className="flex flex-col gap-3">
            <ThemedLogo className="h-auto w-24 sm:w-28" />
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
              Cotización #{String(cotizacion.id).padStart(4, "0")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide uppercase ${
                vencida
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : (COTIZACION_STATUS_COLOR[cotizacion.status] ?? "bg-muted text-muted-foreground")
              }`}
            >
              {vencida ? "Vencida" : STATUS_LABEL[cotizacion.status]}
            </span>
            {cotizacion.fechaVencimiento && (
              <p className="font-mono text-[11px] text-muted-foreground">
                Vence {formatDate(cotizacion.fechaVencimiento)}
              </p>
            )}
          </div>
        </div>

        {/* Título / proyecto */}
        <div className="flex flex-col gap-2 border-b p-6 sm:p-8">
          <p className="font-mono text-[11px] tracking-widest text-blue-600 uppercase dark:text-blue-400">
            Para {nombreClienteCotizacion(cotizacion)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {descripcion}
          </h1>
          {detalles && (
            <p className="text-sm leading-relaxed text-muted-foreground">{detalles}</p>
          )}
        </div>

        {/* Total */}
        <div className="flex flex-col gap-4 bg-foreground p-6 text-background sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[11px] tracking-widest text-background/70 uppercase">
                Total {moneda ?? "MXN"}
              </p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                {formatCurrency(cotizacion.montoTotal, moneda)}
              </p>
            </div>
            {esPagable && cotizacion.clienteId && (
              <div className="flex flex-col items-end gap-1">
                <p className="font-mono text-[11px] tracking-widest text-background/70 uppercase">
                  A pagar ahora
                </p>
                <p className="font-mono text-lg font-semibold tabular-nums">
                  {formatCurrency(montoAhora, moneda)}
                </p>
                {esCobroPorPartes && (
                  <p className="font-mono text-[11px] text-background/60">
                    {esSegundoPago ? "Saldo restante" : `Anticipo ${cotizacion.porcentajeAnticipo}%`}
                  </p>
                )}
              </div>
            )}
          </div>
          {esPagable && cotizacion.clienteId && (
            <div className="h-1.5 overflow-hidden rounded-full bg-background/15">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] dark:bg-blue-500"
                style={{ width: `${progresoPct}%` }}
              />
            </div>
          )}
          {cotizacion.status === "Pagada" && (
            <p className="font-mono text-[11px] text-background/70">
              Pagada{cotizacion.fechaPago ? ` el ${formatDate(cotizacion.fechaPago)}` : ""}
            </p>
          )}
        </div>

        {/* Desglose */}
        <details className="group border-b">
          <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 font-mono text-[11px] tracking-widest text-muted-foreground uppercase marker:content-none sm:px-8">
            <span>Ver desglose</span>
            <span className="text-xs transition group-open:rotate-45">+</span>
          </summary>
          <div className="flex flex-col gap-3 px-6 pb-6 sm:px-8">
            <div className="flex justify-between gap-4 border-t pt-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{descripcion}</p>
                <p className="font-mono text-xs text-muted-foreground">1 × Servicio</p>
              </div>
              <p className="font-mono text-sm whitespace-nowrap tabular-nums">
                {formatCurrency(cotizacion.montoSubtotal, moneda)}
              </p>
            </div>
            <div className="flex justify-between border-t pt-3 font-mono text-[13px] text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(cotizacion.montoSubtotal, moneda)}</span>
            </div>
            {cotizacion.descuentoTipo && (
              <div className="flex justify-between border-t pt-3 font-mono text-[13px] text-muted-foreground">
                <span>
                  Descuento
                  {cotizacion.descuentoMotivo ? ` — ${cotizacion.descuentoMotivo}` : ""}
                </span>
                <span className="tabular-nums">−{formatCurrency(montoDescuento, moneda)}</span>
              </div>
            )}
            {montoPagado > 0 && cotizacion.status !== "Pagada" && (
              <>
                <div className="flex justify-between border-t pt-3 text-emerald-600 dark:text-emerald-400">
                  <span>Pagado</span>
                  <span className="tabular-nums">{formatCurrency(montoPagado, moneda)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Saldo pendiente</span>
                  <span className="tabular-nums">{formatCurrency(montoPendiente, moneda)}</span>
                </div>
              </>
            )}
          </div>
        </details>

        {[mensajeMp, mensajePp].filter(Boolean).length > 0 && (
          <div className="flex flex-col gap-2 border-b p-6 sm:px-8">
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
          </div>
        )}

        {/* Firmar */}
        {cotizacion.status === "Enviada" && (
          <div className="flex flex-col gap-4 border-b p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-widest text-blue-600 uppercase dark:text-blue-400">
              Firma de la cotización
            </p>
            <FirmaForm action={firmarAction} nombreDefault={nombreClienteCotizacion(cotizacion)} />
          </div>
        )}
        {cotizacion.status === "Firmada" && (
          <div className="border-b p-6 text-sm text-muted-foreground sm:p-8">
            Firmada por {cotizacion.firmanteNombre} el {formatDate(cotizacion.fechaFirma)}.
          </div>
        )}

        {/* Pagar */}
        {esPagable && (
          <div className="flex flex-col gap-4 border-b p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-widest text-blue-600 uppercase dark:text-blue-400">
              Pagar
            </p>
            {!cotizacion.clienteId ? (
              <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Estamos formalizando este proyecto. Muy pronto podrás pagar aquí.
              </p>
            ) : pagoPendiente ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                Ya reportaste un pago por transferencia. Está pendiente de confirmación.
              </p>
            ) : (
              <>
                <MetodosPagoElectronicos
                  token={token}
                  mercadoPagoDisponible={esMexico && !mpBloqueadaPorMoneda}
                  mercadoPagoNoDisponibleTexto={
                    mpBloqueadaPorMoneda ? `No disponible en ${moneda}` : "No disponible en tu país"
                  }
                  paypalDisponible={!paypalBloqueadoPorMoneda}
                  paypalNoDisponibleTexto="No disponible en COP"
                />

                <details className="group rounded-lg border open:bg-muted/20">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 font-mono text-xs tracking-wide text-muted-foreground uppercase marker:content-none">
                    ¿Prefieres transferencia, Spin o Binance?
                    <span className="text-xs text-muted-foreground transition group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <div className="border-t px-3 pt-3 pb-3">
                    <PagoTransferenciaForm action={pagoAction} montoAPagar={montoAhora} moneda={moneda} />
                  </div>
                </details>
              </>
            )}
          </div>
        )}
        {cotizacion.status === "Pagada" && (
          <div className="border-b p-6 text-sm text-emerald-600 sm:p-8 dark:text-emerald-400">
            Esta cotización ya fue pagada
            {cotizacion.fechaPago ? ` el ${formatDate(cotizacion.fechaPago)}` : ""}. ¡Gracias!
          </div>
        )}

        {/* Documento + pie */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-8">
          <Button variant="outline" size="sm" asChild>
            <a href={`/cotizacion/${token}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileDown />
              Descargar PDF
            </a>
          </Button>
          <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
            <span>
              {businessInfo.nombre} · {businessInfo.eslogan}
            </span>
            <a href={businessInfo.whatsappLink} className="hover:text-foreground">
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
