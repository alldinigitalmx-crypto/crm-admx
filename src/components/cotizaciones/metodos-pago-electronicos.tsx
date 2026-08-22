// Botones de pago electrónico con el estilo de marca de cada pasarela
// (colores y wordmark propios, no genéricos) para que se sientan como el
// botón real de "Pagar con X" en vez de un botón outline cualquiera.

function IconoMercadoPago() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#fff" />
      <path
        d="M7 13c0 2.8 2.2 5 5 5s5-2.2 5-5"
        stroke="#00b1ea"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="8.3" cy="10.5" r="1.1" fill="#00b1ea" />
      <circle cx="15.7" cy="10.5" r="1.1" fill="#00b1ea" />
    </svg>
  );
}

function IconoPaypal() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M8 5h5.6c2.6 0 4.2 1.5 3.8 3.9-.5 3-2.6 4.5-5.6 4.5H9.6l-.9 5.6H5.5L8 5Z"
        fill="#003087"
      />
      <path
        d="M9.8 8.4h5.1c2.2 0 3.5 1.3 3.2 3.4-.4 2.6-2.3 3.9-4.8 3.9h-2.3l-.8 5.1H7.3l2.5-12.4Z"
        fill="#009cde"
      />
    </svg>
  );
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
