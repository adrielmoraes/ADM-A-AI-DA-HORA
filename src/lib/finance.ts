import { Prisma } from "@prisma/client";
import { formatDateInputValue } from "./date";

export function dayKey(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return formatDateInputValue(d);
}

export function sumByDay<T extends { data: Date; valor: Prisma.Decimal }>(rows: T[]) {
  const map = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    const key = dayKey(r.data);
    map.set(key, (map.get(key) ?? new Prisma.Decimal(0)).plus(r.valor));
  }
  return map;
}

export function sumPaneirosByDay(rows: { data: Date; paneiros: number }[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = formatDateInputValue(r.data);
    map.set(key, (map.get(key) ?? 0) + r.paneiros);
  }
  return map;
}

export function computeCostsByDay(
  days: Date[],
  configs: { effectiveFrom: Date; custoPaneiroInsumo: Prisma.Decimal }[],
  paneirosByDay: Map<string, number>,
) {
  const costs = new Map<string, Prisma.Decimal>();
  if (configs.length === 0) return costs;
  let idx = 0;
  for (const day of days) {
    const dayKey = formatDateInputValue(day);
    const paneiros = paneirosByDay.get(dayKey) ?? 0;
    if (configs[0].effectiveFrom > day) {
      costs.set(dayKey, new Prisma.Decimal(0));
      continue;
    }
    while (idx + 1 < configs.length && configs[idx + 1].effectiveFrom <= day) idx += 1;
    const costPerPaneiro = configs[idx].custoPaneiroInsumo;
    costs.set(dayKey, costPerPaneiro.mul(paneiros));
  }
  return costs;
}

export function computeFixosByDay(
  days: Date[],
  configs: { effectiveFrom: Date; aluguelMensal: Prisma.Decimal; energiaMensal: Prisma.Decimal }[],
) {
  const fixos = new Map<string, Prisma.Decimal>();
  if (configs.length === 0) return fixos;
  let idx = 0;
  for (const day of days) {
    if (configs[0].effectiveFrom > day) {
      fixos.set(formatDateInputValue(day), new Prisma.Decimal(0));
      continue;
    }
    while (idx + 1 < configs.length && configs[idx + 1].effectiveFrom <= day) idx += 1;
    const daily = configs[idx].aluguelMensal.plus(configs[idx].energiaMensal).div(30);
    fixos.set(formatDateInputValue(day), daily);
  }
  return fixos;
}

export function reduceDecimalMap(map: Map<string, Prisma.Decimal>) {
  return Array.from(map.values()).reduce((acc, v) => acc.plus(v), new Prisma.Decimal(0));
}

export function lucro(
  entradas: Prisma.Decimal,
  despesas: Prisma.Decimal,
  custos: Prisma.Decimal,
  fixos: Prisma.Decimal,
) {
  return entradas.minus(despesas).minus(custos).minus(fixos);
}
