# Hotfix 4.0.4 — Tauri async, SQLx e limites de `Send`

## Correção

Os fluxos nativos longos de abertura/criptografia, rotação de chave, backup e restauração agora executam em uma thread dedicada. O futuro SQLx é criado e concluído dentro dessa thread e não precisa atravessar o limite `Send` imposto pelo wrapper assíncrono de comandos do Tauri.

## Comandos corrigidos

- `encrypted_database_open`
- `encrypted_database_rekey`
- `create_manual_backup`
- `run_automatic_backup`
- `restore_backup`

## Segurança e compatibilidade

- Nenhuma migration foi alterada.
- Nenhuma chave foi recriada.
- O banco não é aberto durante a instalação do hotfix.
- Os nomes dos comandos IPC e seus argumentos JavaScript permanecem compatíveis.
- O trabalho pesado não bloqueia a thread principal da interface.

## Script de configuração

O `cargo check` não é mais repetido três vezes quando o erro é de código Rust. O cache resiliente do libsodium continua ativo; a validação agora para no primeiro erro real e mostra uma mensagem correta.
