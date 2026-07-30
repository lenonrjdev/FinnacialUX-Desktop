# Hotfix 8.0.6.1 — ESLint da camada CommonJS

## Motivo

A versão 0.8.6 eliminou todas as vulnerabilidades auditadas e instalou corretamente a camada segura de compatibilidade do Minimatch. A validação completa parou no ESLint porque o adaptador `vendor/minimatch-v3-secure-compat/index.cjs` usa `require()`, comportamento necessário para preservar a API CommonJS esperada pelos consumidores antigos.

## Correção

O arquivo `eslint.config.mjs` ganhou uma exceção restrita a:

```text
vendor/**/*.cjs
```

Somente nesse escopo a regra `@typescript-eslint/no-require-imports` fica desativada. Em todos os demais arquivos da aplicação, `require()` continua proibido.

## Segurança

Este hotfix não altera:

- `package.json`;
- `package-lock.json`;
- versões npm ou Rust;
- banco SQLCipher;
- lógica financeira;
- importação, exportação ou pacotes portáteis;
- configuração do Tauri.

A auditoria da versão 0.8.6 permanece válida e deve continuar apresentando `found 0 vulnerabilities`.

## Aplicação

Extraia o conteúdo na raiz do projeto e substitua `eslint.config.mjs`. Depois execute:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\08_VALIDAR_QUALIDADE.cmd
```

## Commit recomendado após aprovação

```powershell
git add eslint.config.mjs HOTFIX_8_0_6_1_ESLINT_VENDOR_COMMONJS.md HOTFIX_8_0_6_1_ARQUIVOS.txt

git commit -m "fix(quality): permite CommonJS apenas no adaptador seguro do minimatch" `
  -m "Mantém require proibido em todo o código da aplicação." `
  -m "Libera a regra somente para arquivos vendor/**/*.cjs." `
  -m "Desbloqueia a validação da versão 0.8.6 sem alterar dependências ou segurança."
```
