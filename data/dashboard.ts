import { getReferencePeriodLabel } from "@/lib/reference-date";

export const dashboardData = {
  currentPeriod: getReferencePeriodLabel(),
  account: {
    name: "Conta pessoal",
    environment: "Ambiente privado",
  },
} as const;
