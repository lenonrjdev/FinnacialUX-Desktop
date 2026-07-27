# FinnacialUX Desktop — Hotfix 4.0.3

## Correção

O módulo `src-tauri/src/encrypted_database.rs` utiliza o método `.connect()` de `SqliteConnectOptions` fornecido pelo trait `sqlx::ConnectOptions`.

O trait não estava importado, causando o erro Rust `E0599` em todas as conexões SQLCipher e SQLite.

Este hotfix:

- importa `sqlx::ConnectOptions`;
- remove o import não utilizado `sqlx::Executor`;
- não altera banco, migrations, Stronghold, chaves ou dados;
- não exige apagar `src-tauri/target` nem o cache do libsodium.

## Aplicação

Extraia este ZIP diretamente na raiz `C:\Projetos\FinnacialUxDesktop`, substitua o arquivo existente e execute:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\01_CONFIGURAR_DESKTOP.cmd
```
