# Hotfix 14.0.1 — Validador estrutural de cancelamento

## Problema

A suíte completa da versão 0.14.0 passou, mas o validador final da Fase 14
procurava uma frase acentuada dentro de `reconciliation.rs`. No Windows
PowerShell 5.1, o próprio script UTF-8 sem BOM podia ser interpretado pela
página de código local, transformando a frase esperada e causando falso
negativo.

## Correção

- remove a dependência de uma mensagem acentuada;
- valida identificadores estruturais do processamento em lotes;
- comprova que `operation_cancelled` aparece antes de
  `ensure_transaction_document_change_allowed`;
- mantém a validação de progresso, lote e estado `cancelled`;
- salva o script com UTF-8 BOM para o Windows PowerShell 5.1.

## Impacto

Nenhuma lógica de produção foi alterada. Permanecem intactos:

- versão 0.14.0;
- schema SQLCipher 11;
- paginação e índices;
- importação em lotes;
- cancelamento nativo;
- dependências e migrations.
