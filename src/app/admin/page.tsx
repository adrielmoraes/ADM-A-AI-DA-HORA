import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";
import { logoutAction } from "@/app/login/actions";
import styles from "./admin.module.css";
import { AdminForms } from "./AdminForms";
import { validarDespesaAction } from "./actions";
import { Prisma } from "@prisma/client";
import { dateRangeUtc, parseDateOnly } from "@/lib/date";

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

  const configToday = await prisma.configFinanceira.findFirst({
    where: { effectiveFrom: { lte: todayDate } },
    orderBy: { effectiveFrom: "desc" },
    select: { custoPaneiroInsumo: true, aluguelMensal: true, energiaMensal: true },
  });

  const vendasHoje = await prisma.venda.aggregate({
    where: { data: { gte: start, lt: end } },
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

  const funcionarios = await prisma.usuario.findMany({
    where: { cargo: "FUNCIONARIO", ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  const entradas = vendasHoje._sum.valor ?? new Prisma.Decimal(0);
  const despesas = despesasHoje._sum.valor ?? new Prisma.Decimal(0);
  const paneiros = paneirosHoje._sum.paneiros ?? 0;
  const custoPaneiro = configToday?.custoPaneiroInsumo ?? null;
  const custoInsumo = custoPaneiro ? custoPaneiro.mul(paneiros) : null;
  const aluguelMensal = configToday?.aluguelMensal ?? new Prisma.Decimal(0);
  const energiaMensal = configToday?.energiaMensal ?? new Prisma.Decimal(0);
  const fixosHoje = aluguelMensal.plus(energiaMensal).div(30);
  const despesasTotaisHoje = despesas.plus(fixosHoje);
  const lucro = custoInsumo
    ? entradas.minus(despesasTotaisHoje).minus(custoInsumo)
    : entradas.minus(despesasTotaisHoje);

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

      <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '16px' }}>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.meta}>Entradas (Hoje)</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--primary)' }}>R$ {entradas.toFixed(2)}</div>
        </div>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.meta}>Despesas (Hoje)</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#fca5a5' }}>R$ {despesasTotaisHoje.toFixed(2)}</div>
          <div className={styles.meta} style={{ fontSize: '12px' }}>
            Lançadas: R$ {despesas.toFixed(2)} · Fixos (rateio): R$ {fixosHoje.toFixed(2)}
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
        </div>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--success-border)', background: 'var(--success-bg)' }}>
          <div className={styles.meta} style={{ color: '#86efac' }}>Lucro Estimado (Hoje)</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#4ade80', textShadow: '0 0 20px rgba(74, 222, 128, 0.4)' }}>
            R$ {lucro.toFixed(2)}
          </div>
          {!custoPaneiro ? (
            <div style={{ fontSize: '12px', color: '#fca5a5' }}>Sem custo de insumo (paneiro) configurado</div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
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
                      <td>{d.data.toISOString().slice(8, 10)}/{d.data.toISOString().slice(5, 7)}</td>
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
                    <td>{f.data.toISOString().slice(8, 10)}/{f.data.toISOString().slice(5, 7)}</td>
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
