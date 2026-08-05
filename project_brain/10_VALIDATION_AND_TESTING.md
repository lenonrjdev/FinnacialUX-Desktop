# Validação e testes

Comando oficial:

```powershell
.\VALIDAR_PROJETO.cmd
```

O fluxo valida estrutura, versões, `package-lock`, schema/migrations, Tauri, ausência de segredos, fonte da release, `npm ci`, audit, ESLint, TypeScript, testes com cobertura, build, rotas exportadas, Playwright, Rust, `cargo check` e artefatos locais da 1.5.0 quando presentes. `-SkipInstall`, `-SkipE2E` e `-SkipReleaseArtifacts` existem apenas para diagnósticos controlados; a validação final não usa skips.

Evidência final de 2026-08-04: 19 arquivos Vitest, 137 testes unitários, 4 E2E e 34 testes Rust, todos aprovados; cobertura global de 83,33% statements, 78,01% branches, 90,51% functions e 83,81% lines; o build Next.js gerou 24 páginas estáticas e o validador confirmou as 22 rotas declaradas por `app/**/page.tsx`; `npm audit` reportou zero vulnerabilidades. A release local 1.5.0, o relatório Authenticode e o timestamp da assinatura também foram aprovados sem recompilação.
