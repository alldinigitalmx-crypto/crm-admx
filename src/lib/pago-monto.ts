// Los reportes (Reportes, Excel, PDF) y los totales agregados del negocio
// siempre están en pesos mexicanos -- un pago en USD o COP no se puede
// sumar en crudo junto con uno en MXN, o el total sale mal (ej. $450 USD
// contando como $450 MXN). Este helper es la única fuente de verdad para
// "¿cuánto vale este pago en pesos?".
type DecimalLike = number | string | { toString(): string };

export type PagoParaMXN = {
  monto: DecimalLike;
  moneda?: string | null;
  montoMXN?: DecimalLike | null;
};

export function montoEnMXN(pago: PagoParaMXN): number {
  if (pago.moneda && pago.moneda !== "MXN") {
    // Si el pago es en otra moneda pero nunca se capturó su equivalente
    // en pesos (dato histórico, de antes de que existiera este campo),
    // no hay forma de convertirlo bien -- se usa el monto crudo como
    // antes, que sigue siendo mejor que perder el pago del total.
    return pago.montoMXN != null ? Number(pago.montoMXN) : Number(pago.monto);
  }
  return Number(pago.monto);
}

export type PagoParaNeto = PagoParaMXN & {
  comision?: DecimalLike | null;
  montoIncluyeComision?: boolean;
};

// Cuánto ingresó de verdad de este pago, en pesos -- para reportes,
// paneles y cualquier cosa que responda "cuánto gané", a diferencia de
// montoEnMXN() que es "cuánto pagó el cliente" (eso sigue sirviendo para
// saber si un servicio/cotización ya quedó saldado, sin tocar).
//
// montoIncluyeComision distingue dos convenciones de captura: en pagos
// nuevos, "monto" es el bruto que cobró la pasarela y hay que restarle la
// comisión; en pagos viejos, "monto" ya era lo que realmente llegó (la
// comisión ahí es solo informativa) y restarla de nuevo lo contaría dos
// veces -- por eso NUNCA se resta si el campo viene en false.
export function montoNetoEnMXN(pago: PagoParaNeto): number {
  const bruto = montoEnMXN(pago);
  if (!pago.montoIncluyeComision || !pago.comision) return bruto;

  const montoOriginal = Number(pago.monto);
  // La comisión se cobra en la misma moneda del pago -- se escala con la
  // misma tasa implícita que ya se usó para convertir el monto a MXN
  // (bruto / montoOriginal), en vez de asumir que ya viene en pesos.
  const factor = montoOriginal !== 0 ? bruto / montoOriginal : 1;
  return bruto - Number(pago.comision) * factor;
}
