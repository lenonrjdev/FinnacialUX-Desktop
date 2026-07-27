import type { OverviewIconName, SummaryCardId } from "@/types/overview";

export const overviewContent = {
  heading: {
    eyebrow: "Resumo financeiro",
    title: "Visão geral",
    description:
      "Acompanhe sua vida financeira e os compromissos do mês em um só lugar.",
  },
  availableBalance: {
    label: "Disponível após compromissos",
    periodPrefix: "Até o fim de",
  },
  summary: {
    sectionAriaLabel: "Resumo do mês",
    moreOptionsPrefix: "Mais opções de",
    cards: [
      { id: "balance", label: "Saldo atual", icon: "wallet" },
      { id: "income", label: "Receitas do mês", icon: "income" },
      { id: "expenses", label: "Despesas do mês", icon: "transactions" },
      { id: "pending", label: "Contas pendentes", icon: "bills" },
    ] satisfies Array<{ id: SummaryCardId; label: string; icon: OverviewIconName }>,
  },
  cashFlow: {
    kicker: "Últimos 6 meses",
    title: "Fluxo financeiro",
    period: "Mensal",
    chartAriaLabel: "Comparação de entradas e saídas dos últimos seis meses",
    chartBarTitles: {
      income: "Entradas em",
      expense: "Saídas em",
    },
    summaryLabels: {
      income: "Entradas",
      expense: "Saídas",
      result: "Resultado",
    },
    legend: {
      income: "Entradas",
      expense: "Saídas",
    },
  },
  monthlyPanel: {
    balanceLabel: "Saldo do mês",
    retainedSuffix: "das receitas permaneceu disponível",
    budgetLabel: "Orçamento utilizado",
    budgetAriaSuffix: "do orçamento utilizado",
    budgetAvailableSuffix: "ainda disponíveis no orçamento",
    goalLabel: "Meta principal",
  },
  bills: {
    kicker: "Próximos dias",
    title: "Contas a pagar",
    action: "Ver todas",
    duePrefix: "Vencimento em",
  },
  transactions: {
    kicker: "Movimentações recentes",
    title: "Últimos lançamentos",
    action: "Ver todos",
    completedStatus: "Concluído",
  },
  insight: {
    title: "Seu mês continua positivo.",
    descriptionPrefix: "Depois das contas pendentes, você ainda terá",
    descriptionSuffix:
      "disponíveis para organizar entre gastos, reservas e metas.",
    action: "Ver planejamento",
  },
} as const;
