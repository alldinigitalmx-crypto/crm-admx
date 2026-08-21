-- Cotización: permitir prospectos sin cliente registrado
ALTER TABLE "Cotizacion" ALTER COLUMN "clienteId" DROP NOT NULL;
ALTER TABLE "Cotizacion" ADD COLUMN "prospectoNombre" TEXT;
