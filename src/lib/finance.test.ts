import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { formatDateInputValue } from "./date";
import { computeCostsByDay, computeFixosByDay, lucro, reduceDecimalMap, sumByDay, sumPaneirosByDay } from "./finance";

describe("finance", () => {
  it("soma valores por dia em UTC", () => {
    const rows = [
      { data: new Date(Date.UTC(2024, 0, 1, 10)), valor: new Prisma.Decimal(10) },
      { data: new Date(Date.UTC(2024, 0, 1, 22)), valor: new Prisma.Decimal(2.5) },
      { data: new Date(Date.UTC(2024, 0, 2, 8)), valor: new Prisma.Decimal(3) },
    ];

    const map = sumByDay(rows);

    expect(map.get("2024-01-01")?.toFixed(2)).toBe("12.50");
    expect(map.get("2024-01-02")?.toFixed(2)).toBe("3.00");
  });

  it("soma paneiros por dia", () => {
    const rows = [
      { data: new Date(Date.UTC(2024, 0, 1, 10)), paneiros: 2 },
      { data: new Date(Date.UTC(2024, 0, 1, 12)), paneiros: 3 },
      { data: new Date(Date.UTC(2024, 0, 2, 9)), paneiros: 1 },
    ];

    const map = sumPaneirosByDay(rows);

    expect(map.get("2024-01-01")).toBe(5);
    expect(map.get("2024-01-02")).toBe(1);
  });

  it("calcula custos por dia com base na vigência", () => {
    const days = [new Date(Date.UTC(2024, 0, 1)), new Date(Date.UTC(2024, 0, 2))];
    const configs = [
      { effectiveFrom: new Date(Date.UTC(2024, 0, 1)), custoPaneiroInsumo: new Prisma.Decimal(80) },
      { effectiveFrom: new Date(Date.UTC(2024, 0, 2)), custoPaneiroInsumo: new Prisma.Decimal(100) },
    ];
    const paneirosByDay = new Map<string, number>([
      [formatDateInputValue(days[0]), 6],
      [formatDateInputValue(days[1]), 2],
    ]);

    const costs = computeCostsByDay(days, configs, paneirosByDay);

    expect(costs.get("2024-01-01")?.toFixed(2)).toBe("480.00");
    expect(costs.get("2024-01-02")?.toFixed(2)).toBe("200.00");
  });

  it("calcula fixos diários por vigência", () => {
    const days = [new Date(Date.UTC(2024, 0, 1))];
    const configs = [
      {
        effectiveFrom: new Date(Date.UTC(2024, 0, 1)),
        aluguelMensal: new Prisma.Decimal(3000),
        energiaMensal: new Prisma.Decimal(600),
      },
    ];

    const fixos = computeFixosByDay(days, configs);

    expect(fixos.get("2024-01-01")?.toFixed(2)).toBe("120.00");
  });

  it("reduz mapas e calcula lucro", () => {
    const map = new Map<string, Prisma.Decimal>([
      ["a", new Prisma.Decimal(10)],
      ["b", new Prisma.Decimal(5.5)],
    ]);
    const total = reduceDecimalMap(map);
    const resultado = lucro(
      new Prisma.Decimal(100),
      new Prisma.Decimal(10),
      new Prisma.Decimal(5),
      new Prisma.Decimal(2),
    );

    expect(total.toFixed(2)).toBe("15.50");
    expect(resultado.toFixed(2)).toBe("83.00");
  });
});
