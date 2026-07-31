# Hotfix 13.0.2 — Fixture de conta distinta

## Diagnóstico

A validação da Fase 13 chegou aos testes unitários com 70 testes aprovados e uma única falha em `calcula movimentos da conta sem misturar outras contas`.

O lançamento usado como “outra conta” alterava apenas o nome exibido, mas preservava `accountId: "account-1"` por causa do spread do fixture original. Como o identificador é a fonte estável de verdade, o motor o contabilizou corretamente na conta principal.

## Correção

O fixture agora declara explicitamente:

```ts
account: "Outra conta",
accountId: "account-2",
```

Assim o teste representa de fato uma conta diferente e continua validando que o fechamento não mistura movimentos de outras contas.

## Escopo

- mantém a versão `0.13.0`;
- mantém o schema SQLCipher 10;
- não altera o motor de conciliação;
- não altera cálculos, migrations, comandos Rust ou dependências;
- preserva `accountId` como autoridade mesmo quando o nome da conta muda;
- a validação deve ser repetida com `14_VALIDAR_FASE_13.cmd`.
