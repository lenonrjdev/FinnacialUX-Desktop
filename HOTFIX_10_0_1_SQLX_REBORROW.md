# Hotfix 10.0.1 — Reempréstimo explícito da conexão SQLx

## Diagnóstico

A Fase 10 chegou ao `cargo test`, mas o Rust interrompeu a compilação com `E0382` em `src-tauri/src/automations.rs`.

A função `load_preferences` recebe `&mut SqliteConnection`. Ao passar esse valor diretamente para `fetch_optional`, o empréstimo mutável era movido. A consulta seguinte tentava reutilizar `connection` em `fetch_one`, causando o erro de uso após movimento.

## Correção

Todas as chamadas auxiliares do módulo que recebem a conexão mutável passaram a usar reempréstimo explícito:

```rust
.fetch_optional(&mut *connection)
.fetch_one(&mut *connection)
.fetch_all(&mut *connection)
.execute(&mut *connection)
```

O reempréstimo dura somente durante cada `await`, permitindo que a mesma conexão seja reutilizada nas operações seguintes.

## Escopo

- mantém a versão `0.10.0`;
- não altera schema, queries, regras, recorrências, alertas ou checksums;
- não altera `package.json`, `package-lock.json` ou dependências;
- não altera SQLCipher, continuidade ou modo somente leitura.

## Validação

Execute somente:

```powershell
.\11_VALIDAR_FASE_10.cmd
```

A suíte deve avançar além da compilação de `automations.rs` e concluir os testes Rust e `cargo check`.
