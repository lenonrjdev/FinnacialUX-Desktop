const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  month: "long",
  year: "numeric",
});

export function getReferenceDate(date = new Date()): string {
  return DATE_FORMATTER.format(date);
}

export function getReferenceMonth(date = new Date()): string {
  return getReferenceDate(date).slice(0, 7);
}

export function getReferencePeriodLabel(date = new Date()): string {
  const label = MONTH_LABEL_FORMATTER.format(date);
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}
