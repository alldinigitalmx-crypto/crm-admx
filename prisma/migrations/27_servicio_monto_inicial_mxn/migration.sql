-- Equivalente aproximado en pesos de Servicio.montoInicial cuando la
-- moneda no es MXN (igual que Pago.montoMXN).
ALTER TABLE "Servicio" ADD COLUMN     "montoInicialMXN" DECIMAL(12,2);
