-- Tipo de cuenta
CREATE TYPE "TipoCuenta" AS ENUM ('Banco', 'Efectivo', 'Billetera');

-- Tabla Cuenta
CREATE TABLE "Cuenta" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL DEFAULT 'Banco',
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "clabe" TEXT,
    "swift" TEXT,
    "saldoInicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- Tabla Retiro
CREATE TABLE "Retiro" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(12,2) NOT NULL,
    "comentario" TEXT,
    "creadoPorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Retiro_pkey" PRIMARY KEY ("id")
);

-- Pago: el texto libre histórico se conserva como cuentaTexto; cuentaId es
-- la relación real de aquí en adelante.
ALTER TABLE "Pago" RENAME COLUMN "cuenta" TO "cuentaTexto";
ALTER TABLE "Pago" ADD COLUMN "cuentaId" INTEGER;

-- Gasto: nueva relación a Cuenta
ALTER TABLE "Gasto" ADD COLUMN "cuentaId" INTEGER;

-- Foreign keys
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Retiro" ADD CONSTRAINT "Retiro_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Retiro" ADD CONSTRAINT "Retiro_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
