"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";
import { createUserAction, lancarDiariaAction, upsertConfigAction, upsertFixosAction } from "./actions";

type ActionState = { ok: boolean; message: string } | null;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={styles.button} type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </button>
  );
}

function Status({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return <div className={state.ok ? styles.ok : styles.err}>{state.message}</div>;
}

export function AdminForms({
  defaultDate,
  funcionarios,
}: {
  defaultDate: string;
  funcionarios: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [configState, configAction] = useFormState<ActionState, FormData>(
    upsertConfigAction,
    null,
  );
  const [fixosState, fixosAction] = useFormState<ActionState, FormData>(upsertFixosAction, null);
  const [userState, userAction] = useFormState<ActionState, FormData>(createUserAction, null);
  const [diariaState, diariaAction] = useFormState<ActionState, FormData>(lancarDiariaAction, null);

  useEffect(() => {
    if (configState?.ok) router.refresh();
  }, [configState, router]);
  useEffect(() => {
    if (fixosState?.ok) router.refresh();
  }, [fixosState, router]);
  useEffect(() => {
    if (userState?.ok) router.refresh();
  }, [userState, router]);
  useEffect(() => {
    if (diariaState?.ok) router.refresh();
  }, [diariaState, router]);

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <h2 className={styles.h2}>Config (Preço/Custos)</h2>
        <form action={configAction} className={styles.form}>
          <label className={styles.label}>
            Vigência
            <input name="effectiveFrom" className={styles.input} type="date" defaultValue={defaultDate} />
          </label>
          <label className={styles.label}>
            Preço por litro (R$)
            <input name="precoLitroVenda" className={styles.input} inputMode="decimal" />
          </label>
          <label className={styles.label}>
            Custo por paneiro (R$)
            <input name="custoPaneiroInsumo" className={styles.input} inputMode="decimal" placeholder="Valor unitário" />
          </label>
          {/* Campo quantidade removido pois o custo deve ser unitário */}
          <SubmitButton label="Salvar configuração" />
          <Status state={configState} />
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Custos Fixos</h2>
        <form action={fixosAction} className={styles.form}>
          <label className={styles.label}>
            Vigência
            <input name="effectiveFrom" className={styles.input} type="date" defaultValue={defaultDate} />
          </label>
          <label className={styles.label}>
            Aluguel mensal do ponto (R$)
            <input name="aluguelMensal" className={styles.input} inputMode="decimal" placeholder="Rateado por 30 dias" />
          </label>
          <label className={styles.label}>
            Energia mensal (R$)
            <input name="energiaMensal" className={styles.input} inputMode="decimal" placeholder="Rateado por 30 dias" />
          </label>
          <SubmitButton label="Salvar custos fixos" />
          <Status state={fixosState} />
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Lançar diária (Funcionário)</h2>
        <form action={diariaAction} className={styles.form}>
          <label className={styles.label}>
            Funcionário
            <select name="funcionarioId" className={styles.input} defaultValue="">
              <option value="" disabled>
                Selecione...
              </option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Data
            <input name="data" className={styles.input} type="date" defaultValue={defaultDate} />
          </label>
          <label className={styles.label}>
            Valor (R$)
            <input name="valor" className={styles.input} inputMode="decimal" />
          </label>
          <SubmitButton label="Lançar diária" />
          <Status state={diariaState} />
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Criar Usuário</h2>
        <form action={userAction} className={styles.form}>
          <label className={styles.label}>
            Nome
            <input name="nome" className={styles.input} autoComplete="username" />
          </label>
          <label className={styles.label}>
            PIN
            <input name="pin" className={styles.input} inputMode="numeric" />
          </label>
          <label className={styles.label}>
            Cargo
            <select name="cargo" className={styles.input} defaultValue="FUNCIONARIO">
              <option value="FUNCIONARIO">Funcionário</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <SubmitButton label="Criar usuário" />
          <Status state={userState} />
        </form>
      </section>
    </div>
  );
}
