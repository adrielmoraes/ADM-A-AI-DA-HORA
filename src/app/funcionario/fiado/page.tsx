import { prisma } from "@/lib/db";
import { requireFuncionario } from "@/lib/require-user";
import styles from "./fiado.module.css";
import { FiadoForms } from "./ui";

export default async function FiadoPage({
  searchParams,
}: {
  searchParams: { clienteId?: string };
}) {
  const session = await requireFuncionario();
  const clienteId = searchParams.clienteId ?? null;

  const clientes = await prisma.clienteFiado.findMany({
    where: { ativo: true },
    orderBy: [{ saldoDevedor: "desc" }, { nome: "asc" }],
    take: 50,
    select: { id: true, nome: true, telefone: true, saldoDevedor: true },
  });

  const clienteSelecionado = clienteId
    ? await prisma.clienteFiado.findUnique({
        where: { id: clienteId },
        select: { id: true, nome: true, saldoDevedor: true },
      })
    : null;

  const lancamentos = clienteId
    ? await prisma.fiadoLancamento.findMany({
        where: { clienteId },
        orderBy: { data: "desc" },
        take: 30,
        include: { usuario: { select: { nome: true } } },
      })
    : [];

  return (
    <main className={styles.main}>
      <div className={styles.top}>
        <div>
          <div className={styles.title}>Fiado</div>
          <div className={styles.meta}>Logado: {session.nome}</div>
        </div>
        <a className={styles.link} href="/funcionario">
          Voltar
        </a>
      </div>

      <FiadoForms
        clientes={clientes.map((c) => ({ ...c, saldoDevedor: c.saldoDevedor.toNumber() }))}
        selectedClienteId={clienteId}
      />

      <section className={styles.card}>
        <h2 className={styles.h2}>Clientes</h2>
        <div className={styles.list}>
          {clientes.map((c) => (
            <a
              key={c.id}
              className={c.id === clienteId ? styles.activeItem : styles.item}
              href={`/funcionario/fiado?clienteId=${c.id}`}
            >
              <div className={styles.itemTop}>
                <span>{c.nome}</span>
                <span>R$ {c.saldoDevedor.toFixed(2)}</span>
              </div>
              <div className={styles.itemBottom}>{c.telefone || "-"}</div>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Histórico</h2>
        {!clienteSelecionado ? (
          <div className={styles.meta}>Selecione um cliente para ver o histórico.</div>
        ) : (
          <>
            <div className={styles.meta}>
              Cliente: {clienteSelecionado.nome} · Saldo: R$ {clienteSelecionado.saldoDevedor.toFixed(2)}
            </div>
            {lancamentos.length === 0 ? (
              <div className={styles.meta}>Sem lançamentos.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l) => (
                    <tr key={l.id}>
                      <td>{l.data.toISOString().slice(0, 10)}</td>
                      <td>{l.tipo}</td>
                      <td>R$ {l.valor.toFixed(2)}</td>
                      <td>{l.usuario.nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </main>
  );
}

