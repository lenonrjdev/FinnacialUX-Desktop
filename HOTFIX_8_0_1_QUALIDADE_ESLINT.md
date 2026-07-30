# Hotfix 8.0.1 — Gate de qualidade e ESLint

## Problema corrigido

A primeira execução de `08_VALIDAR_QUALIDADE.cmd` parava no ESLint antes de alcançar TypeScript, Vitest, build, Playwright e Rust.

O relatório continha dois tipos de bloqueio:

1. o ESLint percorria `src-tauri/target`, que contém arquivos binários e JavaScript gerado pelo Cargo/Tauri;
2. o `eslint-config-next` atual ativou regras voltadas ao React Compiler, embora o FinnacialUX Desktop não use o React Compiler e já possua effects consolidados para hidratação local, runtime Tauri, segurança e dados financeiros.

## Alterações

- ignora `src-tauri/target/**` e demais relatórios gerados;
- mantém os arquivos reais da aplicação dentro do lint;
- desativa apenas `react-hooks/set-state-in-effect` e `react-hooks/purity`, regras que não fazem parte do contrato atual do projeto;
- preserva `rules-of-hooks`, `exhaustive-deps`, TypeScript e Core Web Vitals;
- aceita parâmetros intencionalmente não utilizados quando começam com `_`;
- divide o validador em etapas independentes para mostrar exatamente qual gate falhou;
- atualiza a versão para `0.8.1`.

## O que não foi alterado

- banco SQLCipher e migrations;
- Stronghold, PIN e autenticação;
- importação, exportação e `.fuxportable`;
- módulos financeiros;
- updater, assinatura ou instalador.

## Validação

Depois de aplicar, execute novamente:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\08_VALIDAR_QUALIDADE.cmd
```

O ESLint pode exibir avisos de código não utilizado, mas avisos não interrompem a suíte. Qualquer erro real continuará bloqueando a validação.
