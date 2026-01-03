"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import styles from "./fiado.module.css";
import { criarClienteAction, registrarCompraAction, registrarPagamentoAction } from "./actions";

type ActionState = { ok: boolean; message: string } | null;

function todayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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

function useResetForm(state: ActionState) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);
  return formRef;
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
  const clienteRef = useResetForm(clienteState);
  const compraRef = useResetForm(compraState);
  const pagamentoRef = useResetForm(pagamentoState);

  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    const states = [clienteState, compraState, pagamentoState].filter(Boolean) as Array<
      Exclude<ActionState, null>
    >;
    const last = states[states.length - 1] ?? null;
    if (!last) return;
    setToast({ ok: last.ok, message: last.message });
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [clienteState, compraState, pagamentoState]);

  return (
    <div className={styles.grid}>
      {toast ? (
        <div className={styles.toastWrap}>
          <div className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>
            {toast.message}
          </div>
        </div>
      ) : null}
      <section className={styles.card}>
        <h2 className={styles.h2}>Novo cliente</h2>
        <form ref={clienteRef} className={styles.form} action={clienteAction}>
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
        <form ref={compraRef} className={styles.form} action={compraAction}>
          <label className={styles.label}>
            Data
            <input name="data" className={styles.input} type="date" defaultValue={todayDateInputValue()} />
          </label>
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
        <form ref={pagamentoRef} className={styles.form} action={pagamentoAction}>
          <label className={styles.label}>
            Data
            <input name="data" className={styles.input} type="date" defaultValue={todayDateInputValue()} />
          </label>
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
