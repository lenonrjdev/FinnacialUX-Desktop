# Testes e regressão

## Camadas

### Unidade — Vitest

Os testes em `tests/unit` cobrem funções determinísticas e módulos que não precisam abrir a janela Tauri. A cobertura é calculada pelo provider V8 e deve respeitar os limites definidos em `vitest.config.ts`.

### Ponta a ponta — Playwright

Os testes em `tests/e2e` compilam o Next.js em export estático, iniciam o servidor local de `scripts/serve-static.mjs` e executam o Chromium em `pt-BR`, no fuso `America/Sao_Paulo`.

Os fluxos que dependem do bridge Tauri e do SQLCipher são mantidos na suíte Rust; o navegador não deve simular o banco nativo como fonte de verdade.

### Nativo — Cargo

Os testes dentro de `src-tauri/src` validam:

- aplicação sequencial das migrations;
- idempotência do schema;
- versão final do banco;
- proteção real do cabeçalho SQLCipher;
- rejeição de chave incorreta;
- snapshots de portabilidade;
- rollback quando uma gravação viola integridade.

## Comandos

```powershell
npm run test
npm run test:coverage
npm run test:e2e
npm run test:rust
npm run check:web
npm run check:desktop
npm run check:regression
```

## Relatórios

- `coverage/`: cobertura HTML, LCOV e resumo JSON;
- `playwright-report/`: relatório navegável dos testes E2E;
- `test-results/`: traces, imagens e vídeos de falhas.

Essas pastas não entram no Git.

## Como adicionar um teste de regressão

1. Reproduza a falha em um teste pequeno.
2. Confirme que o teste falha sem a correção.
3. Corrija a causa raiz.
4. Execute a camada afetada e a validação completa.
5. Não diminua os limites de cobertura para liberar uma alteração.
6. Não use mocks como fonte de verdade para o SQLCipher.

## Dependências

A auditoria é deliberadamente não destrutiva. Não execute `npm audit fix --force` sem revisar as mudanças de versão, o build estático e o Tauri. Vulnerabilidades críticas bloqueiam a validação da fase.
