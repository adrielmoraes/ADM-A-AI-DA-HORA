"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/date";
import { requireAdmin } from "@/lib/require-user";
import { revalidatePath } from "next/cache";

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
    const quantidadePaneirosStr = String(formData.get("quantidadePaneiros") ?? "").trim();

    if (!effectiveFromStr || !precoStr || !custoStr) {
      return { ok: false, message: "Preencha data, preço e custo." };
    }

    const effectiveFrom = parseDateOnly(effectiveFromStr);
    const existing = await prisma.configFinanceira.findUnique({
      where: { effectiveFrom },
      select: { id: true },
    });

    const custoUnitario = asDecimal(custoStr);
    
    // Removida lógica de multiplicação pela quantidade, pois o custo salvo deve ser unitário.
    // O cálculo total é feito nos relatórios multiplicando este valor pela produção real.
    const custoTotal = custoUnitario;

    if (existing) {
      await prisma.configFinanceira.update({
        where: { effectiveFrom },
        data: {
          precoLitroVenda: asDecimal(precoStr),
          custoPaneiroInsumo: custoTotal,
        },
      });
    } else {
      const prev = await prisma.configFinanceira.findFirst({
        where: { effectiveFrom: { lt: effectiveFrom } },
        orderBy: { effectiveFrom: "desc" },
        select: { aluguelMensal: true, energiaMensal: true },
      });
      await prisma.configFinanceira.create({
        data: {
          effectiveFrom,
          precoLitroVenda: asDecimal(precoStr),
          custoPaneiroInsumo: custoTotal,
          aluguelMensal: prev?.aluguelMensal ?? new Prisma.Decimal(0),
          energiaMensal: prev?.energiaMensal ?? new Prisma.Decimal(0),
          createdById: session.userId,
        },
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/relatorios");
    return { ok: true, message: "Configuração salva." };
  } catch {
    return { ok: false, message: "Falha ao salvar configuração." };
  }
}

export async function upsertFixosAction(_: ActionState | null, formData: FormData) {
  const session = await requireAdmin();

  try {
    const effectiveFromStr = String(formData.get("effectiveFrom") ?? "").trim();
    const aluguelMensalStr = String(formData.get("aluguelMensal") ?? "").trim();
    const energiaMensalStr = String(formData.get("energiaMensal") ?? "").trim();

    if (!effectiveFromStr) return { ok: false, message: "Informe a data de vigência." };

    const effectiveFrom = parseDateOnly(effectiveFromStr);
    const existing = await prisma.configFinanceira.findUnique({
      where: { effectiveFrom },
      select: { id: true },
    });

    if (existing) {
      await prisma.configFinanceira.update({
        where: { effectiveFrom },
        data: {
          aluguelMensal: asDecimalOrZero(aluguelMensalStr),
          energiaMensal: asDecimalOrZero(energiaMensalStr),
        },
      });
    } else {
      const prev = await prisma.configFinanceira.findFirst({
        where: { effectiveFrom: { lt: effectiveFrom } },
        orderBy: { effectiveFrom: "desc" },
        select: { precoLitroVenda: true, custoPaneiroInsumo: true },
      });
      if (!prev) {
        return {
          ok: false,
          message: "Cadastre primeiro o preço/custo (Config) antes dos fixos.",
        };
      }
      await prisma.configFinanceira.create({
        data: {
          effectiveFrom,
          precoLitroVenda: prev.precoLitroVenda,
          custoPaneiroInsumo: prev.custoPaneiroInsumo,
          aluguelMensal: asDecimalOrZero(aluguelMensalStr),
          energiaMensal: asDecimalOrZero(energiaMensalStr),
          createdById: session.userId,
        },
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/relatorios");
    return { ok: true, message: "Custos fixos salvos." };
  } catch {
    return { ok: false, message: "Falha ao salvar custos fixos." };
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

    revalidatePath("/admin");
    revalidatePath("/admin/relatorios");
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

    revalidatePath("/admin");
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

  revalidatePath("/admin");
  revalidatePath("/admin/relatorios");
}
