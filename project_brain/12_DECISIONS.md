# Decisões arquiteturais

## DEC-001 — Local-first com SQLCipher

- Data: consolidada até 2026-08-04
- Decisão: persistir o domínio financeiro localmente em SQLCipher.
- Contexto: o Desktop deve funcionar sem backend remoto.
- Motivo: privacidade, disponibilidade e controle do usuário.
- Consequências: gestão rigorosa de chave, backups e migrations.
- Status: vigente.

## DEC-002 — Schema 14 congelado

- Decisão: manter 14 migrations com hashes registrados.
- Consequências: qualquer evolução exige migration 0015 e revisão formal.
- Status: vigente.

## DEC-003 — Frontend estático dentro do Tauri

- Decisão: Next.js usa `output: export` e `trailingSlash`.
- Consequências: rotas devem gerar `out/<rota>/index.html`; recursos que exigem servidor Next não são permitidos no runtime desktop.
- Status: vigente.

## DEC-004 — Duas assinaturas independentes

- Decisão: manter assinatura do updater Tauri separada de Authenticode.
- Consequências: duas chaves/identidades e dois gates distintos.
- Status: vigente.

## DEC-005 — Bootstrap da 1.5.0

- Decisão: classificar 1.5.0 como instalador completo porque a evidência manual da 1.4.0 não está completa.
- Consequências: não declarar o upgrade 1.4.0 → 1.5.0 como homologado.
- Status: vigente.
