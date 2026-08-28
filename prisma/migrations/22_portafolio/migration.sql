-- Módulo Portafolio: casos de éxito para la landing pública, con
-- imágenes reutilizando Archivo (entidadTipo Proyecto).
ALTER TYPE "EntidadArchivo" ADD VALUE 'Proyecto';
ALTER TYPE "ModuloSistema" ADD VALUE 'Portafolio';

-- CreateTable
CREATE TABLE "ProyectoPortafolio" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "linkExterno" TEXT,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProyectoPortafolio_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProyectoPortafolio" ADD CONSTRAINT "ProyectoPortafolio_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
