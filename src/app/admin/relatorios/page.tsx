import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";
import styles from "../admin.module.css";
import {
  addDaysUtc,
  addMonthsUtc,
  enumerateDaysUtc,
  formatDateInputValue,
  parseDateOnly,
  startOfMonthUtc,
  startOfWeekUtc,
} from "@/lib/date";

type Period = "week" | "month";

function getPeriod(value: string | undefined): Period {
  if (value === "week" || value === "month") return value;
  return "month";
}

function dayKeyFromDateTime(date: Date) {
  return formatDateInputValue(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
  );
}

function formatCurrency(value: number | Prisma.Decimal) {
  const val = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function formatDayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

function sumByDay<T extends { data: Date; valor: Prisma.Decimal }>(rows: T[]) {
  const map = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    const key = dayKeyFromDateTime(r.data);
    map.set(key, (map.get(key) ?? new Prisma.Decimal(0)).plus(r.valor));
  }
  return map;
}

function sumPaneirosByDay(rows: { data: Date; paneiros: number }[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = formatDateInputValue(r.data);
    map.set(key, (map.get(key) ?? 0) + r.paneiros);
  }
  return map;
}

function computeCostsByDay(
  days: Date[],
  paneirosByDay: Map<string, number>,
  configs: { effectiveFrom: Date; custoPaneiroInsumo: Prisma.Decimal }[],
) {
  const costs = new Map<string, Prisma.Decimal>();
  if (configs.length === 0) return costs;

  let idx = 0;
  for (const day of days) {
    while (idx + 1 < configs.length && configs[idx + 1].effectiveFrom <= day) idx += 1;
    const paneiros = paneirosByDay.get(formatDateInputValue(day)) ?? 0;
    const cost = configs[idx].custoPaneiroInsumo.mul(paneiros);
    costs.set(formatDateInputValue(day), cost);
  }
  return costs;
}

