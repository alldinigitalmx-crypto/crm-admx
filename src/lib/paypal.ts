// Integración con PayPal (Orders API v2) por REST directo — mismo criterio que
// mercadopago.ts: sin el SDK oficial, solo las llamadas que necesitamos.
// A diferencia de Mercado Pago, PayPal no distingue sandbox/producción por el
// formato de las llaves, así que el modo se controla con PAYPAL_ENV.

const PAYPAL_API_SANDBOX = "https://api-m.sandbox.paypal.com";
const PAYPAL_API_LIVE = "https://api-m.paypal.com";

export function paypalConfigurado() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalEsPrueba() {
  return process.env.PAYPAL_ENV !== "live";
}

function paypalApiUrl() {
  return paypalEsPrueba() ? PAYPAL_API_SANDBOX : PAYPAL_API_LIVE;
}

async function obtenerTokenPaypal(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error("PayPal no está configurado (falta PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET).");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${paypalApiUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`PayPal rechazó la autenticación (${res.status}): ${detalle}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

type OrdenPaypal = {
  id: string;
  links: { href: string; rel: string; method: string }[];
};

export async function crearOrdenPaypal(params: {
  titulo: string;
  monto: number;
  externalReference: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; approveUrl: string }> {
  const token = await obtenerTokenPaypal();

  const res = await fetch(`${paypalApiUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.externalReference,
          description: params.titulo.slice(0, 127),
          amount: {
            currency_code: "MXN",
            value: params.monto.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`PayPal rechazó la orden (${res.status}): ${detalle}`);
  }

  const orden: OrdenPaypal = await res.json();
  const approveUrl = orden.links.find((l) => l.rel === "approve")?.href;
  if (!approveUrl) throw new Error("PayPal no devolvió un link de aprobación.");

  return { id: orden.id, approveUrl };
}

export type CapturaPaypal = {
  id: string;
  status: string;
  purchase_units: {
    reference_id: string;
    payments?: {
      captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[];
    };
  }[];
};

export async function capturarOrdenPaypal(orderId: string): Promise<CapturaPaypal> {
  const token = await obtenerTokenPaypal();

  const res = await fetch(`${paypalApiUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok && data?.name !== "UNPROCESSABLE_ENTITY") {
    throw new Error(`PayPal rechazó la captura (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}
