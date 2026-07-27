const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatSignedCurrency(value: number): string {
  const absoluteValue = currencyFormatter.format(Math.abs(value));

  if (value > 0) {
    return `+ ${absoluteValue}`;
  }

  if (value < 0) {
    return `- ${absoluteValue}`;
  }

  return absoluteValue;
}

export function formatPercentage(value: number): string {
  return `${percentageFormatter.format(value)}%`;
}

export function formatShortDate(value: string): string {
  return shortDateFormatter.format(new Date(`${value}T12:00:00Z`));
}
