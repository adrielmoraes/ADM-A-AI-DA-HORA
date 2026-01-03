/*
  Warnings:

  - A unique constraint covering the columns `[turnoId]` on the table `FechamentoDiario` will be added. If there are existing duplicate values, this will fail.
  - Made the column `turnoId` on table `FechamentoDiario` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TipoFiadoLancamento" AS ENUM ('COMPRA', 'PAGAMENTO');

-- DropForeignKey
ALTER TABLE "FechamentoDiario" DROP CONSTRAINT "FechamentoDiario_turnoId_fkey";

-- DropIndex
DROP INDEX "FechamentoDiario_data_usuarioId_key";

-- AlterTable
ALTER TABLE "FechamentoDiario" ALTER COLUMN "turnoId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "clienteFiadoId" TEXT;

-- CreateTable
CREATE TABLE "ClienteFiado" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "saldoDevedor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quitadoEm" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteFiado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiadoLancamento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoFiadoLancamento" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendaId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "marcadoComoPago" BOOLEAN NOT NULL DEFAULT false,
    "pagoEm" TIMESTAMP(3),

    CONSTRAINT "FiadoLancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClienteFiado_nome_idx" ON "ClienteFiado"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "FiadoLancamento_vendaId_key" ON "FiadoLancamento"("vendaId");

-- CreateIndex
CREATE INDEX "FiadoLancamento_clienteId_idx" ON "FiadoLancamento"("clienteId");

-- CreateIndex
CREATE INDEX "FiadoLancamento_data_idx" ON "FiadoLancamento"("data");

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoDiario_turnoId_key" ON "FechamentoDiario"("turnoId");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_clienteFiadoId_fkey" FOREIGN KEY ("clienteFiadoId") REFERENCES "ClienteFiado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiadoLancamento" ADD CONSTRAINT "FiadoLancamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "ClienteFiado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiadoLancamento" ADD CONSTRAINT "FiadoLancamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiadoLancamento" ADD CONSTRAINT "FiadoLancamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoDiario" ADD CONSTRAINT "FechamentoDiario_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
