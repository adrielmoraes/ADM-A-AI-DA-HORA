"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, createSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!nome || !pin) {
    return { ok: false as const, message: "Informe nome e PIN." };
  }

  const user = await prisma.usuario.findUnique({
    where: { nome },
    select: { id: true, nome: true, pinHash: true, cargo: true, ativo: true },
  });

  if (!user?.ativo) {
    return { ok: false as const, message: "Usuário inválido." };
  }

  const ok = await bcrypt.compare(pin, user.pinHash);
  if (!ok) return { ok: false as const, message: "PIN inválido." };

  const turnoAberto = await prisma.turno.findFirst({
    where: { usuarioId: user.id, closedAt: null },
    select: { id: true },
    orderBy: { openedAt: "desc" },
  });

  const turnoId =
    turnoAberto?.id ??
    (
      await prisma.turno.create({
        data: { usuarioId: user.id },
        select: { id: true },
      })
    ).id;

  await createSession({
    userId: user.id,
    nome: user.nome,
    cargo: user.cargo,
    turnoId,
  });

  if (user.cargo === "ADMIN") redirect("/admin");
  redirect("/funcionario");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

