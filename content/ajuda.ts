export const helpContent = {
  heading: {
    eyebrow: "Central de suporte local",
    title: "Ajuda e primeiros passos",
    description: "Encontre orientações sobre organização financeira, segurança, backups, atualizações e atalhos do FinnacialUX Desktop.",
  },
  categories: [
    {
      id: "primeiros-passos",
      title: "Primeiros passos",
      description: "Configure contas, registre lançamentos e organize o mês financeiro.",
      items: [
        ["Crie suas contas", "Cadastre conta corrente, carteira, poupança ou investimento em Contas."],
        ["Registre entradas e saídas", "Use Lançamentos para manter o saldo e os relatórios atualizados."],
        ["Planeje compromissos", "Contas a pagar, recebimentos e calendário ajudam a antecipar o fluxo de caixa."],
      ],
    },
    {
      id: "seguranca",
      title: "Segurança local",
      description: "Entenda como senha, PIN, Stronghold e SQLCipher protegem este computador.",
      items: [
        ["Banco criptografado", "O banco local é protegido integralmente por SQLCipher."],
        ["PIN e bloqueio", "Ative um PIN e defina o tempo de inatividade em Configurações → Segurança."],
        ["Ações sensíveis", "Exportações, restaurações e troca de chave podem exigir confirmação da senha."],
      ],
    },
    {
      id: "backups",
      title: "Backups e recuperação",
      description: "Crie cópias verificadas e restaure seus dados com segurança.",
      items: [
        ["Backup manual", "Use Ctrl + B ou Configurações → Backups para escolher o destino da cópia."],
        ["Backups automáticos", "Defina frequência e retenção para manter cópias periódicas."],
        ["Restauração protegida", "O arquivo é validado antes de substituir o banco atual e uma cópia preventiva é criada."],
      ],
    },
    {
      id: "atualizacoes",
      title: "Atualizações assinadas",
      description: "Mantenha o aplicativo atualizado sem comprometer os dados locais.",
      items: [
        ["Canal estável", "O FinnacialUX consulta apenas o manifesto oficial configurado."],
        ["Assinatura obrigatória", "Pacotes sem a assinatura correta são rejeitados pelo atualizador."],
        ["Backup pré-atualização", "Uma cópia criptografada pode ser criada antes de instalar cada versão."],
      ],
    },
  ],
  shortcuts: [
    ["Ctrl + K", "Abrir a central de comandos"],
    ["Ctrl + N", "Criar novo lançamento"],
    ["Ctrl + F", "Buscar páginas e ações"],
    ["Ctrl + S", "Salvar alterações da tela atual"],
    ["Ctrl + B", "Criar backup criptografado"],
    ["Ctrl + L", "Bloquear o aplicativo"],
    ["Ctrl + ,", "Abrir configurações desktop"],
    ["Ctrl + Shift + E", "Abrir exportação de dados"],
    ["F1", "Abrir esta central de ajuda"],
    ["Esc", "Fechar diálogo, menu ou central de comandos"],
  ],
} as const;
