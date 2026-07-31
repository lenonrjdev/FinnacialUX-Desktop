# Fase 17 — Onboarding e experiência final

## Objetivo

Preparar o FinnacialUX Desktop para novos usuários e para o Release Candidate, reduzindo dúvidas sem enfraquecer a segurança local ou automatizar decisões financeiras.

A versão `0.17.0` introduz o schema SQLCipher `14`, usado somente para progresso do guia, preferências de ajuda e eventos técnicos de experiência.

## Princípios

- O guia pode ser adiado, retomado ou reiniciado.
- Nenhum dado financeiro fictício é criado automaticamente.
- Etapas automáticas são concluídas apenas por evidências reais dos documentos locais.
- O modo somente leitura permite consultar o guia, mas bloqueia gravações de progresso.
- A busca global indexa páginas, ações, configurações e ajuda, não saldos ou descrições privadas.
- A ajuda contextual não envia informações para serviços externos.
- Toda navegação permanece acessível por teclado.

## Schema 14

A migration `0014_guided_onboarding_and_contextual_help.sql` cria:

- `onboarding_preferences`;
- `onboarding_steps`;
- `onboarding_events`.

## Etapas guiadas

1. conhecer o fluxo do aplicativo;
2. cadastrar a primeira conta;
3. registrar ou importar o primeiro movimento;
4. definir um orçamento ou uma meta;
5. revisar segurança, PIN e bloqueio;
6. criar o primeiro backup verificado.

## Busca global

A central `Ctrl + K` e a busca `Ctrl + F` passam a:

- pesquisar todas as páginas do menu;
- localizar ações rápidas;
- localizar seções das configurações;
- pesquisar tópicos de ajuda;
- remover acentos durante a busca;
- ordenar correspondências por relevância e histórico local recente.

O histórico fica apenas no `localStorage` do WebView e não contém termos digitados, somente identificadores dos comandos executados.

## Ajuda contextual

- `F1`: ajuda da tela atual;
- `Shift + F1`: central completa de ajuda;
- botão de ajuda na barra superior;
- links relacionados para continuar a tarefa;
- preferência para desativar o painel contextual.

## Aplicação e validação

```powershell
.\18_APLICAR_FASE_17.cmd
.\18_VALIDAR_FASE_17.cmd
```
