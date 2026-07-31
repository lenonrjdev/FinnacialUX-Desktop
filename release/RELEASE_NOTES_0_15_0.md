# FinnacialUX Desktop 0.15.0

## Rotinas locais e notificações nativas

Esta versão adiciona um agendador totalmente local para vencimentos, riscos, metas, orçamentos, fechamento mensal, backups, resumos semanais e revisão de automações.

### Destaques

- fila persistente no SQLCipher;
- deduplicação diária, semanal e mensal;
- leases para impedir duas execuções simultâneas;
- tentativas com backoff exponencial;
- histórico auditável e erros sanitizados;
- horário silencioso;
- notificações nativas resumidas;
- execução ao abrir e enquanto o aplicativo estiver ativo na bandeja;
- pausa global e execução manual;
- integração com projeções, planejamento, fechamento e backups;
- proteção integral pelo modo somente leitura.

### Segurança financeira

O agendador nunca chama a aplicação das automações. Ele reutiliza somente a simulação e solicita revisão manual quando encontra candidatos.

### Banco de dados

- versão do aplicativo: `0.15.0`;
- schema SQLCipher: `12`;
- novas tabelas: preferências, fila, histórico, caixa de notificações e leases.

### Dependências

Nenhuma dependência npm ou crate Rust foi adicionada.
