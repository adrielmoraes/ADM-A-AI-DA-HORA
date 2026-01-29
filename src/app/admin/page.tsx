import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";
import { logoutAction } from "@/app/login/actions";
import styles from "./admin.module.css";
import { AdminForms } from "./AdminForms";
import { validarDespesaAction } from "./actions";
import { Prisma } from "@prisma/client";
import { computeCostsByDay, computeFixosByDay, sumByDay, sumPaneirosByDay } from "@/lib/finance";
import {
  addDaysUtc,
  dateRangeUtc,
  enumerateDaysUtc,
  formatDateBr,
  parseDateOnly,
  startOfMonthUtc,
} from "@/lib/date";

function todayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function AdminPage() {
  const session = await requireAdmin();
  const today = todayDateInputValue();
  const todayDate = parseDateOnly(today);
  const { start, end } = dateRangeUtc(todayDate);

  const monthStart = startOfMonthUtc(todayDate);
  const monthEnd = addDaysUtc(end, 0);
  const monthDays = enumerateDaysUtc(monthStart, monthEnd);

  const configToday = await prisma.configFinanceira.findFirst({
    where: { effectiveFrom: { lte: todayDate } },
    orderBy: { effectiveFrom: "desc" },
    select: { custoPaneiroInsumo: true, aluguelMensal: true, energiaMensal: true },
  });

  const vendasHojeSemFiado = await prisma.venda.aggregate({
    where: { data: { gte: start, lt: end }, tipo: { not: "FIADO" } },
    _sum: { valor: true },
  });

  const fiadoPagoHoje = await prisma.fiadoLancamento.aggregate({
    where: { data: { gte: start, lt: end }, tipo: "PAGAMENTO" },
    _sum: { valor: true },
  });

  const despesasHoje = await prisma.despesa.aggregate({
    where: {
      data: { gte: start, lt: end },
      status: "VALIDADA",
    },
    _sum: { valor: true },
  });

  const paneirosHoje = await prisma.producao.aggregate({
    where: { data: todayDate },
    _sum: { paneiros: true },
  });

  const [
    funcionarios,
    configsMes,
    vendasMes,
    pagamentosFiadoMes,
    despesasMesValidadas,
    producaoMes,
  ] = await Promise.all([
    prisma.usuario.findMany({
      where: { cargo: "FUNCIONARIO", ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.configFinanceira.findMany({
      where: { effectiveFrom: { lte: todayDate } },
      orderBy: { effectiveFrom: "asc" },
      select: {
        effectiveFrom: true,
        custoPaneiroInsumo: true,
        aluguelMensal: true,
        energiaMensal: true,
      },
    }),
    prisma.venda.findMany({
      where: { data: { gte: monthStart, lt: monthEnd } },
      select: { data: true, valor: true, tipo: true },
    }),
    prisma.fiadoLancamento.findMany({
      where: { data: { gte: monthStart, lt: monthEnd }, tipo: "PAGAMENTO" },
      select: { data: true, valor: true },
    }),
    prisma.despesa.findMany({
      where: { data: { gte: monthStart, lt: monthEnd }, status: "VALIDADA" },
      select: { data: true, valor: true },
    }),
    prisma.producao.findMany({
      where: { data: { gte: monthStart, lt: monthEnd } },
      select: { data: true, paneiros: true },
    }),
  ]);

  const entradasRecebidas = vendasHojeSemFiado._sum.valor ?? new Prisma.Decimal(0);
  const entradasFiadoPago = fiadoPagoHoje._sum.valor ?? new Prisma.Decimal(0);
  const entradas = entradasRecebidas.plus(entradasFiadoPago);
  const despesas = despesasHoje._sum.valor ?? new Prisma.Decimal(0);
  const paneiros = paneirosHoje._sum.paneiros ?? 0;
  const custoPaneiro = configToday?.custoPaneiroInsumo ?? null;
  const custoInsumoTotal = custoPaneiro ? custoPaneiro.mul(paneiros) : new Prisma.Decimal(0);
  const aluguelMensal = configToday?.aluguelMensal ?? new Prisma.Decimal(0);
  const energiaMensal = configToday?.energiaMensal ?? new Prisma.Decimal(0);
  const fixosHoje = aluguelMensal.plus(energiaMensal).div(30);
  const despesasTotaisHoje = despesas.plus(fixosHoje);
  const lucro = entradas.minus(despesasTotaisHoje).minus(custoInsumoTotal);

  const vendasMesSemFiado = vendasMes.filter((v) => v.tipo !== "FIADO");
  const vendasSemFiadoByDay = sumByDay(vendasMesSemFiado);
  const recebimentosFiadoByDayMes = sumByDay(pagamentosFiadoMes);
  const despesasByDayMes = sumByDay(despesasMesValidadas);
  const paneirosByDayMes = sumPaneirosByDay(producaoMes);
  const custosByDayMes = computeCostsByDay(
    monthDays,
    configsMes.map((c) => ({ effectiveFrom: c.effectiveFrom, custoPaneiroInsumo: c.custoPaneiroInsumo })),
    paneirosByDayMes,
  );
  const fixosByDayMes = computeFixosByDay(
    monthDays,
    configsMes.map((c) => ({
      effectiveFrom: c.effectiveFrom,
      aluguelMensal: c.aluguelMensal,
      energiaMensal: c.energiaMensal,
    })),
  );

  const totalVendasSemFiadoMes = Array.from(vendasSemFiadoByDay.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );
  const totalFiadoPagoMes = Array.from(recebimentosFiadoByDayMes.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );
  const totalDespesasMes = Array.from(despesasByDayMes.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );
  const totalCustosMes = Array.from(custosByDayMes.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );
  const totalFixosMes = Array.from(fixosByDayMes.values()).reduce(
    (acc, v) => acc.plus(v),
    new Prisma.Decimal(0),
  );

  const entradasMes = totalVendasSemFiadoMes.plus(totalFiadoPagoMes);
  const lucroMes = entradasMes.minus(totalDespesasMes).minus(totalCustosMes).minus(totalFixosMes);

  const despesasPendentes = await prisma.despesa.findMany({
    where: { status: "PENDENTE" },
    orderBy: { data: "desc" },
    take: 20,
    include: { usuario: { select: { nome: true } } },
  });

  const fechamentos = await prisma.fechamentoDiario.findMany({
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
    take: 20,
    include: { usuario: { select: { nome: true } } },
  });

  return (
    <main className={styles.main}>
      <div className={styles.top}>
        <div>
          <div className={styles.title}>Painel Admin</div>
          <div className={styles.meta}>Bem-vindo, {session.nome}</div>
        </div>
        <div className={styles.actions}>
          <a className={styles.button} href="/admin/auditoria">
            Auditoria
          </a>
          <a className={styles.button} href="/admin/fiado">
            Fiado
          </a>
          <a className={styles.button} href="/admin/relatorios">
            Relatórios
          </a>
          <form action={logoutAction}>
            <button className={styles.button} type="submit" style={{ borderColor: 'var(--error-border)', color: '#fca5a5' }}>
              Sair
            </button>
          </form>
        </div>
      </div>

      {despesasPendentes.length > 0 ? (
        <div className={styles.err}>
          {despesasPendentes.length} despesa(s) pendente(s) aguardando aprovação
        </div>
      ) : null}

      <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '16px' }}>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.meta}>Entradas (Hoje)</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--primary)' }}>R$ {entradas.toFixed(2)}</div>
        </div>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.meta}>Despesas (Hoje)</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#fca5a5' }}>R$ {despesasTotaisHoje.toFixed(2)}</div>
          <div className={styles.meta} style={{ fontSize: '12px' }}>
            Validadas: R$ {despesas.toFixed(2)} · Fixos (rateio): R$ {fixosHoje.toFixed(2)}
          </div>
        </div>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.meta}>Fixos (Rateio Hoje)</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>R$ {fixosHoje.toFixed(2)}</div>
          <div className={styles.meta} style={{ fontSize: '12px' }}>
            Aluguel/30 + Energia/30
          </div>
        </div>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.meta}>Paneiros (Hoje)</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{paneiros}</div>
          {paneiros === 0 ? (
            <div className={styles.meta} style={{ fontSize: '12px', color: '#fca5a5' }}>
              Nenhuma produção registrada hoje
            </div>
          ) : null}
        </div>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--success-border)', background: 'var(--success-bg)' }}>
          <div className={styles.meta} style={{ color: '#86efac' }}>Lucro Estimado (Hoje)</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#4ade80', textShadow: '0 0 20px rgba(74, 222, 128, 0.4)' }}>
            R$ {lucro.toFixed(2)}
          </div>
          <div className={styles.meta} style={{ fontSize: '12px', color: '#bbf7d0' }}>
            Entradas: R$ {entradas.toFixed(2)} · Despesas: R$ {despesasTotaisHoje.toFixed(2)}
            {custoPaneiro ? ` · Insumo: R$ ${custoInsumoTotal.toFixed(2)} (${paneiros} × R$ ${custoPaneiro.toFixed(2)})` : ""}
          </div>
          {!custoPaneiro ? (
            <div style={{ fontSize: '12px', color: '#fca5a5' }}>Sem custo de insumo (paneiro) configurado</div>
          ) : null}
        </div>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid rgba(148,163,184,0.4)', background: 'rgba(15,23,42,0.8)' }}>
          <div className={styles.meta}>Lucro / Prejuízo Acumulado (Mês)</div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: '800',
              color: lucroMes.gte(0) ? '#4ade80' : '#fca5a5',
            }}
          >
            R$ {lucroMes.toFixed(2)}
          </div>
          <div className={styles.meta} style={{ fontSize: '12px', opacity: 0.8 }}>
            Entradas: R$ {entradasMes.toFixed(2)} · Saídas: R$ {totalDespesasMes
              .plus(totalCustosMes)
              .plus(totalFixosMes)
              .toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <AdminForms defaultDate={today} funcionarios={funcionarios} />
           
           <section className={styles.card}>
            <h2 className={styles.h2}>Despesas pendentes</h2>
            {despesasPendentes.length === 0 ? (
              <div className={styles.meta}>Sem despesas pendentes.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Func.</th>
                    <th>Valor</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {despesasPendentes.map((d) => (
                    <tr key={d.id}>
                      <td>{formatDateBr(d.data)}</td>
                      <td>{d.usuario.nome.split(' ')[0]}</td>
                      <td style={{ fontWeight: '600' }}>R$ {d.valor.toFixed(2)}</td>
                      <td>
                        <div className={styles.actions}>
                          <form action={validarDespesaAction}>
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="status" value="VALIDADA" />
                            <button className={styles.smallButton} type="submit" style={{ color: '#4ade80', borderColor: 'var(--success-border)' }}>
                              ✓
                            </button>
                          </form>
                          <form action={validarDespesaAction}>
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="status" value="REJEITADA" />
                            <button className={styles.smallButton} type="submit" style={{ color: '#fca5a5', borderColor: 'var(--error-border)' }}>
                              ✕
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>
        </div>

        <section className={styles.card} style={{ height: 'fit-content' }}>
          <h2 className={styles.h2}>Últimos Fechamentos</h2>
          {fechamentos.length === 0 ? (
            <div className={styles.meta}>Sem fechamentos.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Func.</th>
                  <th>Real</th>
                  <th>Dif.</th>
                </tr>
              </thead>
              <tbody>
                {fechamentos.map((f) => (
                  <tr key={f.id}>
                    <td>{formatDateBr(f.data)}</td>
                    <td>{f.usuario.nome.split(' ')[0]}</td>
                    <td>R$ {f.valorReal.toFixed(2)}</td>
                    <td style={{ 
                      color: f.diferenca.isZero() ? 'inherit' : f.diferenca.isNegative() ? '#fca5a5' : '#4ade80',
                      fontWeight: '600'
                    }}>
                      {f.diferenca.isZero() ? '-' : `R$ ${f.diferenca.toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
