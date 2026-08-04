-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "resetTokenExpiraEn" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;
