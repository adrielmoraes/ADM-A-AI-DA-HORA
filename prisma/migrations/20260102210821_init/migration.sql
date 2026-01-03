-- CreateEnum
CREATE TYPE "CargoUsuario" AS ENUM ('ADMIN', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "TipoVenda" AS ENUM ('PIX', 'CARTAO', 'DINHEIRO', 'ENTREGA', 'FIADO');

-- CreateEnum
CREATE TYPE "StatusDespesa" AS ENUM ('PENDENTE', 'VALIDADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "StatusFechamento" AS ENUM ('PENDENTE', 'ENVIADO', 'REVISADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "cargo" "CargoUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigFinanceira" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "precoLitroVenda" DECIMAL(12,2) NOT NULL,
    "custoPaneiroInsumo" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ConfigFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producao" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "paneiros" INTEGER NOT NULL,
    "litrosGerados" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "turnoId" TEXT,

    CONSTRAINT "Producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valor" DECIMAL(12,2) NOT NULL,
    "litros" DECIMAL(12,3),
    "tipo" "TipoVenda" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "turnoId" TEXT,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "categoria" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "status" "StatusDespesa" NOT NULL DEFAULT 'PENDENTE',
    "extracaoIa" JSONB,
    "usuarioId" TEXT NOT NULL,
    "turnoId" TEXT,
    "validadoPorId" TEXT,
    "validadoEm" TIMESTAMP(3),

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FechamentoDiario" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valorEsperado" DECIMAL(12,2) NOT NULL,
    "valorReal" DECIMAL(12,2) NOT NULL,
    "diferenca" DECIMAL(12,2) NOT NULL,
    "sobraLitros" DECIMAL(12,3) NOT NULL,
    "justificativa" TEXT,
    "status" "StatusFechamento" NOT NULL DEFAULT 'ENVIADO',
    "usuarioId" TEXT NOT NULL,
    "turnoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FechamentoDiario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nome_key" ON "Usuario"("nome");

-- CreateIndex
CREATE INDEX "Turno_usuarioId_idx" ON "Turno"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigFinanceira_effectiveFrom_key" ON "ConfigFinanceira"("effectiveFrom");

-- CreateIndex
CREATE INDEX "Producao_data_idx" ON "Producao"("data");

-- CreateIndex
CREATE INDEX "Producao_usuarioId_idx" ON "Producao"("usuarioId");

-- CreateIndex
CREATE INDEX "Venda_usuarioId_idx" ON "Venda"("usuarioId");

-- CreateIndex
CREATE INDEX "Venda_data_idx" ON "Venda"("data");

-- CreateIndex
CREATE INDEX "Despesa_data_idx" ON "Despesa"("data");

-- CreateIndex
CREATE INDEX "Despesa_status_idx" ON "Despesa"("status");

-- CreateIndex
CREATE INDEX "Despesa_usuarioId_idx" ON "Despesa"("usuarioId");

-- CreateIndex
CREATE INDEX "FechamentoDiario_data_idx" ON "FechamentoDiario"("data");

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoDiario_data_usuarioId_key" ON "FechamentoDiario"("data", "usuarioId");

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigFinanceira" ADD CONSTRAINT "ConfigFinanceira_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producao" ADD CONSTRAINT "Producao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producao" ADD CONSTRAINT "Producao_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoDiario" ADD CONSTRAINT "FechamentoDiario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoDiario" ADD CONSTRAINT "FechamentoDiario_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;
