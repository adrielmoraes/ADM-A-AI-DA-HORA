import styles from "./login.module.css";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>AÇAI DA HORA</h1>
        <p className={styles.subtitle}>Entrar</p>
        <LoginForm />
      </div>
    </main>
  );
}
