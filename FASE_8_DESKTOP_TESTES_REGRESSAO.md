# Fase 8 — Testes, regressão e qualidade do Desktop

Versão: 0.8.0

## Objetivo

Transformar as capacidades consolidadas até a Fase 7 em uma base protegida contra regressões. A fase valida automaticamente importação, exportação, portabilidade criptografada, migrations, SQLCipher e os fluxos públicos do aplicativo antes de uma alteração ser aceita.

## Entregas

- Vitest para testes unitários do domínio financeiro.
- Cobertura V8 com limites mínimos para os módulos críticos.
- Fixtures brasileiras de CSV e OFX.
- Testes de datas, valores em reais, cabeçalhos, automações e duplicidades.
- Testes de exportação CSV, JSON e tabelas financeiras.
- Testes de leitura e geração de XLS/XLSX.
- Testes do pacote `.fuxportable`, incluindo senha errada, adulteração e checksums.
- Testes da mesclagem de documentos portáteis.
- Playwright sobre o export estático do Next.js.
- Verificação das rotas públicas, validação de formulário e navegação por teclado.
- Testes Rust para migrations 1 a 5, idempotência e `PRAGMA user_version`.
- Teste SQLCipher que confirma cabeçalho protegido e rejeição de chave incorreta.
- Testes nativos do snapshot e da atomicidade da portabilidade.
- Workflow Windows para web, Playwright, Rust, SQLCipher e migrations.
- Comando único `08_VALIDAR_QUALIDADE.cmd`.
- Auditoria de dependências sem `npm audit fix --force`.

## Matriz de proteção

| Área | Tipo | Garantia principal |
|---|---|---|
| CSV e OFX | Vitest | Parsing bancário e padrão brasileiro |
| Regras e duplicidades | Vitest | Resultado determinístico antes da importação |
| XLS/XLSX | Vitest | Leitura, geração e abas oficiais |
| `.fuxportable` | Vitest | Criptografia, senha, checksum e adulteração |
| Rotas públicas | Playwright | Login, cadastro, recuperação e acessibilidade |
| Migrations | Rust | Schema 5 e reexecução segura |
| SQLCipher | Rust | Arquivo não legível como SQLite comum |
| Portabilidade nativa | Rust | Snapshot e rollback transacional |
| Integração contínua | GitHub Actions | Mesma validação em Windows limpo |

## Executar no Windows

```powershell
.\08_VALIDAR_QUALIDADE.cmd
```

Ou por partes:

```powershell
npm install
npx playwright install chromium
npm run check:web
npm run test:e2e
npm run check:desktop
```

## Critérios de aprovação

1. ESLint sem erros.
2. TypeScript sem erros.
3. Testes unitários aprovados.
4. Cobertura mínima aprovada.
5. Build estático concluído.
6. Playwright aprovado no Chromium.
7. Testes Rust aprovados.
8. `cargo check` aprovado.
9. Schema final igual a 5.
10. Banco SQLCipher rejeita chave incorreta.
11. Nenhuma vulnerabilidade crítica aceita sem análise.

## Política de regressão

Uma correção de produção deve receber primeiro um teste que reproduza a falha. O teste precisa falhar antes da correção e passar depois dela. Nenhuma migration já publicada pode ser editada; mudanças de schema devem criar uma nova migration.

## Commit recomendado

```text
test(desktop): adiciona suíte de regressão e validação ponta a ponta
```

```powershell
git add .

git commit -m "test(desktop): adiciona suíte de regressão e validação ponta a ponta" `
  -m "Adiciona Vitest, cobertura V8 e fixtures para importação, exportação, planilhas e pacotes portáteis." `
  -m "Cria testes Playwright para rotas públicas, validação de formulários e navegação acessível." `
  -m "Valida migrations, SQLCipher, chave incorreta, snapshots e atomicidade da portabilidade em Rust." `
  -m "Inclui comando único de qualidade e workflow Windows para prevenir regressões antes da release."
```

Tag recomendada:

```text
desktop-v0.8.0
```
