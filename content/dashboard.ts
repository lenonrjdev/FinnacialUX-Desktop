import type { NavigationGroup } from "@/types/navigation";

export const dashboardNavigation: NavigationGroup[] = [
  {
    label: "Organização",
    items: [
      { label: "Visão geral", href: "/visao-geral", icon: "dashboard" },
      { label: "Lançamentos", href: "/lancamentos", icon: "transactions" },
      { label: "Contas", href: "/contas", icon: "accounts" },
      { label: "Cartões", href: "/cartoes", icon: "credit-card" },
      { label: "Contas a pagar", href: "/contas-a-pagar", icon: "bills" },
      { label: "Recebimentos", href: "/recebimentos", icon: "income" },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { label: "Calendário", href: "/calendario", icon: "calendar" },
      { label: "Orçamentos", href: "/orcamentos", icon: "budget" },
      { label: "Metas", href: "/metas", icon: "target" },
      { label: "Dívidas", href: "/dividas", icon: "debt" },
      { label: "Assinaturas", href: "/assinaturas", icon: "subscription" },
    ],
  },
  {
    label: "Análises",
    items: [
      { label: "Relatórios", href: "/relatorios", icon: "reports" },
      { label: "Dados e automações", href: "/dados-e-automacoes", icon: "data-tools" },
    ],
  },
  {
    label: "Conta",
    items: [
      { label: "Pessoas e acessos", href: "/acessos", icon: "access" },
      { label: "Configurações", href: "/configuracoes", icon: "settings" },
    ],
  },
];

export const dashboardContent = {
  brand: {
    name: "FinnacialUX",
    homeAriaLabel: "Ir para a visão geral da FinnacialUX",
  },
  accessibility: {
    desktopNavigation: "Navegação principal",
    mobileNavigation: "Navegação móvel",
    openNavigation: "Abrir navegação",
    closeNavigation: "Fechar navegação",
    theme: "Alternar tema",
    workspaceMenu: "Selecionar espaço financeiro",
    accountMenu: "Abrir menu da conta",
  },
  topbar: {
    context: "Período atual",
    newEntry: "Novo lançamento",
    mobileNewEntry: "Lançamento",
    readOnly: "Somente leitura",
    workspaceLabel: "Espaço financeiro",
    manageAccess: "Gerenciar pessoas e acessos",
  },
  accountMenu: {
    account: "Minha conta",
    manageAccess: "Pessoas e acessos",
    settings: "Configurações",
    logout: "Sair",
    demo: "Sessão demonstrativa",
  },
  footer: {
    copyright: "© 2026 FinnacialUX",
    privacy: "Dados privados",
    personalUse: "Uso pessoal",
  },
} as const;
