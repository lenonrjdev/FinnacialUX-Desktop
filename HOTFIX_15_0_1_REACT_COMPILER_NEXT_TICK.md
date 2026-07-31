# Hotfix 15.0.1 — React Compiler no cálculo do próximo ciclo

## Problema

O ESLint interrompia a validação da Fase 15 com a regra
`react-hooks/preserve-manual-memoization`. O cálculo `nextTick` usava `useMemo`,
mas o React Compiler inferia dependência do objeto `status` enquanto o array
manual declarava apenas `status?.nextTickAt`.

## Correção

A memoização manual foi removida. O próximo ciclo passa a ser derivado
diretamente durante o render a partir de:

- `preferences.lastSchedulerTickAt`;
- `preferences.intervalMinutes`;
- `status.nextTickAt`, quando fornecido pelo agendador nativo.

O cálculo é pequeno, puro e não justifica cache manual. A correção mantém a
regra do React Compiler ativa e evita divergência entre dependências inferidas
e declaradas.

## Impacto

- nenhuma alteração no schema 12;
- nenhuma alteração no agendador Rust;
- nenhuma alteração na fila persistente;
- nenhuma dependência adicionada;
- versão preservada em `0.15.0`.
