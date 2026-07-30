# Fase 10 — Automações financeiras locais

Versão: `0.10.0`
Schema local: `7`

## Objetivo

Transformar as regras simples de importação em um motor financeiro local capaz de simular, aplicar e desfazer alterações com segurança. A fase também adiciona recorrências programadas, alertas de vencimento e histórico reversível, sem depender de nuvem ou serviços externos.

## Entregas

- Central de automações dentro de **Dados e automações**.
- Simulação de regras sobre lançamentos existentes.
- Sugestões conservadoras de categoria baseadas em ao menos dois lançamentos históricos consistentes.
- Modelos de recorrência semanal, mensal, trimestral e anual.
- Geração de lançamentos recorrentes somente após confirmação.
- Alertas locais para contas a pagar, recebimentos e assinaturas.
- Política configurável de janela de alertas e simulação inicial.
- Checksum de origem para impedir aplicação de prévias desatualizadas.
- Aplicação atômica no SQLCipher.
- Snapshot dos módulos afetados em cada execução.
- Desfazer protegido por checksum do estado posterior.
- Bloqueio integral quando o banco estiver em modo somente leitura.
- Migration 7, testes TypeScript e testes Rust do motor.

## Fluxo seguro

1. O usuário cria regras e modelos de recorrência.
2. A central lê os documentos persistidos no SQLCipher.
3. O Rust monta regras, sugestões pelo histórico, recorrências e alertas sem gravar dados.
4. O usuário seleciona as mudanças desejadas.
5. Antes de aplicar, o Rust recalcula o checksum da origem.
6. Se os dados mudaram, a aplicação é recusada e uma nova simulação é exigida.
7. As mudanças selecionadas são gravadas em uma transação.
8. O histórico recebe snapshot, checksum posterior e módulos afetados.
9. O desfazer só restaura quando nenhum dado posterior foi modificado.

## Banco — schema 7

A migration `0007_local_automation_engine.sql` cria:

- `automation_preferences`;
- `automation_runs`;
- `automation_alert_states`.

As regras e recorrências continuam em `finance_documents`, mantendo compatibilidade com exportação, portabilidade e os adaptadores já existentes.

## Aplicar

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\11_APLICAR_FASE_10.cmd
```

## Validar

```powershell
.\11_VALIDAR_FASE_10.cmd
```

Resultado esperado:

```text
FASE 10 VALIDADA COM SUCESSO
Schema: 7
Versao: 0.10.0
Motor: simulacao, checksum, aplicacao atomica e desfazer validados.
Auditoria: 0 vulnerabilidades altas ou criticas.
```

## Commit recomendado

```powershell
git add .

git commit -m "feat(desktop): adiciona automacoes financeiras locais na versao 0.10.0" `
  -m "Cria o schema 7 com preferencias, execucoes reversiveis e estados de alertas." `
  -m "Implementa simulacao com checksum e aplicacao atomica no SQLCipher." `
  -m "Adiciona recorrencias, alertas de vencimento e historico com desfazer protegido." `
  -m "Integra a central de automacoes ao modo somente leitura e a suite de regressao."
```
