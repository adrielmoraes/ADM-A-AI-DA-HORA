const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando correção de custos...');

  // 1. Corrigir dia 22/01
  const data22 = new Date(Date.UTC(2026, 0, 22)); // 22 de Janeiro de 2026
  const config22 = await prisma.configFinanceira.findFirst({
    where: { effectiveFrom: data22 }
  });

  if (config22) {
    console.log(`Encontrada config de 22/01 com custo: ${config22.custoPaneiroInsumo}`);
    await prisma.configFinanceira.update({
      where: { id: config22.id },
      data: { custoPaneiroInsumo: new Prisma.Decimal(65.00) }
    });
    console.log('-> Corrigido para R$ 65.00');
  } else {
    console.log('Config de 22/01 não encontrada para atualização. Criando nova...');
    // Se não existir, criaríamos, mas o problema é corrigir o existente.
    // Vamos assumir que o usuário criou. Se não, não há o que corrigir.
  }

  // 2. Corrigir dia 23/01 (que afeta os dias seguintes até nova mudança)
  const data23 = new Date(Date.UTC(2026, 0, 23)); // 23 de Janeiro de 2026
  const config23 = await prisma.configFinanceira.findFirst({
    where: { effectiveFrom: data23 }
  });

  if (config23) {
    console.log(`Encontrada config de 23/01 com custo: ${config23.custoPaneiroInsumo}`);
    await prisma.configFinanceira.update({
      where: { id: config23.id },
      data: { custoPaneiroInsumo: new Prisma.Decimal(60.00) }
    });
    console.log('-> Corrigido para R$ 60.00');
  } else {
    console.log('Config de 23/01 não encontrada.');
  }

  console.log('Correção finalizada.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
