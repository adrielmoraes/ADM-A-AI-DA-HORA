"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireFuncionario } from "@/lib/require-user";
import { parseDateOnly } from "@/lib/date";

type ActionState = { ok: boolean; message: string } | null;

function asDecimal(value: string) {
  const normalized = value.replace(",", ".").trim();
  return new Prisma.Decimal(normalized);
}

export async function criarClienteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireFuncionario();

  try {
    const nome = String(formData.get("nome") ?? "").trim();
    const telefone = String(formData.get("telefone") ?? "").trim();
    if (!nome) return { ok: false, message: "Informe o nome do cliente." };

    await prisma.clienteFiado.create({
      data: {
        nome,
        telefone: telefone || null,
      },
    });

    return { ok: true, message: "Cliente criado." };
  } catch {
    return { ok: false, message: "Falha ao criar cliente." };
  }
}

export async function registrarCompraAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireFuncionario();

  try {
    const dataStr = String(formData.get("data") ?? "").trim();
    const clienteId = String(formData.get("clienteId") ?? "").trim();
    const valorStr = String(formData.get("valor") ?? "").trim();
    const litrosStr = String(formData.get("litros") ?? "").trim();
    if (!clienteId || !valorStr) return { ok: false, message: "Informe cliente e valor." };
    if (!session.turnoId) return { ok: false, message: "Turno não encontrado. Faça login novamente." };

    const data = dataStr ? parseDateOnly(dataStr) : new Date();
    const valor = asDecimal(valorStr);
    const litros = litrosStr ? asDecimal(litrosStr) : null;

    await prisma.$transaction(async (tx) => {
      const venda = await tx.venda.create({
        data: {
          tipo: "FIADO",
          valor,
          litros,
          data,
          usuarioId: session.userId,
          turnoId: session.turnoId,
          clienteFiadoId: clienteId,
        },
        select: { id: true },
      });

      await tx.fiadoLancamento.create({
        data: {
          clienteId,
          tipo: "COMPRA",
          valor,
          vendaId: venda.id,
          data,
          usuarioId: session.userId,
        },
      });

      await tx.clienteFiado.update({
        where: { id: clienteId },
        data: {
          saldoDevedor: { increment: valor },
          quitadoEm: null,
        },
      });
    });

    return { ok: true, message: "Compra registrada no fiado." };
  } catch {
    return { ok: false, message: "Falha ao registrar compra." };
  }
}

export async function registrarPagamentoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireFuncionario();

  try {
    const dataStr = String(formData.get("data") ?? "").trim();
    const clienteId = String(formData.get("clienteId") ?? "").trim();
    const valorStr = String(formData.get("valor") ?? "").trim();
    if (!clienteId || !valorStr) return { ok: false, message: "Informe cliente e valor." };

    const data = dataStr ? parseDateOnly(dataStr) : new Date();
    const valor = asDecimal(valorStr);

    const result = await prisma.$transaction(async (tx) => {
      const cliente = await tx.clienteFiado.findUnique({
        where: { id: clienteId },
        select: { saldoDevedor: true },
      });
      if (!cliente) throw new Error("Cliente não encontrado");
      if (valor.greaterThan(cliente.saldoDevedor)) {
        return { ok: false as const, message: "Pagamento maior que o saldo devedor." };
      }

      await tx.fiadoLancamento.create({
        data: {
          clienteId,
          tipo: "PAGAMENTO",
          valor,
          data,
          usuarioId: session.userId,
          marcadoComoPago: true,
          pagoEm: data,
        },
      });

      const novoSaldo = cliente.saldoDevedor.minus(valor);
      const quitado = novoSaldo.isZero();
      await tx.clienteFiado.update({
        where: { id: clienteId },
        data: {
          saldoDevedor: novoSaldo,
          quitadoEm: quitado ? data : null,
        },
      });

      if (quitado) {
        await tx.fiadoLancamento.updateMany({
          where: { clienteId, tipo: "COMPRA", marcadoComoPago: false },
          data: { marcadoComoPago: true, pagoEm: data },
        });
      }

      return { ok: true as const, message: "Pagamento registrado." };
    });

    return result;
  } catch {
    return { ok: false, message: "Falha ao registrar pagamento." };
  }
}
