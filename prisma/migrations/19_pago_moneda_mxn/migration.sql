-- Equivalente en pesos mexicanos de un pago en otra moneda (USD/COP) --
-- ver comentario en el modelo Pago (schema.prisma) y src/lib/pago-monto.ts.
ALTER TABLE "Pago" ADD COLUMN "montoMXN" DECIMAL(12,2);
