export const moduleContent = {
  lancamentos: {
    title: "Lançamentos",
    description: "Registre receitas, despesas, transferências e movimentações financeiras.",
  },
  contas: {
    title: "Contas",
    description: "Organize contas bancárias, carteiras digitais e dinheiro em espécie.",
  },
  cartoes: {
    title: "Cartões",
    description: "Acompanhe limites, faturas, vencimentos e compras parceladas.",
  },
  "contas-a-pagar": {
    title: "Contas a pagar",
    description: "Controle vencimentos, recorrências e compromissos pendentes.",
  },
  recebimentos: {
    title: "Recebimentos",
    description: "Acompanhe valores recebidos, previstos e atrasados.",
  },
  calendario: {
    title: "Calendário",
    description: "Visualize vencimentos, entradas e compromissos financeiros por data.",
  },
  orcamentos: {
    title: "Orçamentos",
    description: "Defina limites por categoria e acompanhe o consumo mensal.",
  },
  metas: {
    title: "Metas",
    description: "Planeje reservas, compras e objetivos financeiros pessoais.",
  },
  dividas: {
    title: "Dívidas",
    description: "Organize parcelas, empréstimos e o planejamento de quitação.",
  },
  assinaturas: {
    title: "Assinaturas",
    description: "Centralize serviços recorrentes e custos mensais ou anuais.",
  },
  relatorios: {
    title: "Relatórios",
    description: "Analise receitas, despesas, categorias e evolução do saldo.",
  },
  "dados-e-automacoes": {
    title: "Dados e automações",
    description: "Importe extratos, exporte informações e crie regras automáticas.",
  },
  configuracoes: {
    title: "Configurações",
    description: "Personalize categorias, preferências, privacidade e dados da conta.",
  },
} as const;

export const modulePlaceholderContent = {
  eyebrow: "Próxima etapa do projeto",
  cardTitle: "Módulo preparado na navegação",
  cardDescription:
    "Esta área será implementada em uma fase própria, mantendo o mesmo padrão visual e responsivo da visão geral.",
  status: "Estrutura pronta",
} as const;

export type ModuleSlug = keyof typeof moduleContent;
