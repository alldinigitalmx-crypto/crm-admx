// Botones de pago electrónico con el estilo de marca de cada pasarela —
// íconos oficiales (descargados del propio CDN de cada marca, en
// public/mercadopago-icon.svg y public/paypal-icon.png) para que se vean
// como el botón real de "Pagar con X" y transmitan confianza, no un ícono
// genérico inventado.

function IconoMercadoPago() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/mercadopago-icon.svg" alt="" className="size-5 shrink-0" aria-hidden="true" />;
}

function IconoPaypal() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/paypal-icon.png" alt="" className="size-5 shrink-0" aria-hidden="true" />;
}

function BotonPago({
  href,
  disponible,
  label,
  style,
  icono,
}: {
  href: string;
  disponible: boolean;
  label: string;
  style: React.CSSProperties;
  icono: React.ReactNode;
}) {
  if (!disponible) {
    return (
      <div
        className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-input bg-muted/30 px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-60"
        aria-disabled
      >
        {icono}
        {label}
      </div>
    );
  }

  return (
    <a
      href={href}
      style={style}
      className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-105 active:brightness-95"
    >
      {icono}
      {label}
    </a>
  );
}

export function MetodosPagoElectronicos({
  token,
  mercadoPagoDisponible,
  paypalDisponible,
}: {
  token: string;
  mercadoPagoDisponible: boolean;
  paypalDisponible: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <BotonPago
        href={`/cotizacion/${token}/pagar-mercadopago`}
        disponible={mercadoPagoDisponible}
        label="Mercado Pago"
        style={{ backgroundColor: "#00b1ea", color: "#ffffff" }}
        icono={<IconoMercadoPago />}
      />
      <BotonPago
        href={`/cotizacion/${token}/pagar-paypal`}
        disponible={paypalDisponible}
        label="PayPal"
        style={{ backgroundColor: "#ffc439", color: "#003087" }}
        icono={<IconoPaypal />}
      />
    </div>
  );
}
