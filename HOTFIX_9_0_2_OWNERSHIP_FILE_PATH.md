# Hotfix 9.0.2 — Ownership do caminho do ponto de recuperação

## Contexto

A validação da Fase 9 chegou ao módulo Rust e encontrou `E0382` em `src-tauri/src/continuity.rs`.

O campo `record.file_path`, do tipo `String`, era movido para `RecoveryPoint.file_path` e reutilizado depois para calcular o checksum SHA-256. Como `String` não implementa `Copy`, o compilador bloqueou a reutilização após o movimento.

## Correção

O SHA-256 agora é calculado antes da construção de `RecoveryPoint`:

```rust
let checksum_sha256 = Some(sha256_file(Path::new(&record.file_path))?);
```

Depois, o caminho é movido normalmente para o ponto de recuperação e o valor já calculado é atribuído:

```rust
file_path: record.file_path,
checksum_sha256,
```

## Escopo

- nenhum `clone()` desnecessário foi adicionado;
- nenhuma alteração em SQLCipher, retenção, restauração ou modo somente leitura;
- nenhuma migration foi alterada;
- a versão permanece `0.9.0`;
- a validação deve ser repetida com `10_VALIDAR_FASE_9.cmd`.
