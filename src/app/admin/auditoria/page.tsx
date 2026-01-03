import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";
import styles from "../admin.module.css";
import { dateRangeUtc, parseDateOnly } from "@/lib/date";
import { Prisma } from "@prisma/client";

function todayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: { data?: string; usuarioId?: string };
}) {
  await requireAdmin();

  const dataStr = searchParams.data ?? todayDateInputValue();
  const usuarioId = searchParams.usuarioId?.trim() || "";
  const date = parseDateOnly(dataStr);
  const { start, end } = dateRangeUtc(date);

  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, cargo: true },
  });

  const userFilter = usuarioId ? { usuarioId } : {};

  const [configDia, producao, vendas, despesas, fechamentos, turnos] = await Promise.all([
    prisma.configFinanceira.findFirst({
      where: { effectiveFrom: { lte: date } },
      orderBy: { effectiveFrom: "desc" },
      select: { aluguelMensal: true, energiaMensal: true },
    }),
    prisma.producao.findMany({
      where: { data: date, ...userFilter },
      orderBy: { createdAt: "desc" },
      include: { usuario: { select: { nome: true } } },
    }),
    prisma.venda.findMany({
      where: { data: { gte: start, lt: end }, ...userFilter },
      orderBy: { data: "desc" },
      include: {
        usuario: { select: { nome: true } },
        clienteFiado: { select: { nome: true } },
      },
    }),
    prisma.despesa.findMany({
      where: { data: { gte: start, lt: end }, ...userFilter },
      orderBy: { data: "desc" },
      include: { usuario: { select: { nome: true } } },
    }),
    prisma.fechamentoDiario.findMany({
      where: { data: date, ...(usuarioId ? { usuarioId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { usuario: { select: { nome: true } }, turno: true },
    }),
    prisma.turno.findMany({
      where: {
        openedAt: { gte: start, lt: end },
        ...(usuarioId ? { usuarioId } : {}),
      },
      orderBy: { openedAt: "desc" },
      include: { usuario: { select: { nome: true } } },
    }),
  ]);

  const aluguelMensal = configDia?.aluguelMensal ?? new Prisma.Decimal(0);
  const energiaMensal = configDia?.energiaMensal ?? new Prisma.Decimal(0);
  const fixosDia = aluguelMensal.plus(energiaMensal).div(30);

  const despesasValidadas = despesas
    .filter((d) => d.status === "VALIDADA")
    .reduce((acc, d) => acc.plus(d.valor), new Prisma.Decimal(0));
  const despesasValidadasComFixos = despesasValidadas.plus(fixosDia);

  return (
    <main className={styles.main}>
      <div className={styles.top}>
        <div>
          <div className={styles.title}>Auditoria Diária</div>
          <div className={styles.meta}>Registros detalhados por data e funcionário</div>
        </div>
        <a className={styles.button} href="/admin">
          Voltar
        </a>
      </div>

      <section className={styles.card}>
        <h2 className={styles.h2}>Filtros</h2>
        <form className={styles.form} action="/admin/auditoria" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label className={styles.label}>
            Data
            <input className={styles.input} type="date" name="data" defaultValue={dataStr} />
          </label>
          <label className={styles.label}>
            Funcionário
            <select className={styles.input} name="usuarioId" defaultValue={usuarioId}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.cargo})
                </option>
              ))}
            </select>
          </label>
          <button className={styles.button} type="submit" style={{ alignSelf: 'end', background: 'var(--primary)', color: 'black' }}>
            Filtrar
          </button>
        </form>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.h2}>Fixos do dia (Rateio)</h2>
          <div className={styles.meta}>
            Aluguel/30 + Energia/30 = <span style={{ fontWeight: 700 }}>R$ {fixosDia.toFixed(2)}</span>
          </div>
          <div className={styles.meta} style={{ fontSize: "12px" }}>
            Aluguel mensal: R$ {aluguelMensal.toFixed(2)} · Energia mensal: R$ {energiaMensal.toFixed(2)}
          </div>
          {!configDia ? (
            <div className={styles.meta} style={{ color: "#fca5a5" }}>
              Configure aluguel e energia na Config do Admin.
            </div>
          ) : null}
          {usuarioId ? (
            <div className={styles.meta} style={{ fontSize: "12px", opacity: 0.7 }}>
              Fixos não são filtrados por funcionário.
            </div>
          ) : null}
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>Despesas (Dia)</h2>
          <div className={styles.meta}>
            Validadas: <span style={{ fontWeight: 700, color: "#fca5a5" }}>R$ {despesasValidadas.toFixed(2)}</span>
          </div>
          <div className={styles.meta}>
            Validadas + Fixos:{" "}
            <span style={{ fontWeight: 800, color: "#fca5a5" }}>
              R$ {despesasValidadasComFixos.toFixed(2)}
            </span>
          </div>
        </section>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.h2}>Turnos ({turnos.length})</h2>
          {turnos.length === 0 ? (
            <div className={styles.meta}>Sem turnos no período.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Func.</th>
                  <th>Aberto</th>
                  <th>Fechado</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((t) => (
                  <tr key={t.id}>
                    <td>{t.usuario.nome.split(' ')[0]}</td>
                    <td>{t.openedAt.toISOString().slice(11, 16)}</td>
                    <td>{t.closedAt ? t.closedAt.toISOString().slice(11, 16) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>Produção ({producao.length})</h2>
          {producao.length === 0 ? (
            <div className={styles.meta}>Sem produção na data.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Func.</th>
                  <th>Pan.</th>
                  <th>Litros</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {producao.map((p) => (
                  <tr key={p.id}>
                    <td>{p.usuario.nome.split(' ')[0]}</td>
                    <td>{p.paneiros}</td>
                    <td>{p.litrosGerados.toFixed(1)}</td>
                    <td>{p.createdAt.toISOString().slice(11, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>
      </div>

      <section className={styles.card}>
        <h2 className={styles.h2}>Vendas ({vendas.length})</h2>
        {vendas.length === 0 ? (
          <div className={styles.meta}>Sem vendas no período.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Func.</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Litros</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => (
                <tr key={v.id}>
                  <td>{v.data.toISOString().slice(11, 16)}</td>
                  <td>{v.usuario.nome.split(' ')[0]}</td>
                  <td><span className={styles.pill} style={{ 
                      background: v.tipo === 'FIADO' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                      color: v.tipo === 'FIADO' ? '#c4b5fd' : '#67e8f9',
                      border: 'none'
                  }}>{v.tipo}</span></td>
                  <td>{v.clienteFiado?.nome || "-"}</td>
                  <td>{v.litros ? v.litros.toFixed(1) : "-"}</td>
                  <td style={{ color: '#4ade80', fontWeight: '600' }}>R$ {v.valor.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
            <h2 className={styles.h2}>Despesas ({despesas.length})</h2>
            {despesas.length === 0 ? (
            <div className={styles.meta}>Sem despesas no período.</div>
            ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
                <thead>
                <tr>
                    <th>Func.</th>
                    <th>Desc.</th>
                    <th>Status</th>
                    <th>Valor</th>
                </tr>
                </thead>
                <tbody>
                {despesas.map((d) => (
                    <tr key={d.id}>
                    <td>{d.usuario.nome.split(' ')[0]}</td>
                    <td>{d.descricao}</td>
                    <td>
                        <span className={styles.pill} style={{
                            background: d.status === 'VALIDADA' ? 'rgba(34, 197, 94, 0.2)' : 
                                      d.status === 'REJEITADA' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                            color: d.status === 'VALIDADA' ? '#86efac' : 
                                   d.status === 'REJEITADA' ? '#fca5a5' : '#fde047',
                            border: 'none'
                        }}>{d.status[0]}</span>
                    </td>
                    <td style={{ color: '#fca5a5', fontWeight: '600' }}>R$ {d.valor.toFixed(2)}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
            )}
        </section>

        <section className={styles.card}>
            <h2 className={styles.h2}>Fechamentos ({fechamentos.length})</h2>
            {fechamentos.length === 0 ? (
            <div className={styles.meta}>Sem fechamentos na data.</div>
            ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
                <thead>
                <tr>
                    <th>Func.</th>
                    <th>Real</th>
                    <th>Dif.</th>
                </tr>
                </thead>
                <tbody>
                {fechamentos.map((f) => (
                    <tr key={f.id}>
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
