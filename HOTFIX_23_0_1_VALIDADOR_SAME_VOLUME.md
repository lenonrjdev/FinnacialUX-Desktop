# Hotfix 23.0.1 — Contrato `same-volume` no validador

Corrige uma falsa regressão no `24_VALIDAR_FASE_23.ps1`.

A implementação funcional já estava aprovada por TypeScript, Vitest, Next.js, Playwright, testes Rust e `cargo check`. O erro ocorria porque o validador procurava o literal de tipo `same-volume` dentro de `lib/external-backup-engine.ts`, embora esse literal seja declarado corretamente em `types/external-backup.ts`.

## Alterações

- valida `same-volume` no arquivo de tipos correto;
- valida no motor o comportamento real de destino não independente;
- confirma a mensagem visual `Destino no mesmo volume`;
- adiciona `-SkipQuality` para reaproveitar a suíte completa já aprovada neste ciclo;
- não altera backup, criptografia, retenção, banco ou versão;
- preserva a versão 1.4.0 e o schema SQLCipher 14.
