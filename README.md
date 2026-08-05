# FinnacialUX Desktop

Aplicativo financeiro local-first para Windows, construído com Next.js, React, TypeScript, Tailwind CSS, Tauri, Rust e SQLCipher. A versão atual é `1.5.0` e o schema do banco está congelado em `14`.

## Instalação e desenvolvimento

```powershell
.\01_CONFIGURAR_DESKTOP.cmd
.\02_RODAR_DESKTOP.cmd
```

## Validação

```powershell
.\VALIDAR_PROJETO.cmd
```

## Build e release

```powershell
.\03_GERAR_INSTALADOR.cmd
.\05_GERAR_RELEASE.cmd
```

Os comandos de assinatura Windows e homologação da release atual permanecem no fluxo `25_*`. Chaves privadas, senhas, PFX e configurações locais nunca devem ser versionados.

## Project Brain

O contexto técnico, estado atual, arquitetura, decisões e regras para agentes de IA estão centralizados em:

`project_brain/README.md`
