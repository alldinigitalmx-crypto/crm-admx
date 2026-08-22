// Integración con Mercado Pago (Checkout Pro) por REST directo — sin el SDK
// oficial, para no sumar una dependencia grande cuando son solo 2 llamadas.
// El Access Token decide el modo: uno que empieza con "TEST-" es de prueba
// (usa sandbox_init_point); uno real usa init_point — así no hace falta
// una variable de entorno aparte para saber en qué modo estamos.

const MP_API = "https://api.mercadopago.com";

export function mercadoPagoConfigurado() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

export function mercadoPagoEsPrueba() {
  return (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").startsWith("TEST-");
}

type Preferencia = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
};

export async function crearPreferenciaMercadoPago(params: {
  titulo: string;
  monto: number;
  externalReference: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
}): Promise<Preferencia> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago no está configurado (falta MERCADOPAGO_ACCESS_TOKEN).");

  // Mercado Pago exige que back_urls sean HTTPS para poder usar auto_return
  // (si no, rechaza la preferencia con "back_url.success must be defined").
  // En producción (Vercel) siempre es https; esto solo se omite en pruebas
  // locales sobre http://localhost.
  const esHttps = params.successUrl.startsWith("https://");

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: [
        {
          title: params.titulo,
          quantity: 1,
          currency_id: "MXN",
          unit_price: params.monto,
        },
      ],
      external_reference: params.externalReference,
      back_urls: {
        success: params.successUrl,
        failure: params.failureUrl,
        pending: params.pendingUrl,
      },
      ...(esHttps ? { auto_return: "approved" } : {}),
      notification_url: params.notificationUrl,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Mercado Pago rechazó la preferencia (${res.status}): ${detalle}`);
  }

  return res.json();
}

export type PagoMercadoPago = {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  external_reference: string | null;
};

export async function obtenerPagoMercadoPago(paymentId: string): Promise<PagoMercadoPago> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago no está configurado (falta MERCADOPAGO_ACCESS_TOKEN).");

  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`No se pudo consultar el pago ${paymentId} en Mercado Pago (${res.status}).`);
  }
  return res.json();
}
