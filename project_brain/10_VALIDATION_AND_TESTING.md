# Validação e testes

Comando oficial:

```powershell
.\03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd -SomenteValidar
```

O fluxo valida estrutura e comandos, versões e `package-lock`, schema 14 e hashes das 14 migrations, Tauri e permissões, ausência de segredos, fonte da release e política pública de assinatura. Depois executa `npm ci`, `npm audit`, ESLint, TypeScript, Vitest com cobertura, build Next.js, rotas estáticas, Playwright, testes Rust, `cargo check` e validação somente leitura dos artefatos 1.5.0 quando presentes.

`02_GERAR_INSTALADOR.cmd` usa uma pré-validação que termina antes do build; o próprio build Tauri executa Next.js e Rust, evitando compilação duplicada. Essa pré-validação não substitui o comando oficial completo antes de commit ou release.

Última evidência completa em 5 de agosto de 2026: 19 arquivos Vitest, 137 testes unitários, 4 E2E e 34 testes Rust aprovados; cobertura global de 83,33% statements, 78,01% branches, 90,51% functions e 83,81% lines; 24 páginas estáticas; zero vulnerabilidades no `npm audit`; release 1.5.0 e Authenticode aprovados automaticamente. O fluxo integral também foi repetido com `-ReutilizarArtefatos`, sem rebuild e sem publicação.
