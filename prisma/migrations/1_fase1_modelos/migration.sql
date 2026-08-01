-- CreateEnum
CREATE TYPE "StatusOrdenCambio" AS ENUM ('Pendiente', 'Aprobada', 'Rechazada');

-- CreateEnum
CREATE TYPE "StatusCotizacion" AS ENUM ('Enviada', 'Firmada', 'Pagada', 'Vencida');

-- CreateEnum
CREATE TYPE "TipoDescuento" AS ENUM ('Monto', 'Porcentaje');

-- CreateEnum
CREATE TYPE "EntidadArchivo" AS ENUM ('Servicio', 'Cotizacion', 'Queja');

-- CreateEnum
CREATE TYPE "TipoArchivo" AS ENUM ('Imagen', 'Video', 'Documento', 'Otro');

-- CreateEnum
CREATE TYPE "CategoriaQueja" AS ENUM ('Falla', 'Cobro', 'Atencion', 'Otro');

-- CreateEnum
CREATE TYPE "StatusQueja" AS ENUM ('Nueva', 'EnRevision', 'Resuelta', 'Cerrada');

-- CreateEnum
CREATE TYPE "ModuloSistema" AS ENUM ('Clientes', 'Servicios', 'Cotizaciones', 'Pagos', 'Productos', 'Ventas', 'Quejas', 'Usuarios', 'Portal');

-- CreateEnum
CREATE TYPE "StatusTicketAcceso" AS ENUM ('Pendiente', 'Aprobado', 'Rechazado');

-- CreateEnum
CREATE TYPE "NivelPermiso" AS ENUM ('Ver', 'Crear', 'Editar');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('Inmediata', 'LargoPlazo');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('MXN', 'COP');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "portalActivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultimoAccesoPortal" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "actualizadoEn" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "editadoPorId" INTEGER,
ADD COLUMN     "moneda" "Moneda";

-- AlterTable
ALTER TABLE "OrdenCambio" ADD COLUMN     "aprobadoEn" TIMESTAMP(3),
ADD COLUMN     "aprobadoPorId" INTEGER,
ADD COLUMN     "status" "StatusOrdenCambio" NOT NULL DEFAULT 'Pendiente';

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "confirmado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "confirmadoEn" TIMESTAMP(3),
ADD COLUMN     "confirmadoPorId" INTEGER,
ADD COLUMN     "moneda" "Moneda";

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "costoReferencia" DECIMAL(12,2),
ADD COLUMN     "requiereCotizacion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "actualizadoEn" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "editadoPorId" INTEGER,
ADD COLUMN     "etapaActualId" INTEGER,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "tipoEntrega" "TipoEntrega" NOT NULL DEFAULT 'Inmediata';

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" SERIAL NOT NULL,
    "servicioId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "status" "StatusCotizacion" NOT NULL DEFAULT 'Enviada',
    "montoSubtotal" DECIMAL(12,2) NOT NULL,
    "descuentoTipo" "TipoDescuento",
    "descuentoValor" DECIMAL(12,2),
    "descuentoMotivo" TEXT,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "moneda" "Moneda",
    "metodoPago" "MetodoPago",
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "fechaFirma" TIMESTAMP(3),
    "firmanteNombre" TEXT,
    "firmanteIp" TEXT,
    "fechaPago" TIMESTAMP(3),
    "pagoConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "creadoPorId" INTEGER,
    "editadoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Archivo" (
    "id" SERIAL NOT NULL,
    "entidadTipo" "EntidadArchivo" NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "TipoArchivo" NOT NULL,
    "tamanioBytes" INTEGER,
    "subidoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoSistema" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Queja" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "servicioId" INTEGER,
    "categoria" "CategoriaQueja" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "status" "StatusQueja" NOT NULL DEFAULT 'Nueva',
    "respuesta" TEXT,
    "respondidoPorId" INTEGER,
    "respondidoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Queja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAcceso" (
    "id" SERIAL NOT NULL,
    "usuarioSolicitanteId" INTEGER NOT NULL,
    "moduloSolicitado" "ModuloSistema" NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusTicketAcceso" NOT NULL DEFAULT 'Pendiente',
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoPorId" INTEGER,
    "fechaResolucion" TIMESTAMP(3),

    CONSTRAINT "TicketAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuloPermiso" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "modulo" "ModuloSistema" NOT NULL,
    "nivel" "NivelPermiso" NOT NULL,

    CONSTRAINT "ModuloPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaVenta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "EtapaVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaEtapaHistorial" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "etapaId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,
    "registradoPorId" INTEGER,

    CONSTRAINT "VentaEtapaHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_token_key" ON "Cotizacion"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ModuloPermiso_usuarioId_modulo_key" ON "ModuloPermiso"("usuarioId", "modulo");

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_editadoPorId_fkey" FOREIGN KEY ("editadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCambio" ADD CONSTRAINT "OrdenCambio_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_editadoPorId_fkey" FOREIGN KEY ("editadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Queja" ADD CONSTRAINT "Queja_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Queja" ADD CONSTRAINT "Queja_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Queja" ADD CONSTRAINT "Queja_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAcceso" ADD CONSTRAINT "TicketAcceso_usuarioSolicitanteId_fkey" FOREIGN KEY ("usuarioSolicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAcceso" ADD CONSTRAINT "TicketAcceso_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloPermiso" ADD CONSTRAINT "ModuloPermiso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_etapaActualId_fkey" FOREIGN KEY ("etapaActualId") REFERENCES "EtapaVenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_editadoPorId_fkey" FOREIGN KEY ("editadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEtapaHistorial" ADD CONSTRAINT "VentaEtapaHistorial_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEtapaHistorial" ADD CONSTRAINT "VentaEtapaHistorial_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "EtapaVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEtapaHistorial" ADD CONSTRAINT "VentaEtapaHistorial_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

