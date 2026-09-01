-- Permite ligar una tarea directo a un Cliente (prospecto que aún no
-- tiene ni cotización) además de servicio/cotización.
ALTER TABLE "Tarea" ADD COLUMN "clienteId" INTEGER;
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
