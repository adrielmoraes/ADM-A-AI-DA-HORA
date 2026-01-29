const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  // Ajuste para o fuso horário local se necessário, mas o código usa UTC ou datas simples.
  // Vou usar a mesma lógica do admin/page.tsx: start e end do mês.
  
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  
  // Array de dias do mês até hoje (inclusive)
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const days = [];
  let d = new Date(start);
  while (d <= today && d < end) {
    days.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  console.log(`Período analisado: ${start.toISOString().split('T')[0]} até ${today.toISOString().split('T')[0]}`);

  // 1. Configurações Financeiras (Custos Fixos e Custo Paneiro)
  const configs = await prisma.configFinanceira.findMany({
    where: { effectiveFrom: { lte: today } },
    orderBy: { effectiveFrom: 'asc' },
  });

  console.log('--- Configurações Financeiras ---');
  configs.forEach(c => {
    console.log(`Vigência: ${c.effectiveFrom.toISOString().split('T')[0]} | Aluguel: ${c.aluguelMensal} | Energia: ${c.energiaMensal} | Custo Paneiro: ${c.custoPaneiroInsumo}`);
  });

  // 2. Vendas (Entradas)
  const vendas = await prisma.venda.findMany({
    where: { data: { gte: start, lt: end } },
  });
  const vendasSemFiado = vendas.filter(v => v.tipo !== 'FIADO').reduce((acc, v) => acc + Number(v.valor), 0);
  const vendasFiado = vendas.filter(v => v.tipo === 'FIADO').reduce((acc, v) => acc + Number(v.valor), 0);
  
  console.log('\n--- Vendas ---');
  console.log(`Total Vendas (Sem Fiado): R$ ${vendasSemFiado.toFixed(2)}`);
  console.log(`Total Vendas (Fiado - não entra no caixa): R$ ${vendasFiado.toFixed(2)}`);

  // 3. Recebimentos de Fiado (Entradas)
  const fiadoPagamentos = await prisma.fiadoLancamento.findMany({
    where: { data: { gte: start, lt: end }, tipo: 'PAGAMENTO' },
  });
  const totalFiadoPago = fiadoPagamentos.reduce((acc, v) => acc + Number(v.valor), 0);
  console.log(`Total Fiado Recebido: R$ ${totalFiadoPago.toFixed(2)}`);

  const totalEntradas = vendasSemFiado + totalFiadoPago;
  console.log(`TOTAL ENTRADAS (Caixa): R$ ${totalEntradas.toFixed(2)}`);

  // 4. Despesas (Saídas)
  const despesas = await prisma.despesa.findMany({
    where: { data: { gte: start, lt: end }, status: 'VALIDADA' },
  });
  const totalDespesas = despesas.reduce((acc, v) => acc + Number(v.valor), 0);
  console.log('\n--- Despesas ---');
  console.log(`Total Despesas Validadas: R$ ${totalDespesas.toFixed(2)}`);

  // 5. Produção (Custos Variáveis)
  const producao = await prisma.producao.findMany({
    where: { data: { gte: start, lt: end } },
  });
  
  // Agrupar paneiros por dia
  const paneirosByDay = new Map();
  producao.forEach(p => {
    const key = p.data.toISOString().split('T')[0];
    paneirosByDay.set(key, (paneirosByDay.get(key) || 0) + p.paneiros);
  });

  let totalCustoInsumo = 0;
  let totalPaneiros = 0;
  
  console.log('\n--- Produção e Custo Insumo ---');
  for (const day of days) {
    const dayKey = day.toISOString().split('T')[0];
    const paneiros = paneirosByDay.get(dayKey) || 0;
    totalPaneiros += paneiros;

    // Encontrar config vigente
    let config = null;
    for (const c of configs) {
      if (c.effectiveFrom <= day) config = c;
      else break;
    }

    if (config) {
      const custo = paneiros * Number(config.custoPaneiroInsumo);
      totalCustoInsumo += custo;
      // console.log(`Dia ${dayKey}: ${paneiros} paneiros * ${config.custoPaneiroInsumo} = ${custo.toFixed(2)}`);
    } else {
      console.log(`Dia ${dayKey}: ${paneiros} paneiros (SEM CONFIGURAÇÃO DE CUSTO!)`);
    }
  }
  console.log(`Total Paneiros: ${totalPaneiros}`);
  console.log(`Total Custo Insumo: R$ ${totalCustoInsumo.toFixed(2)}`);

  // 6. Custos Fixos (Aluguel + Energia Rateados)
  let totalFixos = 0;
  console.log('\n--- Custos Fixos (Rateio) ---');
  for (const day of days) {
    const dayKey = day.toISOString().split('T')[0];
    
    let config = null;
    for (const c of configs) {
      if (c.effectiveFrom <= day) config = c;
      else break;
    }

    if (config) {
      const fixoDia = (Number(config.aluguelMensal) + Number(config.energiaMensal)) / 30;
      totalFixos += fixoDia;
      // console.log(`Dia ${dayKey}: (${config.aluguelMensal} + ${config.energiaMensal})/30 = ${fixoDia.toFixed(2)}`);
    }
  }
  console.log(`Total Fixos Acumulados: R$ ${totalFixos.toFixed(2)}`);

  // RESUMO FINAL
  const lucro = totalEntradas - totalDespesas - totalCustoInsumo - totalFixos;
  
  console.log('\n=== RESUMO FINAL ===');
  console.log(`(+) Entradas: R$ ${totalEntradas.toFixed(2)}`);
  console.log(`(-) Despesas: R$ ${totalDespesas.toFixed(2)}`);
  console.log(`(-) Custo Insumo: R$ ${totalCustoInsumo.toFixed(2)}`);
  console.log(`(-) Custos Fixos: R$ ${totalFixos.toFixed(2)}`);
  console.log(`--------------------------------`);
  console.log(`(=) LUCRO/PREJUÍZO: R$ ${lucro.toFixed(2)}`);

}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
