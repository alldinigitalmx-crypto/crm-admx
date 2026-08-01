-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "ordenCambioId" INTEGER;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_ordenCambioId_fkey" FOREIGN KEY ("ordenCambioId") REFERENCES "OrdenCambio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

