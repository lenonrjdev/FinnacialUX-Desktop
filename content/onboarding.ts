import type { ContextualHelpTopic, OnboardingStepDefinition } from "@/types/onboarding";

export const onboardingSteps: OnboardingStepDefinition[] = [
  {
    code: "welcome",
    eyebrow: "Comece com clareza",
    title: "Conheça o fluxo do FinnacialUX",
    description: "Entenda como contas, lançamentos, planejamento e proteção trabalham juntos sem enviar seus dados para servidores externos.",
    actionLabel: "Marcar apresentação como vista",
    href: "/visao-geral",
    automatic: false,
  },
  {
    code: "account",
    eyebrow: "Estrutura financeira",
    title: "Cadastre sua primeira conta",
    description: "Adicione conta corrente, carteira, poupança ou investimento. O saldo inicial será a base dos relatórios e fechamentos.",
    actionLabel: "Abrir contas",
    href: "/contas#nova-conta",
    automatic: true,
  },
  {
    code: "first_record",
    eyebrow: "Movimentação inicial",
    title: "Registre ou importe o primeiro movimento",
    description: "Crie um lançamento, uma conta a pagar, um recebimento ou importe um extrato com prévia e conciliação.",
    actionLabel: "Novo lançamento",
    href: "/lancamentos#novo-lancamento",
    automatic: true,
  },
  {
    code: "planning",
    eyebrow: "Próximas decisões",
    title: "Defina um orçamento ou uma meta",
    description: "Organize limites mensais ou escolha um objetivo para transformar registros em decisões financeiras acompanháveis.",
    actionLabel: "Abrir planejamento",
    href: "/orcamentos",
    automatic: true,
  },
  {
    code: "security",
    eyebrow: "Proteção local",
    title: "Revise senha, PIN e bloqueio",
    description: "Confirme que o Stronghold, o SQLCipher e as preferências de bloqueio estão adequados ao uso deste computador.",
    actionLabel: "Abrir segurança",
    href: "/configuracoes#seguranca",
    automatic: true,
  },
  {
    code: "backup",
    eyebrow: "Continuidade",
    title: "Crie o primeiro backup verificado",
    description: "Escolha um local externo ao aplicativo e gere uma cópia criptografada que possa ser validada antes de qualquer restauração.",
    actionLabel: "Abrir backups",
    href: "/configuracoes#backups",
    automatic: true,
  },
];

