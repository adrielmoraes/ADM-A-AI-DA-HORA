export function parseDateOnly(value: string) {
  const [y, m, d] = value.split("-").map((v) => Number(v));
  if (!y || !m || !d) throw new Error("Data inválida");
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateRangeUtc(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
  return { start, end };
}

export function formatDateInputValue(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysUtc(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function addMonthsUtc(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

export function startOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function startOfWeekUtc(date: Date) {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysUtc(date, diff);
}

export function enumerateDaysUtc(startInclusive: Date, endExclusive: Date) {
  const days: Date[] = [];
  let current = new Date(
    Date.UTC(
      startInclusive.getUTCFullYear(),
      startInclusive.getUTCMonth(),
      startInclusive.getUTCDate(),
    ),
  );
  while (current < endExclusive) {
    days.push(current);
    current = addDaysUtc(current, 1);
  }
  return days;
}
