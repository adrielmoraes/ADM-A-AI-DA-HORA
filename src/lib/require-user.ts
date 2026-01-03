import { redirect } from "next/navigation";
import { getSession } from "./session";

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.cargo !== "ADMIN") redirect("/funcionario");
  return session;
}

export async function requireFuncionario() {
  const session = await requireUser();
  if (session.cargo !== "FUNCIONARIO") redirect("/admin");
  if (!session.turnoId) redirect("/login");
  return session as typeof session & { turnoId: string };
}
