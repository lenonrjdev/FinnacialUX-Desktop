# Hotfix 8.0.5 — Minimatch seguro compatível

## Problema corrigido

A auditoria do Hotfix 8.0.4 chegou corretamente à árvore isolada, mas ainda encontrou nove vulnerabilidades altas. Todas vinham de ferramentas do ESLint que exigiam `minimatch 3.1.5`, dependente de uma linha antiga do `brace-expansion`.

O advisory atual considera vulneráveis todas as versões de `brace-expansion` até `5.0.7`. Portanto, os antigos backports `1.1.16` e `2.1.2` já não são suficientes para esse novo problema.

## Solução

O projeto mantém o ESLint 9.39.4 já validado, mas substitui apenas o `minimatch 3.1.5` transitivo por um pacote local de compatibilidade, versionado como `10.2.6`.

A camada:

- continua permitindo `require("minimatch")` como função, conforme a API antiga;
- preserva `Minimatch`, `filter`, `match`, `braceExpand`, `makeRe` e demais propriedades;
- delega todas as operações ao alias oficial `minimatch-secure`, apontado para `minimatch 10.2.6`;
- utiliza a árvore moderna com `brace-expansion 5.0.8`;
- possui smoke test próprio antes e depois da troca do `node_modules`.

## Segurança operacional

A instalação continua sendo preparada fora da raiz do projeto. O projeto original só é modificado depois de:

1. gerar o lockfile;
2. instalar a árvore isolada;
3. validar dependências diretas e transitivas;
4. testar a API de compatibilidade;
5. concluir `npm audit --audit-level=high` sem falha.
