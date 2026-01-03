-- AlterTable
ALTER TABLE "ConfigFinanceira" ADD COLUMN     "aluguelMensal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "energiaMensal" DECIMAL(12,2) NOT NULL DEFAULT 0;
