# FinnacialUX Desktop 0.8.3

## Correção da cadeia de dependências

- Remove referências `$postcss` e `$sharp` incompatíveis com a execução observada no npm 10.9.x.
- Usa overrides explícitos e compatíveis por linha principal.
- Mantém ESLint na linha 9 corrigida para evitar peers experimentais da linha 10.
- Prepara instalação, lockfile e auditoria fora da árvore ativa antes da substituição.
- Garante troca transacional de manifests e `node_modules`.

## Garantias preservadas

Nenhuma alteração foi feita nos módulos financeiros, SQLCipher, Stronghold, migrations, importação, exportação ou portabilidade.
