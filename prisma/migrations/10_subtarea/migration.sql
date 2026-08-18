-- CreateTable
CREATE TABLE "Subtarea" (
    "id" SERIAL NOT NULL,
    "tareaId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subtarea_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Subtarea" ADD CONSTRAINT "Subtarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
