# Fase 9 — Integridade, recuperação e continuidade dos dados

Versão: `0.9.0`  
Schema local: `6`

## Objetivo

Garantir que uma falha de integridade, uma migration interrompida ou uma restauração inválida não cause perda silenciosa de dados. A Fase 9 transforma os backups existentes em uma camada nativa de continuidade, com pontos de recuperação verificáveis, restauração atômica e bloqueio de gravações financeiras quando o banco não está saudável.

## Entregas principais

- `PRAGMA integrity_check`, `PRAGMA quick_check` e `PRAGMA foreign_key_check` integrados à continuidade.
- Snapshot SQLCipher automático antes de qualquer migration de schema existente.
- Registro dos pontos de recuperação no banco, com checksum SHA-256, schema, tamanho, motivo e estado.
- Pontos `.fuxbackup` manuais e diários, criados apenas depois de uma verificação saudável e sempre protegidos pela chave do dispositivo.
- Restauração atômica com arquivo temporário, validação, troca segura e rollback em falhas.
- Backup de segurança protegido antes de restaurar um ponto SQLCipher ou portátil.
- Modo somente leitura nativo para bloquear comandos financeiros de gravação.
- Saída do modo somente leitura somente depois de uma nova verificação íntegra.
- Retenção configurável por quantidade e idade, sem remover pontos marcados como protegidos.
- Histórico de eventos de continuidade, falhas, verificações e restaurações.
- Nova área **Configurações → Continuidade**.
- Banner global quando as gravações financeiras estiverem bloqueadas.
- Testes unitários TypeScript e testes Rust para schema 6, SQLCipher, retenção e estado somente leitura.

## Fluxo de inicialização

1. O banco SQLCipher é aberto com a chave mantida no Stronghold.
2. Quando existe uma migration pendente, o aplicativo executa `wal_checkpoint(FULL)`.
3. Uma cópia criptografada do banco atual é salva antes da migration.
4. A migration 6 é aplicada dentro do fluxo já transacional de migrations.
5. O ponto anterior à migration é registrado como protegido.
6. Quando a política **Verificar ao iniciar** está ativa, o aplicativo executa a verificação completa.
7. Se o banco estiver saudável, ele permanece liberado e pode receber um ponto diário.
8. Se houver inconsistência, gravações financeiras são bloqueadas no núcleo Rust.

## Migration 6

A migration `0006_data_continuity.sql` cria:

- `continuity_preferences`;
- `continuity_recovery_points`;
- `continuity_events`.

Ela também reconstrói `backup_history` para aceitar o tipo `recovery_point`, preservando todos os registros anteriores.

## Tipos de ponto de recuperação

| Motivo | Formato | Proteção | Uso |
|---|---|---:|---|
| `pre_migration` | SQLCipher | sempre protegido | retorno ao banco anterior a uma migration |
| `daily_healthy` | `.fuxbackup` | retenção normal | continuidade diária após integridade aprovada |
| `manual` | `.fuxbackup` | configurável | ponto criado pelo usuário |
| `pre_recovery` | `.fuxbackup` | protegido | cópia de segurança antes de uma restauração |

## Garantias de restauração

Antes de restaurar, o aplicativo:

1. confirma a existência do arquivo;
2. recalcula e compara o SHA-256;
3. valida a chave e o conteúdo SQLCipher ou `.fuxbackup`;
4. cria uma cópia de segurança do banco atual;
5. restaura em um arquivo temporário;
6. aplica migrations necessárias até o schema 6;
7. executa uma nova verificação de integridade;
8. troca os arquivos de forma atômica;
9. reverte para o banco anterior caso a validação final falhe.

## Política padrão

- verificação ao iniciar: ativada;
- ponto diário saudável: ativado;
- retenção: 12 pontos não protegidos;
- idade máxima: 90 dias;
- somente leitura em falhas: ativado.

Pontos protegidos não entram no limite de retenção e não são apagados automaticamente.

## Aplicar no Windows

Extraia o ZIP incremental na raiz do projeto e execute:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\10_APLICAR_FASE_9.cmd
```

O script:

- exige a base `0.8.6` ou superior;
- salva os manifests atuais em `.phase-backup`;
- alinha `package.json`, `package-lock.json`, `Cargo.toml` e `tauri.conf.json` em `0.9.0`;
- confirma a presença da migration e do núcleo de continuidade.

## Validar

```powershell
.\10_VALIDAR_FASE_9.cmd
```

A validação reutiliza toda a suíte consolidada da Fase 8 e acrescenta os artefatos da Fase 9:

- instalação exata pelo lockfile;
- auditoria npm;
- ESLint e TypeScript;
- testes unitários e cobertura;
- build Next.js;
- Playwright;
- testes Rust;
- `cargo check`;
- migration 6 e testes de continuidade.

Resultado esperado:

```text
FASE 9 VALIDADA COM SUCESSO
Schema: 6
Versão: 0.9.0
Auditoria: 0 vulnerabilidades altas ou críticas.
```

## Commit recomendado

```powershell
git add .

git commit -m "feat(desktop): adiciona continuidade e recuperação de dados na versão 0.9.0" `
  -m "Cria o schema 6 com preferências, pontos de recuperação e eventos de continuidade." `
  -m "Gera snapshots SQLCipher protegidos antes de migrations e pontos saudáveis com retenção configurável." `
  -m "Implementa restauração atômica, checksum, rollback e backup de segurança antes da recuperação." `
  -m "Bloqueia gravações financeiras no Rust quando a integridade falha e exige revalidação para liberar." `
  -m "Adiciona a central de Continuidade, banner global e testes de regressão TypeScript e Rust."
```

Tag recomendada:

```powershell
git tag desktop-v0.9.0
git push origin main
git push origin desktop-v0.9.0
```
