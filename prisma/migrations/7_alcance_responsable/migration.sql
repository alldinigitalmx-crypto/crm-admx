
-- CreateEnum
CREATE TYPE "AlcanceModuloPermiso" AS ENUM ('Propio', 'Todo');

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "responsableId" INTEGER;

-- AlterTable
ALTER TABLE "Tarea" ADD COLUMN     "asignadoAId" INTEGER;

-- AlterTable
ALTER TABLE "Queja" ADD COLUMN     "asignadoAId" INTEGER;

-- AlterTable
ALTER TABLE "ModuloPermiso" ADD COLUMN     "alcance" "AlcanceModuloPermiso" NOT NULL DEFAULT 'Propio';

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Queja" ADD CONSTRAINT "Queja_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

