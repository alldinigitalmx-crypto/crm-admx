-- CreateEnum
CREATE TYPE "TipoEntregaProducto" AS ENUM ('ArchivoDescargable', 'LinkAppSheet', 'LinkExterno');

-- AlterEnum
ALTER TYPE "EntidadArchivo" ADD VALUE 'Producto';

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "tipoEntrega" "TipoEntregaProducto" NOT NULL DEFAULT 'ArchivoDescargable',
ADD COLUMN     "linkAppSheet" TEXT,
ADD COLUMN     "linkTutorial" TEXT,
ADD COLUMN     "linkExterno" TEXT;
