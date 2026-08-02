-- CreateEnum
CREATE TYPE "OrigenVenta" AS ENUM ('TiendaOnline', 'Manual');

-- AlterEnum
BEGIN;
CREATE TYPE "CanalVenta_new" AS ENUM ('Referido', 'GrupoWhatsApp', 'Directo', 'Otro');
ALTER TABLE "Venta" ALTER COLUMN "canal" DROP DEFAULT;
ALTER TABLE "Venta" ALTER COLUMN "canal" TYPE "CanalVenta_new" USING ("canal"::text::"CanalVenta_new");
ALTER TYPE "CanalVenta" RENAME TO "CanalVenta_old";
ALTER TYPE "CanalVenta_new" RENAME TO "CanalVenta";
DROP TYPE "CanalVenta_old";
COMMIT;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "origen" "OrigenVenta" NOT NULL DEFAULT 'Manual',
ALTER COLUMN "canal" DROP NOT NULL,
ALTER COLUMN "canal" DROP DEFAULT;

