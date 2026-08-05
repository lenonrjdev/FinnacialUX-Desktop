# FinnacialUX Desktop

Aplicativo financeiro local-first para Windows, construído com Next.js 16, React 19, TypeScript, Tailwind CSS 4, Tauri 2, Rust e SQLCipher.

## Requisitos

Node.js 22.13+, npm 10.9+, Rust MSVC, Cargo e Strawberry Perl.

## Comandos principais

```powershell
.\01_RODAR_PROJETO.cmd
.\02_GERAR_INSTALADOR.cmd
.\03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd
.\04_PUBLICAR_ATUALIZACAO.cmd
```

- `01_RODAR_PROJETO.cmd`: prepara o ambiente quando necessário e inicia o Tauri em desenvolvimento.
- `02_GERAR_INSTALADOR.cmd`: gera instalador local, offline ou de release assinada sem publicar.
- `03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd`: valida o projeto e prepara artefatos de atualização; use `-SomenteValidar` para executar apenas a suíte completa.
- `04_PUBLICAR_ATUALIZACAO.cmd`: publica explicitamente uma release já homologada, após todos os gates e confirmação textual.

## Scripts npm

Use `npm run desktop:dev`, `npm run desktop:build`, `npm run installer`, `npm run installer:offline`, `npm run validate`, `npm run release:prepare` e `npm run release:publish` em automações controladas.

## Project Brain

O contexto técnico, estado atual, arquitetura, decisões e regras para agentes de IA estão centralizados em `project_brain/README.md`.
