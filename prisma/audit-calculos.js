const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["error"] });

function formatDateInputValue(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayKeyFromDateTime(date) {
  return formatDateInputValue(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())));
}

function dateRangeUtc(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return { start, end };
}

function daysUtc(startInclusive, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(new Date(Date.UTC(startInclusive.getUTCFullYear(), startInclusive.getUTCMonth(), startInclusive.getUTCDate() + i)));
  }
  return out;
}

function decimal(value) {
  return value ?? new Prisma.Decimal(0);
}

async function getConfigForDay(day) {
  return prisma.configFinanceira.findFirst({
    where: { effectiveFrom: { lte: day } },
    orderBy: { effectiveFrom: "desc" },
    select: {
      effectiveFrom: true,
      precoLitroVenda: true,
      custoPaneiroInsumo: true,
      aluguelMensal: true,
      energiaMensal: true,
    },
  });
}

async function main() {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowDays = Number(process.env.AUDIT_DAYS ?? "15");
  const startUtc = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() - (windowDays - 1)));
  const days = daysUtc(startUtc, windowDays);

  const daily = [];
  for (const day of days) {
    const { start, end } = dateRangeUtc(day);
    const [vendasAgg, despesasAgg, producaoAgg, fechAgg, fiadoPagoAgg, cfg] = await Promise.all([
      prisma.venda.aggregate({ where: { data: { gte: start, lt: end } }, _sum: { valor: true } }),
      prisma.despesa.aggregate({ where: { data: { gte: start, lt: end }, status: "VALIDADA" }, _sum: { valor: true } }),
      prisma.producao.aggregate({ where: { data: { gte: start, lt: end } }, _sum: { paneiros: true, litrosGerados: true } }),
      prisma.fechamentoDiario.aggregate({
        where: { data: day },
        _sum: { valorReal: true, valorEsperado: true, diferenca: true, sobraLitros: true },
        _count: { _all: true },
      }),
      prisma.fiadoLancamento.aggregate({
        where: { data: { gte: start, lt: end }, tipo: "PAGAMENTO" },
        _sum: { valor: true },
      }),
      getConfigForDay(day),
    ]);

    const fixos = cfg ? cfg.aluguelMensal.plus(cfg.energiaMensal).div(30) : new Prisma.Decimal(0);
    const custoInsumo = cfg ? cfg.custoPaneiroInsumo : new Prisma.Decimal(0);

    daily.push({
      day: formatDateInputValue(day),
      vendas: Number(decimal(vendasAgg._sum.valor).toFixed(2)),
      despesasValidadas: Number(decimal(despesasAgg._sum.valor).toFixed(2)),
      paneiros: producaoAgg._sum.paneiros ?? 0,
      litrosGerados: Number(decimal(producaoAgg._sum.litrosGerados).toFixed(3)),
      fixos: Number(fixos.toFixed(2)),
      custoInsumo: Number(custoInsumo.toFixed(2)),
      fechamentos: fechAgg._count._all,
      fechamentoValorReal: Number(decimal(fechAgg._sum.valorReal).toFixed(2)),
      fechamentoValorEsperado: Number(decimal(fechAgg._sum.valorEsperado).toFixed(2)),
      fechamentoDiferenca: Number(decimal(fechAgg._sum.diferenca).toFixed(2)),
      fiadoPago: Number(decimal(fiadoPagoAgg._sum.valor).toFixed(2)),
      cfgEffectiveFrom: cfg ? formatDateInputValue(cfg.effectiveFrom) : null,
    });
  }

  const [vendasRecent, despesasRecent] = await Promise.all([
    prisma.venda.findMany({ where: { data: { gte: startUtc } }, select: { data: true }, take: 5000 }),
    prisma.despesa.findMany({ where: { data: { gte: startUtc } }, select: { data: true }, take: 5000 }),
  ]);
  const vendaHours = {};
  for (const v of vendasRecent) {
    const h = v.data.getUTCHours();
    vendaHours[h] = (vendaHours[h] ?? 0) + 1;
  }
  const despesaHours = {};
  for (const d of despesasRecent) {
    const h = d.data.getUTCHours();
    despesaHours[h] = (despesaHours[h] ?? 0) + 1;
  }

  const fechamentos = await prisma.fechamentoDiario.findMany({
    orderBy: { createdAt: "desc" },
    take: 120,
    select: {
      id: true,
      data: true,
      turnoId: true,
      usuarioId: true,
      valorReal: true,
      valorEsperado: true,
      diferenca: true,
      sobraLitros: true,
      createdAt: true,
    },
  });
  const turnoIds = Array.from(new Set(fechamentos.map((f) => f.turnoId)));
  const turnos = await prisma.turno.findMany({
    where: { id: { in: turnoIds } },
    select: { id: true, usuarioId: true, openedAt: true, closedAt: true },
  });
  const turnosById = new Map(turnos.map((t) => [t.id, t]));

  const fechamentoChecks = [];
  for (const f of fechamentos) {
    const turno = turnosById.get(f.turnoId) ?? null;
    const { start, end } = dateRangeUtc(f.data);

    const [vendasSemFiadoAgg, fiadoComprasAgg, fiadoManualAgg, prodAgg, vendasDatas, cfg] = await Promise.all([
      prisma.venda.aggregate({ where: { turnoId: f.turnoId, tipo: { not: "FIADO" } }, _sum: { valor: true } }),
      prisma.fiadoLancamento.aggregate({ where: { tipo: "COMPRA", venda: { turnoId: f.turnoId } }, _sum: { valor: true } }),
      prisma.venda.aggregate({ where: { turnoId: f.turnoId, tipo: "FIADO", clienteFiadoId: null }, _sum: { valor: true } }),
      prisma.producao.aggregate({ where: { turnoId: f.turnoId }, _sum: { litrosGerados: true } }),
      prisma.venda.findMany({ where: { turnoId: f.turnoId }, select: { data: true }, take: 8000 }),
      prisma.configFinanceira.findFirst({
        where: { effectiveFrom: { lte: f.data } },
        orderBy: { effectiveFrom: "desc" },
        select: { precoLitroVenda: true },
      }),
    ]);

    const recalculatedReal = decimal(vendasSemFiadoAgg._sum.valor)
      .plus(decimal(fiadoComprasAgg._sum.valor))
      .plus(decimal(fiadoManualAgg._sum.valor));
    const diffReal = recalculatedReal.minus(f.valorReal).abs();

    const litros = decimal(prodAgg._sum.litrosGerados);
    const recalculatedEsperado = cfg ? litros.minus(f.sobraLitros).mul(cfg.precoLitroVenda) : null;
    const diffEsperado = recalculatedEsperado ? recalculatedEsperado.minus(f.valorEsperado).abs() : null;

    let vendasForaDoDiaFechamento = 0;
    for (const v of vendasDatas) {
      if (v.data < start || v.data >= end) vendasForaDoDiaFechamento += 1;
    }

    const openedAt = turno?.openedAt ?? null;
    const closedAt = turno?.closedAt ?? null;
    const openedDay = openedAt ? dayKeyFromDateTime(openedAt) : null;
    const fechamentoDay = formatDateInputValue(f.data);
    const turnoDurationHours =
      openedAt && closedAt ? Math.round(((closedAt.getTime() - openedAt.getTime()) / 36e5) * 10) / 10 : null;

    fechamentoChecks.push({
      fechamentoId: f.id,
      fechamentoDay,
      turnoOpenedDay: openedDay,
      turnoDurationHours,
      valorRealStored: Number(f.valorReal.toFixed(2)),
      valorRealRecalc: Number(recalculatedReal.toFixed(2)),
      diffValorReal: Number(diffReal.toFixed(2)),
      valorEsperadoStored: Number(f.valorEsperado.toFixed(2)),
      valorEsperadoRecalc: recalculatedEsperado ? Number(recalculatedEsperado.toFixed(2)) : null,
      diffValorEsperado: diffEsperado ? Number(diffEsperado.toFixed(2)) : null,
      vendasForaDoDiaFechamento,
    });
  }

  const inconsistencias = {
    diasSemConfigMasComMovimento: daily.filter(
      (d) => !d.cfgEffectiveFrom && (d.vendas !== 0 || d.despesasValidadas !== 0 || d.paneiros !== 0 || d.fechamentos !== 0),
    ),
    diasComFechamentoSemVendasNoDia: daily.filter((d) => d.fechamentos > 0 && d.vendas === 0),
    fechamentosValorRealMismatch: fechamentoChecks.filter((f) => f.diffValorReal > 0.01),
    fechamentosValorEsperadoMismatch: fechamentoChecks.filter(
      (f) => f.diffValorEsperado != null && f.diffValorEsperado > 0.01,
    ),
    fechamentosComVendasForaDoDia: fechamentoChecks.filter((f) => f.vendasForaDoDiaFechamento > 0),
    fechamentosTurnoLongo: fechamentoChecks.filter((f) => f.turnoDurationHours != null && f.turnoDurationHours > 16),
  };

  console.log(
    JSON.stringify(
      {
        window: { start: startUtc.toISOString(), end: new Date(dateRangeUtc(todayUtc).end).toISOString(), days: windowDays },
        daily,
        distributionsUtcHours: { vendas: vendaHours, despesas: despesaHours },
        inconsistenciasResumo: Object.fromEntries(
          Object.entries(inconsistencias).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
        ),
        exemplos: {
          diasSemConfigMasComMovimento: inconsistencias.diasSemConfigMasComMovimento.slice(0, 10),
          diasComFechamentoSemVendasNoDia: inconsistencias.diasComFechamentoSemVendasNoDia.slice(0, 10),
          fechamentosValorRealMismatch: inconsistencias.fechamentosValorRealMismatch.slice(0, 10),
          fechamentosValorEsperadoMismatch: inconsistencias.fechamentosValorEsperadoMismatch.slice(0, 10),
          fechamentosComVendasForaDoDia: inconsistencias.fechamentosComVendasForaDoDia.slice(0, 10),
          fechamentosTurnoLongo: inconsistencias.fechamentosTurnoLongo.slice(0, 10),
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

