import { NextResponse } from "next/server";

import { currentUsuario } from "@/lib/current-usuario";

// Proxy a Frankfurter (frankfurter.dev, gratis, sin llave, tipos de cambio
// de referencia del Banco Central Europeo) para sugerir el equivalente en
// pesos de un pago en USD/EUR -- NO es el tipo de cambio exacto que PayPal
// le aplicó a la cuenta del dueño (eso solo lo sabe PayPal, y depende de
// su propio margen), así que esto es un punto de partida editable, no el
// dato final. Frankfurter no cubre COP, así que este helper no aplica ahí
// (ver pago-form.tsx).
const MONEDAS_SOPORTADAS = ["USD", "EUR"];

export async function GET(request: Request) {
  const usuario = await currentUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const monto = Number(searchParams.get("monto") ?? "0");

  if (!from || !MONEDAS_SOPORTADAS.includes(from) || !monto || monto <= 0) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?amount=${monto}&from=${from}&to=MXN`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("bad status");
    const data = (await res.json()) as { date?: string; rates?: { MXN?: number } };
    const mxn = data.rates?.MXN;
    if (typeof mxn !== "number") throw new Error("no rate");

    return NextResponse.json({ mxn, rate: mxn / monto, fecha: data.date ?? null });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener el tipo de cambio de hoy. Captúralo a mano." },
      { status: 502 }
    );
  }
}
