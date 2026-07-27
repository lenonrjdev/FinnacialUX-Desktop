# FinnacialUX Desktop — Hotfix 4.0.1

## Objetivo

Consolidar no projeto os arquivos obrigatórios da Fase 3 que são utilizados pela Fase 4 SQLCipher.

O erro corrigido acontece quando a Fase 4 incremental é extraída sobre uma base que ainda não recebeu integralmente a Fase 3. Nesse cenário, componentes da Fase 4 importam tipos, telas e contratos de segurança que não existem ou ainda estão em versões anteriores.

## Correções

- adiciona `types/desktop-security.ts`;
- atualiza `types/configuracoes.ts` com PIN, bloqueio, proteção de restauração e criptografia de backups;
- atualiza `components/configuracoes/backups-panel.tsx` com `CreateBackupOptions`;
- adiciona a tela de bloqueio local;
- adiciona a confirmação de ações sensíveis;
- consolida providers de proteção e recuperação;
- adiciona a migration `0003_local_security.sql` antes da migration SQLCipher `0004`;
- preserva todos os arquivos nativos mais novos da Fase 4;
- adiciona validação de arquivos obrigatórios ao script de configuração.

## Aplicação

1. Encerre o FinnacialUX e o terminal de desenvolvimento.
2. Extraia este ZIP na raiz `C:\Projetos\FinnacialUxDesktop`.
3. Permita substituir os arquivos existentes.
4. Execute:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
Remove-Item -Recurse -Force .\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\out -ErrorAction SilentlyContinue
.\01_CONFIGURAR_DESKTOP.cmd
```

O hotfix não apaga nem modifica o banco de dados do usuário.
