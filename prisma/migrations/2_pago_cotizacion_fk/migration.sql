-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "cotizacionId" INTEGER;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

