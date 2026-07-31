# Hotfix 13.0.1 — Contrato da conta de destino

## Diagnóstico

A validação da Fase 13 chegou ao TypeScript e encontrou `TS2551` em `lib/reconciliation-engine.ts`.

O motor de fechamento usa `destinationAccountId` para reconhecer transferências recebidas pela identidade estável da conta, mas `FinancialTransaction` declarava somente `destinationAccount`, campo legado baseado no nome exibido.

## Correção

O contrato `FinancialTransaction` agora aceita os dois campos opcionais:

```ts
destinationAccount?: string;
destinationAccountId?: string;
```

`destinationAccount` mantém compatibilidade com lançamentos antigos. `destinationAccountId` permite conciliação e fechamento mesmo quando o nome da conta for alterado.

Também foi adicionado um teste de regressão comprovando que uma transferência recebida é contabilizada pela conta de destino usando seu identificador.

## Escopo

- mantém a versão `0.13.0`;
- mantém o schema SQLCipher 10;
- não altera migrations ou comandos Rust;
- não altera importação CSV/OFX, checksums ou fechamento;
- não adiciona dependências;
- a validação deve ser repetida com `14_VALIDAR_FASE_13.cmd`.