function computeFixosByDay(
  days: Date[],
  configs: { effectiveFrom: Date; aluguelMensal: Prisma.Decimal; energiaMensal: Prisma.Decimal }[],
) {
  const fixos = new Map<string, Prisma.Decimal>();
  if (configs.length === 0) return fixos;

  let idx = 0;
  for (const day of days) {
    while (idx + 1 < configs.length && configs[idx + 1].effectiveFrom <= day) idx += 1;
    const daily = configs[idx].aluguelMensal.plus(configs[idx].energiaMensal).div(30);
    fixos.set(formatDateInputValue(day), daily);
  }
  return fixos;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: { period?: string; data?: string };
}) {
  await requireAdmin();

  const period = getPeriod(searchParams.period);
  const baseDate = searchParams.data
    ? parseDateOnly(searchParams.data)
    : parseDateOnly(formatDateInputValue(new Date()));

  const start =
    period === "week" ? startOfWeekUtc(baseDate) : startOfMonthUtc(baseDate);
  const end = period === "week" ? addDaysUtc(start, 7) : addMonthsUtc(start, 1);
  const days = enumerateDaysUtc(start, end);

  const [configs, vendas, pagamentosFiado, despesasValidadas, producao, fechamentos] =
    await Promise.all([
      prisma.configFinanceira.findMany({
        where: { effectiveFrom: { lte: addDaysUtc(end, -1) } },
        orderBy: { effectiveFrom: "asc" },
        select: {
          effectiveFrom: true,
          custoPaneiroInsumo: true,
          aluguelMensal: true,
          energiaMensal: true,
        },
      }),
      prisma.venda.findMany({
        where: { data: { gte: start, lt: end }, tipo: { not: "FIADO" } },
        select: { data: true, valor: true },
      }),
      prisma.fiadoLancamento.findMany({
        where: { data: { gte: start, lt: end }, tipo: "PAGAMENTO" },
        select: { data: true, valor: true },
      }),
      prisma.despesa.findMany({
        where: { data: { gte: start, lt: end }, status: "VALIDADA" },
        select: { data: true, valor: true },
      }),
      prisma.producao.findMany({
        where: { data: { gte: start, lt: end } },
        select: { data: true, paneiros: true },
      }),
      prisma.fechamentoDiario.findMany({
        where: { data: { gte: start, lt: end } },
        include: { usuario: { select: { id: true, nome: true } } },
      }),
    ]);

  const entradasVendasByDay = sumByDay(vendas);
  const entradasFiadoByDay = sumByDay(pagamentosFiado);
  const despesasByDay = sumByDay(despesasValidadas);
  const paneirosByDay = sumPaneirosByDay(producao);
  const custosByDay = computeCostsByDay(days, paneirosByDay, configs);
  const fixosByDay = computeFixosByDay(days, configs);

  const totalVendas = Array.from(entradasVendasByDay.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );
  const totalFiadoPago = Array.from(entradasFiadoByDay.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );
  const totalDespesas = Array.from(despesasByDay.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );
  const totalCustos = Array.from(custosByDay.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );
  const totalFixos = Array.from(fixosByDay.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );

  const entradas = totalVendas.plus(totalFiadoPago);
  const lucro = entradas.minus(totalDespesas).minus(totalCustos).minus(totalFixos);

  return (
    <main className={styles.main}>
      <div className={styles.top}>
        <div>
          <div className={styles.title}>Relatórios Financeiros</div>
          <div className={styles.meta}>
            {period === "week" ? "Semanal" : "Mensal"} · {formatDateInputValue(start)} até{" "}
            {formatDateInputValue(addDaysUtc(end, -1))}
          </div>
        </div>
        <a className={styles.button} href="/admin">
          Voltar ao Dashboard
        </a>
      </div>

      <section className={styles.card}>
        <form className={styles.filterForm} action="/admin/relatorios">
          <label className={styles.label}>
            Período
            <select className={styles.input} name="period" defaultValue={period}>
              <option value="week">Semanal</option>
              <option value="month">Mensal</option>
            </select>
          </label>
          <label className={styles.label}>
            Data de referência
            <input
              className={styles.input}
              type="date"
              name="data"
              defaultValue={formatDateInputValue(baseDate)}
            />
          </label>
          <button className={styles.button} type="submit">
            Atualizar Relatório
          </button>
        </form>
      </section>

      <section className={styles.summaryGrid}>
        <div className={styles.card}>
          <div className={styles.valueCard}>
            <span className={styles.valueLabel}>Entradas Totais</span>
            <span className={`${styles.valueBig} ${styles.textSuccess}`}>
              {formatCurrency(entradas)}
            </span>
            <div className={styles.meta} style={{ fontSize: "12px" }}>
              Vendas: {formatCurrency(totalVendas)}
              <br />
              Fiado Pago: {formatCurrency(totalFiadoPago)}
            </div>
          </div>
        </div>

        <div className={styles.card}>
        <div className={styles.valueCard}>
            <span className={styles.valueLabel}>Saídas Totais</span>
            <span className={`${styles.valueBig} ${styles.textError}`}>
              {formatCurrency(totalDespesas.plus(totalCustos).plus(totalFixos))}
            </span>
            <div className={styles.meta} style={{ fontSize: "12px" }}>
              Despesas: {formatCurrency(totalDespesas)}
              <br />
              Custo Insumo: {formatCurrency(totalCustos)}
              <br />
              Fixos (rateio): {formatCurrency(totalFixos)}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.valueCard}>
            <span className={styles.valueLabel}>Lucro Líquido</span>
            <span
              className={`${styles.valueBig} ${
                lucro.gte(0) ? styles.textSuccess : styles.textError
              }`}
            >
              {formatCurrency(lucro)}
            </span>
            {configs.length === 0 && (
              <div className={styles.meta} style={{ color: "var(--error)" }}>
                ⚠ Custo de paneiro não configurado
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={styles.grid} style={{ gridTemplateColumns: "1fr" }}>
        <section className={styles.card}>
          <h2 className={styles.h2}>Detalhamento Diário</h2>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Entradas</th>
                  <th>Despesas</th>
                  <th>Fixos</th>
                  <th>Paneiros</th>
                  <th>Custo Insumo</th>
                  <th>Lucro do Dia</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const key = formatDateInputValue(d);
                  const e = (entradasVendasByDay.get(key) ?? new Prisma.Decimal(0)).plus(
                    entradasFiadoByDay.get(key) ?? new Prisma.Decimal(0),
                  );
                  const des = despesasByDay.get(key) ?? new Prisma.Decimal(0);
                  const fixos = fixosByDay.get(key) ?? new Prisma.Decimal(0);
                  const paneiros = paneirosByDay.get(key) ?? 0;
                  const custo = custosByDay.get(key) ?? new Prisma.Decimal(0);
                  const l = e.minus(des).minus(custo).minus(fixos);

                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 500 }}>{formatDayLabel(key)}</td>
                      <td className={styles.textSuccess}>{formatCurrency(e)}</td>
                      <td className={des.gt(0) ? styles.textError : ""}>
                        {formatCurrency(des)}
                      </td>
                      <td>{formatCurrency(fixos)}</td>
                      <td>{paneiros}</td>
                      <td>{formatCurrency(custo)}</td>
                      <td
                        style={{ fontWeight: "bold" }}
                        className={l.gte(0) ? styles.textSuccess : styles.textError}
                      >
                        {formatCurrency(l)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <DivergenciasSection fechamentos={fechamentos} />
      </div>
    </main>
  );
}

