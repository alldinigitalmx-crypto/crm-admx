-- Reportes y "Ver detalles" filtran estas columnas en cada consulta y
-- ninguna tenia indice (solo las llaves foraneas lo traen automatico) --
-- sin esto, cada filtro por fecha/status/ambito recorre la tabla completa.
CREATE INDEX "Pago_confirmado_fecha_idx" ON "Pago"("confirmado", "fecha");
CREATE INDEX "Gasto_ambito_fecha_idx" ON "Gasto"("ambito", "fecha");
CREATE INDEX "Servicio_fechaInicio_idx" ON "Servicio"("fechaInicio");
CREATE INDEX "Servicio_status_fechaFin_idx" ON "Servicio"("status", "fechaFin");
CREATE INDEX "Cliente_creadoEn_idx" ON "Cliente"("creadoEn");
