# Fase 6 — Experiência desktop, desempenho e acessibilidade

Versão: 0.6.0

## Objetivo

Fazer o FinnacialUX se comportar como um aplicativo nativo do Windows, mantendo o funcionamento offline, o banco SQLCipher e todas as proteções implementadas nas fases anteriores.

## Entregas

- Estado da janela persistido entre execuções, incluindo tamanho, posição e maximização.
- Ícone na bandeja do Windows com ações para abrir, bloquear, criar backup e encerrar.
- Opção de fechar para a bandeja sem interromper o aplicativo.
- Inicialização opcional junto com o Windows.
- Notificações nativas com solicitação explícita de permissão.
- Central de comandos acessível por `Ctrl + K`.
- Atalhos para lançamento, busca, salvamento, backup, bloqueio, configurações, exportação e ajuda.
- Página interna de ajuda com pesquisa, atalhos e diagnóstico sanitizado.
- Configurações de acessibilidade para movimento reduzido, contraste, foco, escala do texto e densidade.
- Métricas locais de inicialização, primeiro conteúdo, diagnóstico, banco, backups e espaço disponível.
- Indicadores globais de navegação, mensagens recuperáveis e link para pular ao conteúdo.
- Compatibilidade do fechamento para a bandeja com o instalador de atualizações da Fase 5.

## Novas áreas

```text
Configurações
├── Desktop
│   ├── Fechar para a bandeja
│   ├── Iniciar com o Windows
│   ├── Notificações nativas
│   ├── Métricas locais
│   ├── Pastas técnicas
│   └── Atalhos
└── Acessibilidade
    ├── Reduzir animações
    ├── Aumentar contraste
    ├── Destacar foco
    ├── Interface compacta
    └── Escala de texto

Ajuda
├── Primeiros passos
├── Segurança
├── Backups
├── Atualizações
├── Atalhos
└── Diagnóstico sanitizado
```

## Bandeja do sistema

Quando **Fechar para a bandeja** estiver ativado, o botão de fechar oculta a janela. Para sair completamente, use **Encerrar FinnacialUX** no menu da bandeja. O instalador do updater recebe uma exceção controlada para conseguir encerrar o processo durante uma atualização assinada.

## Atalhos

| Atalho | Ação |
| --- | --- |
| `Ctrl + K` | Central de comandos |
| `Ctrl + N` | Novo lançamento |
| `Ctrl + F` | Busca rápida |
| `Ctrl + S` | Salvar alterações |
| `Ctrl + B` | Criar backup criptografado |
| `Ctrl + L` | Bloquear aplicativo |
| `Ctrl + ,` | Configurações desktop |
| `Ctrl + Shift + E` | Exportar dados |
| `F1` | Ajuda |
| `Esc` | Fechar modal ou menu |

Os atalhos de ação não substituem a digitação em campos de texto.

## Segurança e privacidade

- Nenhuma métrica contém saldos, senhas, PINs ou lançamentos.
- O resumo de suporte mostra apenas versão, sistema, SQLCipher, schema, integridade e quantidade de backups.
- As preferências visuais ficam no armazenamento local do WebView deste computador.
- O autostart é opt-in e pode ser desativado pela mesma interface.
- Notificações são enviadas somente depois de autorização do sistema operacional.
- A Fase 6 não altera migrations, formato do banco, Stronghold ou chaves SQLCipher.

## Validação mínima no Windows

1. Executar `01_CONFIGURAR_DESKTOP.cmd`.
2. Abrir com `02_RODAR_DESKTOP.cmd`.
3. Redimensionar/maximizar, fechar e abrir novamente para validar o estado da janela.
4. Testar o menu da bandeja e encerrar por ele.
5. Ativar/desativar a inicialização com o Windows.
6. Autorizar e testar uma notificação nativa.
7. Validar todos os atalhos e a central de comandos.
8. Testar navegação apenas por teclado e o link “Pular para o conteúdo principal”.
9. Alternar contraste, movimento, foco, densidade e escala do texto.
10. Abrir Ajuda, copiar o resumo técnico e confirmar que não há dados financeiros.
11. Gerar um instalador `0.6.0` e testar a atualização sobre `0.5.0` com os dados preservados.
