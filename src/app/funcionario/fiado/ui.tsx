"use client";

import { useFormState, useFormStatus } from "react-dom";
import styles from "./fiado.module.css";
import { criarClienteAction, registrarCompraAction, registrarPagamentoAction } from "./actions";

type ActionState = { ok: boolean; message: string } | null;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={styles.button} type="submit" disabled={pending}>
      {pending ? "Enviando..." : label}
    </button>
  );
}

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <div className={state.ok ? styles.ok : styles.err}>{state.message}</div>;
}

export function FiadoForms({
  clientes,
  selectedClienteId,
}: {
  clientes: { id: string; nome: string; saldoDevedor: number }[];
  selectedClienteId: string | null;
}) {
  const [clienteState, clienteAction] = useFormState<ActionState, FormData>(criarClienteAction, null);
  const [compraState, compraAction] = useFormState<ActionState, FormData>(registrarCompraAction, null);
  const [pagamentoState, pagamentoAction] = useFormState<ActionState, FormData>(
    registrarPagamentoAction,
    null,
  );

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <h2 className={styles.h2}>Novo cliente</h2>
        <form className={styles.form} action={clienteAction}>
          <label className={styles.label}>
            Nome
            <input name="nome" className={styles.input} />
          </label>
          <label className={styles.label}>
            Telefone
            <input name="telefone" className={styles.input} />
          </label>
          <SubmitButton label="Criar cliente" />
          <Status state={clienteState} />
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Registrar compra</h2>
        <form className={styles.form} action={compraAction}>
          <label className={styles.label}>
            Cliente
            <select name="clienteId" className={styles.input} defaultValue={selectedClienteId ?? ""}>
              <option value="" disabled>
                Selecione...
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Valor (R$)
            <input name="valor" className={styles.input} inputMode="decimal" />
          </label>
          <label className={styles.label}>
            Litros (opcional)
            <input name="litros" className={styles.input} inputMode="decimal" />
          </label>
          <SubmitButton label="Registrar compra" />
          <Status state={compraState} />
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Registrar pagamento</h2>
        <form className={styles.form} action={pagamentoAction}>
          <label className={styles.label}>
            Cliente
            <select name="clienteId" className={styles.input} defaultValue={selectedClienteId ?? ""}>
              <option value="" disabled>
                Selecione...
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Valor (R$)
            <input name="valor" className={styles.input} inputMode="decimal" />
          </label>
          <SubmitButton label="Registrar pagamento" />
          <Status state={pagamentoState} />
        </form>
      </section>
    </div>
  );
}

