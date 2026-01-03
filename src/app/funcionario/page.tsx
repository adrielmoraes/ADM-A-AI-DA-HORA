import { requireFuncionario } from "@/lib/require-user";
import { logoutAction } from "@/app/login/actions";
import { prisma } from "@/lib/db";
import { Prisma, TipoVenda } from "@prisma/client";
import { parseDateOnly } from "@/lib/date";
import styles from "./funcionario.module.css";
import { FuncionarioForms } from "./FuncionarioForms";

function todayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function FuncionarioPage() {
  const session = await requireFuncionario();
  const today = todayDateInputValue();
  const todayDate = parseDateOnly(today);

  const [configToday, producaoAgg, vendasPorTipo, fiadoComprasAgg, fiadoManualAgg] =
    await Promise.all([
      prisma.configFinanceira.findFirst({
        where: { effectiveFrom: { lte: todayDate } },
        orderBy: { effectiveFrom: "desc" },
        select: { precoLitroVenda: true },
      }),
      prisma.producao.aggregate({
        where: { turnoId: session.turnoId },
        _sum: { litrosGerados: true },
      }),
      prisma.venda.groupBy({
        by: ["tipo"],
        where: { turnoId: session.turnoId, tipo: { in: ["PIX", "CARTAO", "DINHEIRO", "ENTREGA"] } },
        _sum: { valor: true },
      }),
      prisma.fiadoLancamento.aggregate({
        where: { tipo: "COMPRA", venda: { turnoId: session.turnoId } },
        _sum: { valor: true },
      }),
      prisma.venda.aggregate({
        where: { turnoId: session.turnoId, tipo: "FIADO", clienteFiadoId: null },
        _sum: { valor: true },
      }),
    ]);

  const zero = new Prisma.Decimal(0);
  const precoLitro = configToday?.precoLitroVenda ?? null;
  const litrosGerados = producaoAgg._sum.litrosGerados ?? zero;

  const vendasMap = new Map<TipoVenda, { valor: Prisma.Decimal }>();
  for (const row of vendasPorTipo) {
    vendasMap.set(row.tipo, {
      valor: row._sum.valor ?? zero,
    });
  }

  const valorPix = vendasMap.get("PIX")?.valor ?? zero;
  const valorCartao = vendasMap.get("CARTAO")?.valor ?? zero;
  const valorDinheiro = vendasMap.get("DINHEIRO")?.valor ?? zero;
  const valorEntrega = vendasMap.get("ENTREGA")?.valor ?? zero;

  const fiadoCompras = fiadoComprasAgg._sum.valor ?? zero;
  const fiadoManual = fiadoManualAgg._sum.valor ?? zero;
  const valorFiado = fiadoCompras.plus(fiadoManual);

  const valorVendasRecebidas = valorPix.plus(valorCartao).plus(valorDinheiro).plus(valorEntrega);
  const valorVendasTotal = valorVendasRecebidas.plus(valorFiado);

  const valorProducao = precoLitro ? litrosGerados.mul(precoLitro) : null;
  const faltaParaFechar =
    valorProducao ? valorProducao.minus(valorVendasTotal) : null;
  const faltaAbs = faltaParaFechar ? faltaParaFechar.abs() : null;
  const faltaIsZero = faltaParaFechar ? faltaParaFechar.isZero() : false;
  const faltaIsNegative = faltaParaFechar ? faltaParaFechar.isNegative() : false;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {session.nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className={styles.title}>Painel do Funcionário</h1>
            <div className={styles.meta}>Logado como {session.nome}</div>
          </div>
        </div>
        
        <div className={styles.headerActions}>
          <a className={`${styles.button} ${styles.outline}`} href="/funcionario/fiado">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            Fiado
          </a>
          <form action={logoutAction}>
            <button className={`${styles.button} ${styles.danger}`} type="submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sair
            </button>
          </form>
        </div>
      </header>

      <section className={`${styles.card} ${styles.summaryCard}`}>
        <div className={styles.cardHeader}>
          <div className={styles.iconBox} style={{ background: "rgba(74, 222, 128, 0.15)", color: "#4ade80" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v22"></path>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div>
            <h2 className={styles.h2}>Resumo do Caixa (Turno Atual)</h2>
            <div className={styles.meta}>
              Produção × Preço do dia · Vendas (Pix/Cartão/Dinheiro/Entrega) · Fiado
            </div>
          </div>
        </div>

        {!precoLitro ? (
          <div className={styles.err}>Preço por litro não configurado (admin).</div>
        ) : (
          <>
            <div className={styles.summaryTop}>
              <div className={styles.summaryMain}>
                <div className={styles.summaryLabel}>
                  {faltaIsZero ? "Caixa fechado" : faltaIsNegative ? "Sobrando" : "Faltando"}
                </div>
                <div
                  className={styles.summaryValue}
                  style={{
                    color: faltaIsZero ? "#4ade80" : faltaIsNegative ? "#4ade80" : "#fca5a5",
                  }}
                >
                  R$ {faltaAbs ? faltaAbs.toFixed(2) : "0.00"}
                </div>
                <div className={styles.meta} style={{ fontSize: 12 }}>
                  Baseado em litros produzidos no turno (sem descontar sobra).
                </div>
              </div>

              <div className={styles.summaryGrid}>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Preço do litro</div>
                  <div className={styles.kpiValue}>R$ {precoLitro.toFixed(2)}</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Produção (litros)</div>
                  <div className={styles.kpiValue}>{litrosGerados.toFixed(3)}</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Produção (R$)</div>
                  <div className={styles.kpiValue}>R$ {valorProducao ? valorProducao.toFixed(2) : "0.00"}</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Vendas totais (R$)</div>
                  <div className={styles.kpiValue}>R$ {valorVendasTotal.toFixed(2)}</div>
                  <div className={styles.kpiSub}>
                    Recebidas: R$ {valorVendasRecebidas.toFixed(2)} · Fiado: R$ {valorFiado.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <FuncionarioForms
        defaultDate={today}
        initialPrecoLitro={precoLitro ? precoLitro.toNumber() : null}
        litrosNoTurno={litrosGerados.toNumber()}
        vendasTotalNoTurno={valorVendasTotal.toNumber()}
      />
    </main>
  );
}
