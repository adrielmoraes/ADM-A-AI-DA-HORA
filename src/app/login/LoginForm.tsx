"use client";

import { useFormState, useFormStatus } from "react-dom";
import styles from "./login.module.css";
import { loginAction } from "./actions";

type State = { ok: boolean; message: string } | null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.button} type="submit" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState<State, FormData>(async (_, formData) => {
    const result = await loginAction(formData);
    if (!result) return null;
    return result.ok ? { ok: true, message: "OK" } : { ok: false, message: result.message };
  }, null);

  return (
    <form action={action} className={styles.form}>
      <label className={styles.label}>
        Nome
        <input name="nome" className={styles.input} autoComplete="username" />
      </label>
      <label className={styles.label}>
        PIN
        <input name="pin" className={styles.input} inputMode="numeric" autoComplete="current-password" />
      </label>
      <SubmitButton />
      {state && !state.ok ? <div className={styles.error}>{state.message}</div> : null}
    </form>
  );
}

