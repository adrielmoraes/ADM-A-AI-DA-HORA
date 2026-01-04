"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/date";
import { requireFuncionario } from "@/lib/require-user";
import { clearSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ActionState =
  | { ok: true; message: string }
  | { ok: false; message: string; blocked?: boolean; details?: Record<string, string> };

function asDecimal(value: string) {
  const normalized = value.replace(",", ".").trim();
  return new Prisma.Decimal(normalized);
}

function todayDateOnly() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return parseDateOnly(`${y}-${m}-${d}`);
}

export async function addProducaoAction(_: ActionState | null, formData: FormData) {
  const session = await requireFuncionario();

  try {
    const dataStr = String(formData.get("data") ?? "").trim();
    const paneirosStr = String(formData.get("paneiros") ?? "").trim();
    const litrosStr = String(formData.get("litrosGerados") ?? "").trim();

    if (!dataStr || !paneirosStr || !litrosStr) {
      return { ok: false, message: "Preencha data, paneiros e litros." };
    }

    const data = parseDateOnly(dataStr);
    const paneiros = Number(paneirosStr);
    if (!Number.isFinite(paneiros) || paneiros < 0) {
      return { ok: false, message: "Paneiros inválido." };
    }

    await prisma.producao.create({
      data: {
        data,
        paneiros,
        litrosGerados: asDecimal(litrosStr),
        usuarioId: session.userId,
        turnoId: session.turnoId,
      },
    });

    revalidatePath("/funcionario");
    revalidatePath("/admin");
    revalidatePath("/admin/relatorios");
    return { ok: true, message: "Produção registrada." };
  } catch {
    return { ok: false, message: "Falha ao registrar produção." };
  }
}

export async function addVendaAction(_: ActionState | null, formData: FormData) {
  const session = await requireFuncionario();

  try {
    const dataStr = String(formData.get("data") ?? "").trim();
    const valorStr = String(formData.get("valor") ?? "").trim();
    const litrosStr = String(formData.get("litros") ?? "").trim();
    const tipo = String(formData.get("tipo") ?? "").trim();

    if (!valorStr || !tipo) return { ok: false, message: "Informe valor e tipo." };

    const data = dataStr ? parseDateOnly(dataStr) : todayDateOnly();
    const litros = litrosStr ? asDecimal(litrosStr) : null;

    await prisma.venda.create({
      data: {
        data,
        valor: asDecimal(valorStr),
        litros,
        tipo: tipo as never,
        usuarioId: session.userId,
        turnoId: session.turnoId,
      },
    });

    revalidatePath("/funcionario");
    revalidatePath("/admin");
    revalidatePath("/admin/relatorios");
    return { ok: true, message: "Venda registrada." };
  } catch {
    return { ok: false, message: "Falha ao registrar venda." };
  }
}

export async function addDespesaAction(_: ActionState | null, formData: FormData) {
  const session = await requireFuncionario();

  try {
    const dataStr = String(formData.get("data") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim();
    const categoria = String(formData.get("categoria") ?? "").trim();
    const valorStr = String(formData.get("valor") ?? "").trim();

    if (!descricao || !categoria || !valorStr) {
      return { ok: false, message: "Informe descrição, categoria e valor." };
    }

    const data = dataStr ? parseDateOnly(dataStr) : todayDateOnly();
    await prisma.despesa.create({
      data: {
        data,
        descricao,
        categoria,
        valor: asDecimal(valorStr),
        usuarioId: session.userId,
        turnoId: session.turnoId,
      },
    });

    revalidatePath("/funcionario");
    revalidatePath("/admin");
    revalidatePath("/admin/relatorios");
    return { ok: true, message: "Despesa registrada (pendente de validação)." };
  } catch {
    return { ok: false, message: "Falha ao registrar despesa." };
  }
}

export async function fecharCaixaAction(_: ActionState | null, formData: FormData) {
  const session = await requireFuncionario();

  try {
    const dataStr = String(formData.get("data") ?? "").trim();
    const sobraLitrosStr = String(formData.get("sobraLitros") ?? "").trim();
    const justificativa = String(formData.get("justificativa") ?? "").trim();

    if (!dataStr || !sobraLitrosStr) {
      return { ok: false, message: "Informe data e sobra (litros)." };
    }

    const data = parseDateOnly(dataStr);
    const turnoId = session.turnoId;

    const result = await prisma.$transaction(async (tx) => {
      const config = await tx.configFinanceira.findFirst({
        where: { effectiveFrom: { lte: data } },
        orderBy: { effectiveFrom: "desc" },
        select: { precoLitroVenda: true },
      });

      if (!config) {
        return { ok: false as const, message: "Preço por litro não configurado (admin)." };
      }

      const producaoAgg = await tx.producao.aggregate({
        where: { turnoId },
        _sum: { litrosGerados: true },
      });

      const [vendasSemFiadoAgg, fiadoComprasAgg, fiadoManualAgg] = await Promise.all([
        tx.venda.aggregate({
          where: { turnoId, tipo: { not: "FIADO" } },
          _sum: { valor: true },
        }),
        tx.fiadoLancamento.aggregate({
          where: { tipo: "COMPRA", venda: { turnoId } },
          _sum: { valor: true },
        }),
        tx.venda.aggregate({
          where: { turnoId, tipo: "FIADO", clienteFiadoId: null },
          _sum: { valor: true },
        }),
      ]);

      const litrosGerados = producaoAgg._sum.litrosGerados ?? new Prisma.Decimal(0);
      const vendasSemFiado = vendasSemFiadoAgg._sum.valor ?? new Prisma.Decimal(0);
      const fiadoCompras = fiadoComprasAgg._sum.valor ?? new Prisma.Decimal(0);
      const fiadoManual = fiadoManualAgg._sum.valor ?? new Prisma.Decimal(0);
      const valorReal = vendasSemFiado.plus(fiadoCompras).plus(fiadoManual);
      const sobraLitros = asDecimal(sobraLitrosStr);

      const valorEsperado = litrosGerados.minus(sobraLitros).mul(config.precoLitroVenda);
      const diferenca = valorReal.minus(valorEsperado);

      if (!diferenca.isZero() && !justificativa) {
        return {
          ok: false as const,
          blocked: true as const,
          message: "Divergência detectada. Informe justificativa para enviar.",
          details: {
            valorEsperado: valorEsperado.toFixed(2),
            valorReal: valorReal.toFixed(2),
            diferenca: diferenca.toFixed(2),
            recebidas: vendasSemFiado.toFixed(2),
            fiado: fiadoCompras.plus(fiadoManual).toFixed(2),
          },
        };
      }

      await Promise.all([
        tx.venda.updateMany({ where: { turnoId, tipo: { not: "FIADO" } }, data: { data } }),
        tx.producao.updateMany({ where: { turnoId }, data: { data } }),
        tx.despesa.updateMany({ where: { turnoId }, data: { data } }),
      ]);

      await tx.fechamentoDiario.create({
        data: {
          data,
          valorEsperado,
          valorReal,
          diferenca,
          sobraLitros,
          justificativa: justificativa || null,
          status: "ENVIADO",
          usuarioId: session.userId,
          turnoId,
        },
      });

      await tx.turno.update({
        where: { id: turnoId },
        data: { closedAt: new Date() },
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;

    await clearSession();
    redirect("/login?ok=fechamento");
  } catch {
    return { ok: false, message: "Falha ao fechar caixa." };
  }
}
