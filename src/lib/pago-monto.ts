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
