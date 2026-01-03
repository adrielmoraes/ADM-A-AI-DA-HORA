"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/date";
import { requireAdmin } from "@/lib/require-user";

type ActionState = { ok: boolean; message: string };

function asDecimal(value: string) {
  const normalized = value.replace(",", ".").trim();
  return new Prisma.Decimal(normalized);
}

function asDecimalOrZero(value: string) {
  const trimmed = value.replace(",", ".").trim();
  if (!trimmed) return new Prisma.Decimal(0);
  return new Prisma.Decimal(trimmed);
}

export async function upsertConfigAction(_: ActionState | null, formData: FormData) {
  const session = await requireAdmin();

  try {
    const effectiveFromStr = String(formData.get("effectiveFrom") ?? "").trim();
    const precoStr = String(formData.get("precoLitroVenda") ?? "").trim();
    const custoStr = String(formData.get("custoPaneiroInsumo") ?? "").trim();
    const aluguelMensalStr = String(formData.get("aluguelMensal") ?? "").trim();
    const energiaMensalStr = String(formData.get("energiaMensal") ?? "").trim();

    if (!effectiveFromStr || !precoStr || !custoStr) {
      return { ok: false, message: "Preencha data, preço e custo." };
    }

    const effectiveFrom = parseDateOnly(effectiveFromStr);

    await prisma.configFinanceira.upsert({
      where: { effectiveFrom },
      create: {
        effectiveFrom,
        precoLitroVenda: asDecimal(precoStr),
        custoPaneiroInsumo: asDecimal(custoStr),
        aluguelMensal: asDecimalOrZero(aluguelMensalStr),
        energiaMensal: asDecimalOrZero(energiaMensalStr),
        createdById: session.userId,
      },
      update: {
        precoLitroVenda: asDecimal(precoStr),
        custoPaneiroInsumo: asDecimal(custoStr),
        aluguelMensal: asDecimalOrZero(aluguelMensalStr),
        energiaMensal: asDecimalOrZero(energiaMensalStr),
      },
    });

    return { ok: true, message: "Configuração salva." };
  } catch {
    return { ok: false, message: "Falha ao salvar configuração." };
  }
}

export async function lancarDiariaAction(_: ActionState | null, formData: FormData) {
  const session = await requireAdmin();

  try {
    const funcionarioId = String(formData.get("funcionarioId") ?? "").trim();
    const dataStr = String(formData.get("data") ?? "").trim();
    const valorStr = String(formData.get("valor") ?? "").trim();

    if (!funcionarioId || !dataStr || !valorStr) {
      return { ok: false, message: "Informe funcionário, data e valor." };
    }

    const funcionario = await prisma.usuario.findUnique({
      where: { id: funcionarioId },
      select: { id: true, nome: true, cargo: true, ativo: true },
    });
    if (!funcionario || funcionario.cargo !== "FUNCIONARIO" || !funcionario.ativo) {
      return { ok: false, message: "Funcionário inválido." };
    }

    const data = parseDateOnly(dataStr);
    const valor = asDecimal(valorStr);

    await prisma.despesa.create({
      data: {
        data,
        descricao: `Diária - ${funcionario.nome}`,
        categoria: "DIARIA_FUNCIONARIO",
        valor,
        status: "VALIDADA",
        usuarioId: session.userId,
        validadoPorId: session.userId,
        validadoEm: new Date(),
      },
    });

    return { ok: true, message: "Diária lançada e validada." };
  } catch {
    return { ok: false, message: "Falha ao lançar diária." };
  }
}

export async function createUserAction(_: ActionState | null, formData: FormData) {
  await requireAdmin();

  try {
    const nome = String(formData.get("nome") ?? "").trim();
    const pin = String(formData.get("pin") ?? "").trim();
    const cargo = String(formData.get("cargo") ?? "").trim();

    if (!nome || !pin || !cargo) return { ok: false, message: "Preencha nome, PIN e cargo." };

    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.usuario.create({
      data: {
        nome,
        pinHash,
        cargo: cargo as never,
      },
    });

    return { ok: true, message: "Usuário criado." };
  } catch {
    return { ok: false, message: "Falha ao criar usuário (nome pode estar em uso)." };
  }
}

export async function validarDespesaAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!id || (status !== "VALIDADA" && status !== "REJEITADA")) return;

  await prisma.despesa.update({
    where: { id },
    data: {
      status: status as never,
      validadoPorId: session.userId,
      validadoEm: new Date(),
    },
  });
}
