import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-user";
import styles from "../admin.module.css";
import { Prisma } from "@prisma/client";

function formatCurrency(value: number | Prisma.Decimal) {
  const val = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminFiadoPage({
  searchParams,
}: {
  searchParams: { clienteId?: string; q?: string };
}) {
  await requireAdmin();

  const clienteId = searchParams.clienteId?.trim() || "";
  const query = searchParams.q?.trim() || "";

  const clientes = await prisma.clienteFiado.findMany({
    where: {
      ativo: true,
      nome: { contains: query, mode: "insensitive" },
    },
    orderBy: [{ saldoDevedor: "desc" }, { nome: "asc" }],
    select: { id: true, nome: true, telefone: true, saldoDevedor: true, quitadoEm: true },
  });

  const cliente = clienteId
    ? await prisma.clienteFiado.findUnique({
        where: { id: clienteId },
        select: { id: true, nome: true, saldoDevedor: true, quitadoEm: true, telefone: true },
      })
    : null;

  const lancamentos = clienteId
    ? await prisma.fiadoLancamento.findMany({
        where: { clienteId },
        orderBy: { data: "desc" },
        take: 100,
        include: { usuario: { select: { nome: true } }, venda: true },
      })
    : [];

  return (
    <main className={styles.main}>
      <div className={styles.top}>
        <div>
          <div className={styles.title}>Gestão de Fiados</div>
          <div className={styles.meta}>Administração de carteira de clientes</div>
        </div>
        <a className={styles.button} href="/admin">
          Voltar ao Dashboard
        </a>
      </div>

      <div className={styles.fiadoGrid}>
        <section className={styles.card} style={{ height: "fit-content" }}>
          <h2 className={styles.h2}>Clientes</h2>
          <form className={styles.form} style={{ marginBottom: "16px" }}>
            <input
              className={styles.input}
              name="q"
              placeholder="Buscar cliente..."
              defaultValue={query}
              autoComplete="off"
            />
            {clienteId && <input type="hidden" name="clienteId" value={clienteId} />}
          </form>

          <div className={styles.clientList}>
            {clientes.length === 0 ? (
              <div className={styles.meta}>Nenhum cliente encontrado.</div>
            ) : (
              clientes.map((c) => (
                <a
                  key={c.id}
                  href={`/admin/fiado?clienteId=${c.id}${query ? `&q=${query}` : ""}`}
                  className={`${styles.clientItem} ${
                    c.id === clienteId ? styles.clientItemActive : ""
                  }`}
                >
                  <div>
                    <div className={styles.clientName}>{c.nome}</div>
                    <div className={styles.clientMeta}>{c.telefone || "Sem telefone"}</div>
                  </div>
                  <div
                    className={styles.balanceTag}
                    style={{
                      color: c.saldoDevedor.gt(0) ? "#fca5a5" : "#4ade80",
                    }}
                  >
                    {c.saldoDevedor.gt(0)
                      ? formatCurrency(c.saldoDevedor)
                      : "Quitado"}
                  </div>
                </a>
              ))
            )}
          </div>
        </section>

        <section className={styles.card}>
          {!cliente ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "400px",
                opacity: 0.5,
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>👈</div>
              <div>Selecione um cliente ao lado para ver o histórico.</div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "24px",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div>
                  <h2 className={styles.h2} style={{ fontSize: "24px", marginBottom: "4px" }}>
                    {cliente.nome}
                  </h2>
                  <div className={styles.meta}>
                    Telefone: {cliente.telefone || "Não informado"}
                    {cliente.quitadoEm && (
                      <> · Quitado em: {formatDateTime(cliente.quitadoEm)}</>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    background: "rgba(0,0,0,0.3)",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className={styles.meta} style={{ fontSize: "12px" }}>
                    Saldo Devedor
                  </div>
                  <div
                    style={{
                      fontSize: "32px",
                      fontWeight: "700",
                      color: cliente.saldoDevedor.gt(0) ? "var(--error)" : "var(--success)",
                    }}
                  >
                    {formatCurrency(cliente.saldoDevedor)}
                  </div>
                </div>
              </div>

              <h3 className={styles.h2} style={{ fontSize: "16px", marginTop: "32px" }}>
                Histórico de Lançamentos
              </h3>
              {lancamentos.length === 0 ? (
                <div className={styles.meta}>Nenhum lançamento registrado.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Descrição</th>
                        <th>Valor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((l) => (
                        <tr key={l.id}>
                          <td>{formatDateTime(l.data)}</td>
                          <td>
                            {l.tipo === "COMPRA" ? (
                              <span
                                className={styles.pill}
                                style={{
                                  borderColor: "var(--error-border)",
                                  color: "#fca5a5",
                                }}
                              >
                                COMPRA
                              </span>
                            ) : (
                              <span
                                className={styles.pill}
                                style={{
                                  borderColor: "var(--success-border)",
                                  color: "#4ade80",
                                }}
                              >
                                PAGAMENTO
                              </span>
                            )}
                          </td>
                          <td>
                            {l.vendaId ? (
                              <span>Venda #{l.vendaId.slice(-4)}</span>
                            ) : (
                              "Pagamento Avulso"
                            )}
                            <div className={styles.meta} style={{ fontSize: "11px" }}>
                              Atendente: {l.usuario.nome}
                            </div>
                          </td>
                          <td
                            style={{
                              fontWeight: "bold",
                              color: l.tipo === "COMPRA" ? "var(--error)" : "var(--success)",
                            }}
                          >
                            {l.tipo === "COMPRA" ? "-" : "+"} {formatCurrency(l.valor)}
                          </td>
                          <td>
                            {l.tipo === "COMPRA" ? (
                              l.marcadoComoPago ? (
                                <span className={styles.textSuccess}>Pago</span>
                              ) : (
                                <span className={styles.textError}>Pendente</span>
                              )
                            ) : (
                              <span className={styles.textSuccess}>Efetuado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