function DivergenciasSection({
  fechamentos,
}: {
  fechamentos: Array<{
    id: string;
    data: Date;
    diferenca: Prisma.Decimal;
    usuario: { id: string; nome: string };
  }>;
}) {
  const perUser = new Map<
    string,
    {
      nome: string;
      total: number;
      comDivergencia: number;
      somaAbs: Prisma.Decimal;
      somaPos: Prisma.Decimal;
      somaNeg: Prisma.Decimal;
    }
  >();

  for (const f of fechamentos) {
    const existing =
      perUser.get(f.usuario.id) ??
      {
        nome: f.usuario.nome,
        total: 0,
        comDivergencia: 0,
        somaAbs: new Prisma.Decimal(0),
        somaPos: new Prisma.Decimal(0),
        somaNeg: new Prisma.Decimal(0),
      };

    existing.total += 1;
    if (!f.diferenca.isZero()) existing.comDivergencia += 1;
    existing.somaAbs = existing.somaAbs.plus(f.diferenca.abs());
    if (f.diferenca.greaterThan(0)) existing.somaPos = existing.somaPos.plus(f.diferenca);
    if (f.diferenca.lessThan(0)) existing.somaNeg = existing.somaNeg.plus(f.diferenca);

    perUser.set(f.usuario.id, existing);
  }

  const ranking = Array.from(perUser.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.somaAbs.comparedTo(a.somaAbs));

  return (
    <section className={styles.card}>
      <h2 className={styles.h2}>Ranking de Divergências de Caixa</h2>
      {ranking.length === 0 ? (
        <div className={styles.meta}>Nenhum fechamento registrado no período.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Fechamentos</th>
                <th>Com Divergência</th>
                <th>Soma Absoluta</th>
                <th>Sobras (+)</th>
                <th>Faltas (-)</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.nome}</td>
                  <td>{r.total}</td>
                  <td>
                    {r.comDivergencia > 0 ? (
                      <span className={styles.pill} style={{ color: "#fde047" }}>
                        {r.comDivergencia}
                      </span>
                    ) : (
                      <span className={styles.pill} style={{ opacity: 0.5 }}>
                        0
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: "bold" }}>{formatCurrency(r.somaAbs)}</td>
                  <td className={styles.textSuccess}>{formatCurrency(r.somaPos)}</td>
                  <td className={styles.textError}>{formatCurrency(r.somaNeg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
