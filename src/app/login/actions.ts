"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, createSession } from "@/lib/session";
import { dateRangeUtc } from "@/lib/date";

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
    select: { id: true, openedAt: true },
    orderBy: { openedAt: "desc" },
  });

  const now = new Date();
  const { start, end } = dateRangeUtc(now);
  let turnoId: string;

  if (turnoAberto) {
    const openedAt = turnoAberto.openedAt;
    const openedToday = openedAt >= start && openedAt < end;
    if (openedToday) {
      turnoId = turnoAberto.id;
    } else {
      await prisma.turno.update({
        where: { id: turnoAberto.id },
        data: { closedAt: now },
      });
      turnoId = (
        await prisma.turno.create({
          data: { usuarioId: user.id },
          select: { id: true },
        })
      ).id;
    }
  } else {
    turnoId = (
      await prisma.turno.create({
        data: { usuarioId: user.id },
        select: { id: true },
      })
    ).id;
  }

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