export const contextualHelpTopics: ContextualHelpTopic[] = [
  {
    id: "overview",
    path: "/visao-geral",
    title: "Como ler a visão geral",
    summary: "A visão geral combina saldos, fluxo do mês, compromissos e sinais que precisam de atenção.",
    steps: [
      "Confira o saldo disponível e o resultado do mês antes de tomar novas decisões.",
      "Use os compromissos próximos para antecipar falta de caixa.",
      "Abra Relatórios quando precisar entender tendências, riscos ou planejamento.",
    ],
    related: [
      { label: "Ver relatórios", href: "/relatorios" },
      { label: "Revisar calendário", href: "/calendario" },
    ],
  },
  {
    id: "transactions",
    path: "/lancamentos",
    title: "Organize seus lançamentos",
    summary: "Entradas, despesas e transferências alimentam saldos, relatórios, projeções e fechamentos.",
    steps: [
      "Use a conta correta para evitar divergências na conciliação.",
      "Mantenha data, categoria e situação coerentes com o movimento real.",
      "Para grandes volumes, prefira importar o extrato e revisar a prévia.",
    ],
    related: [
      { label: "Importar extrato", href: "/conciliacao" },
      { label: "Gerenciar categorias", href: "/orcamentos" },
    ],
  },
  {
    id: "accounts",
    path: "/contas",
    title: "Contas são a base do saldo",
    summary: "Cada conta mantém identidade própria para movimentos, transferências, conciliação e fechamento mensal.",
    steps: [
      "Use nomes reconhecíveis e informe o saldo inicial do dia de início.",
      "Evite excluir contas com histórico; prefira arquivar quando disponível.",
      "Feche cada mês após conciliar o saldo bancário.",
    ],
    related: [
      { label: "Abrir conciliação", href: "/conciliacao" },
      { label: "Ver lançamentos", href: "/lancamentos" },
    ],
  },
  {
    id: "planning",
    path: "/orcamentos",
    title: "Planeje antes de comprometer",
    summary: "Orçamentos definem limites por categoria; metas organizam objetivos e o planejamento conecta ambos às projeções.",
    steps: [
      "Comece com poucas categorias realmente importantes.",
      "Compare o limite planejado com a média dos últimos meses.",
      "Revise desvios antes de aceitar qualquer ajuste sugerido.",
    ],
    related: [
      { label: "Abrir metas", href: "/metas" },
      { label: "Planejamento completo", href: "/relatorios" },
    ],
  },
  {
    id: "reconciliation",
    path: "/conciliacao",
    title: "Concilie sem duplicar",
    summary: "A importação sempre gera uma prévia; nenhuma correspondência é aplicada sem revisão e confirmação.",
    steps: [
      "Escolha a conta do extrato antes de processar o arquivo.",
      "Revise duplicidades e vínculos sugeridos por valor, data e descrição.",
      "Feche o mês apenas quando o saldo calculado coincidir com o banco.",
    ],
    related: [
      { label: "Ver contas", href: "/contas" },
      { label: "Abrir continuidade", href: "/configuracoes#continuidade" },
    ],
  },
  {
    id: "reports",
    path: "/relatorios",
    title: "Transforme dados em decisões",
    summary: "Relatórios, inteligência e planejamento são locais, explicáveis e nunca criam movimentos financeiros automaticamente.",
    steps: [
      "Escolha o período antes de comparar resultados.",
      "Leia riscos junto das premissas usadas na projeção.",
      "Ative planos somente após revisar envelopes, dívidas, metas e checksum.",
    ],
    related: [
      { label: "Revisar orçamento", href: "/orcamentos" },
      { label: "Abrir metas", href: "/metas" },
    ],
  },
  {
    id: "automation",
    path: "/dados-e-automacoes",
    title: "Automação sempre com confirmação",
    summary: "Regras e recorrências simulam alterações primeiro. A aplicação continua sendo uma decisão manual.",
    steps: [
      "Revise a prévia e o número de movimentos que serão afetados.",
      "Use histórico e desfazer quando a operação oferecer reversão protegida.",
      "Exporte um backup antes de operações amplas ou importações externas.",
    ],
    related: [
      { label: "Criar backup", href: "/configuracoes#backups" },
      { label: "Ver rotinas locais", href: "/configuracoes#rotinas" },
    ],
  },
  {
    id: "settings",
    path: "/configuracoes",
    title: "Ajuste o aplicativo com segurança",
    summary: "Configurações concentram aparência, acessibilidade, segurança, backups, desempenho, diagnóstico e atualizações.",
    steps: [
      "Ative PIN e bloqueio automático em computadores compartilhados.",
      "Mantenha ao menos um backup recente fora da pasta de dados do aplicativo.",
      "Use Diagnóstico antes de solicitar suporte ou executar reparos técnicos.",
    ],
    related: [
      { label: "Abrir diagnóstico", href: "/configuracoes#diagnostico" },
      { label: "Abrir acessibilidade", href: "/configuracoes#acessibilidade" },
    ],
  },
];

export const onboardingContent = {
  title: "Primeiros passos",
  description: "Configure o essencial no seu ritmo. O guia observa seus dados reais e nunca cria movimentos automaticamente.",
  completedTitle: "Base financeira preparada",
  completedDescription: "As etapas essenciais foram concluídas. O guia pode ser reiniciado nas configurações quando necessário.",
  skipLabel: "Fazer depois",
  resumeLabel: "Continuar configuração",
  restartLabel: "Reiniciar guia",
  contextualHelpTitle: "Ajuda desta tela",
} as const;
