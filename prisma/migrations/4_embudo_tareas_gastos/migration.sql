-- CreateEnum
CREATE TYPE "PrioridadTarea" AS ENUM ('Baja', 'Media', 'Alta');

-- CreateEnum
CREATE TYPE "AmbitoGasto" AS ENUM ('Personal', 'Empresa');

-- AlterEnum
ALTER TYPE "StatusCotizacion" ADD VALUE 'Perdida';

-- DropForeignKey
ALTER TABLE "Cotizacion" DROP CONSTRAINT "Cotizacion_servicioId_fkey";

-- AlterTable (nullable first so existing rows can be backfilled)
ALTER TABLE "Servicio" ADD COLUMN     "tokenPublico" TEXT;
UPDATE "Servicio" SET "tokenPublico" = gen_random_uuid()::text WHERE "tokenPublico" IS NULL;
ALTER TABLE "Servicio" ALTER COLUMN "tokenPublico" SET NOT NULL;

-- AlterTable (ordenCambioId already exists from migration 3_cotizacion_orden_cambio_fk)
ALTER TABLE "Cotizacion" ADD COLUMN     "clienteId" INTEGER,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "detalles" TEXT,
ALTER COLUMN "servicioId" DROP NOT NULL;

-- Backfill clienteId from the existing servicio's cliente for pre-existing rows
UPDATE "Cotizacion" c
SET "clienteId" = s."clienteId"
FROM "Servicio" s
WHERE c."servicioId" = s."id" AND c."clienteId" IS NULL;

ALTER TABLE "Cotizacion" ALTER COLUMN "clienteId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Tarea" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "prioridad" "PrioridadTarea" NOT NULL DEFAULT 'Media',
    "fechaLimite" TIMESTAMP(3),
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "completadaEn" TIMESTAMP(3),
    "servicioId" INTEGER,
    "cotizacionId" INTEGER,
    "creadoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "ambito" "AmbitoGasto" NOT NULL DEFAULT 'Empresa',
    "monto" DECIMAL(12,2) NOT NULL,
    "metodoPago" "MetodoPago",
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobante" TEXT,
    "notas" TEXT,
    "creadoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_tokenPublico_key" ON "Servicio"("tokenPublico");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

