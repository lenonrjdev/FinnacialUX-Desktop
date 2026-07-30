# Hotfix 8.0.6 — Minimatch autossuficiente

## Problema corrigido

O Hotfix 8.0.5 instalou a árvore segura, removeu versões antigas de `brace-expansion` e alinhou o lockfile. Porém, o smoke test tentou carregar `minimatch` diretamente da raiz, enquanto o npm havia instalado a camada somente nas posições transitivas exigidas pelo ESLint.

O erro era de resolução do teste, não uma nova vulnerabilidade.

## Solução

- instala a camada local `minimatch-v3-secure-compat` também como dependência direta de desenvolvimento;
- declara `minimatch-secure@10.2.6` como dependência da própria camada;
- resolve a implementação moderna a partir do manifesto da camada instalada;
- funciona com ou sem hoisting do npm;
- mantém o override transitivo para todos os consumidores de `minimatch 3.1.5`;
- mantém a auditoria alta/crítica como gate obrigatório.

## Segurança operacional

A árvore continua sendo preparada em staging externo. O projeto original só é alterado após validação de manifesto, lockfile, API compatível e `npm audit --audit-level=high`.
