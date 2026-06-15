export const TZ = "America/Sao_Paulo";

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTS,
  hour: "2-digit",
  minute: "2-digit",
};

const SHORT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
};

const SHORT_DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  ...SHORT_DATE_OPTS,
  hour: "2-digit",
  minute: "2-digit",
};

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", DATE_OPTS);
}

export function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", DATETIME_OPTS);
}

export function fmtDateShort(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", SHORT_DATE_OPTS);
}

export function fmtDateTimeShort(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", SHORT_DATETIME_OPTS);
}

/** Returns today as "YYYY-MM-DD" in Brasília time. Use for API date fields (Asaas nextDueDate, etc.) */
export function todayBrasilia(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

/**
 * Returns the start of a day in Brasília time as a UTC Date object.
 * daysAgo = 0 → start of today in Brasília, 1 → start of yesterday, etc.
 */
export function startOfDayBrasilia(daysAgo = 0): Date {
  const dateStr = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(
    new Date(Date.now() - daysAgo * 86_400_000)
  );
  // dateStr is "YYYY-MM-DD" in Brasília — interpret as Brasília midnight
  return new Date(`${dateStr}T00:00:00-03:00`);
}
