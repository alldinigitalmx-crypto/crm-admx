-- Nueva columna: distingue si "monto" ya incluye la comisión de la
-- pasarela (hay que restarla para saber el ingreso real) o si "monto" ya
-- es lo que de verdad llegó (dato histórico, comisión solo informativa).
ALTER TABLE "Pago" ADD COLUMN "montoIncluyeComision" BOOLEAN NOT NULL DEFAULT true;

-- Todos los pagos capturados hasta hoy se registraron con la convención
-- vieja (monto = neto ya recibido), así que se marcan en false para que
-- los reportes ya generados no cambien de un día para otro. El único
-- pago que ya se capturó con la convención nueva (monto = bruto cobrado
-- por Mercado Pago) se deja en true, que es el default de la columna.
UPDATE "Pago" SET "montoIncluyeComision" = false WHERE id <> 262;
