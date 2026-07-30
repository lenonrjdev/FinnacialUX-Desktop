# Hotfix 9.0.1 — Trait `sqlx::Connection`

## Contexto

A validação da Fase 9 chegou ao módulo nativo depois de aprovar auditoria npm, ESLint, TypeScript, testes unitários, cobertura, build e Playwright.

O compilador Rust interrompeu a suíte porque `SqliteConnection::close()` é disponibilizado pelo trait `sqlx::Connection`, mas o trait não estava importado no arquivo `src-tauri/src/continuity.rs`.

## Correção

O import:

```rust
use sqlx::Row;
```

foi alterado para:

```rust
use sqlx::{Connection, Row};
```

A mudança disponibiliza o método `close()` nas nove chamadas já existentes, sem alterar fluxo, dados, SQLCipher, migrations, restauração, retenção ou modo somente leitura.

## Versão

A aplicação permanece em `0.9.0`, pois esta é uma correção de compilação da própria Fase 9 antes de sua validação final.

## Aplicação

Extraia o conteúdo na raiz do projeto e substitua o arquivo existente. Depois execute:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\10_VALIDAR_FASE_9.cmd
```
