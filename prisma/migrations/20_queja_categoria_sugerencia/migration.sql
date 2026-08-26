-- El helpdesk del link público de servicio ahora deja mandar sugerencias,
-- no solo quejas de falla/cobro/atención.
ALTER TYPE "CategoriaQueja" ADD VALUE 'Sugerencia' BEFORE 'Otro';
