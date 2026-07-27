import type { OverviewIconName, SummaryCardId, SummaryTone, TransactionKind } from "@/types/overview";

export const overviewData = {
  currentMonth: "",
  availableAfterCommitments: 0,
  summaryCards: {
    balance: { value: 0, helper: "Nenhuma conta cadastrada", trend: "", tone: "neutral" },
    income: { value: 0, helper: "Nenhuma receita registrada", trend: "", tone: "neutral" },
    expenses: { value: 0, helper: "Nenhuma despesa registrada", trend: "", tone: "neutral" },
    pending: { value: 0, helper: "Nenhuma conta pendente", trend: "", tone: "neutral" },
  } satisfies Record<SummaryCardId, { value: number; helper: string; trend: string; tone: SummaryTone }>,
  cashFlowSummary: { income: 0, expense: 0, result: 0 },
  cashFlowChart: [] as Array<{ month: string; income: number; expense: number }>,
  monthlyPanel: {
    balance: 0,
    retainedPercentage: 0,
    budgetUsed: 0,
    budgetUsedPercentage: 0,
    budgetAvailable: 0,
    goal: { name: "Nenhuma meta cadastrada", current: 0, target: 0, percentage: 0 },
  },
  bills: [] as Array<{ id: string; title: string; date: string; value: number; status: string }>,
  transactions: [] as Array<{
    id: string;
    title: string;
    category: string;
    date: string;
    value: number;
    icon: OverviewIconName;
    kind: TransactionKind;
  }>,
} as const;
