# FinnacialUX Desktop — Hotfix 8.0.3

## Motivo

O Hotfix 8.0.2 não conseguiu gerar o lockfile porque o npm 10.9.x recusou as referências `$postcss` e `$sharp` usadas dentro de `overrides`.

## Correção

- remove referências `$...` dos overrides;
- usa versões explícitas de PostCSS e Sharp;
- retorna o ESLint para a linha 9 corrigida e compatível com o ecossistema Next.js atual;
- mantém Vitest e cobertura V8 alinhados em 4.1.10;
- aplica correções de `brace-expansion` dentro de cada linha principal compatível;
- prepara e audita a árvore em uma pasta isolada;
- somente troca `package.json`, `package-lock.json` e `node_modules` depois da aprovação;
- restaura o estado anterior caso a troca final falhe.

## Execução

```powershell
.\09_CORRIGIR_VULNERABILIDADES.cmd
.\08_VALIDAR_QUALIDADE.cmd
```

## Resultado esperado

```text
HOTFIX 8.0.3 CONSOLIDADO COM SUCESSO
FASE 8.0.3 VALIDADA COM SUCESSO
Auditoria: nenhuma vulnerabilidade alta ou critica.
```

Não execute `npm audit fix --force`.
