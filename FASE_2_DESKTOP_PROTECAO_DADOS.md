# Fase 2 — Proteção de dados, backups e diagnóstico

Versão do aplicativo: `0.2.0`

## Objetivo

Transformar a persistência local da Fase 1 em uma base operacional segura para uso diário. A Fase 2 não adiciona dados demonstrativos, não altera a lógica financeira e não depende do FinnacialUX Core, Docker ou internet.

## Entregas

### Backup nativo

- backup manual pelo seletor de arquivos do Windows;
- extensão própria `.fuxbackup`;
- cópia consistente do SQLite por `VACUUM INTO`;
- manifesto com versão do aplicativo, schema, data, quantidade de documentos e checksum SHA-256;
- verificação do pacote antes de aceitar restauração;
- histórico local de backups;
- backups automáticos diário, semanal ou mensal;
- retenção configurável entre 1 e 60 cópias;
- remoção automática somente de backups automáticos antigos;
- backups manuais permanecem no local escolhido pelo usuário.

### Restauração segura

- pré-visualização e validação antes de restaurar;
- confirmação explícita com a palavra `RESTAURAR`;
- criação automática de backup pré-restauração;
- fechamento do pool SQLite do frontend;
- substituição por arquivo intermediário;
- validação final do banco restaurado;
- reversão automática para o banco anterior se a validação falhar;
- encerramento da sessão local depois da restauração.

### Integridade e diagnóstico

- `PRAGMA integrity_check`;
- `PRAGMA foreign_key_check`;
- validação das tabelas essenciais;
- histórico próprio de versões do schema;
- tamanho do banco;
- espaço livre da unidade;
- versão do aplicativo e sistema operacional;
- caminhos do banco, backups e logs;
- pacote `.fuxdiag` com diagnóstico e logs sanitizados;
- nenhum saldo, lançamento, senha ou documento financeiro é exportado no diagnóstico.

### Recuperação

- marcador de sessão ativa;
- detecção de encerramento inesperado;
- tela de recuperação antes de carregar a dashboard;
- abertura normal;
- verificação de integridade;
- seleção e restauração de backup;
- modo seguro somente leitura para os dados financeiros.

## Novas tabelas

A migration `0002_data_protection.sql` cria:

```text
app_schema_history
backup_preferences
backup_history
diagnostic_events
```

A migration é aplicada automaticamente pelo plugin SQL do Tauri ao abrir o aplicativo. Os dados existentes da Fase 1 são preservados.

## Formatos

### `.fuxbackup`

Contém:

```text
cabeçalho do formato
manifesto JSON
cópia consistente do finnacialux.db
```

O checksum detecta alteração ou corrupção acidental. Nesta fase, o backup ainda não é criptografado; criptografia e Stronghold pertencem à Fase 3.

### `.fuxdiag`

Contém somente:

```text
versão do aplicativo
sistema operacional
arquitetura
integridade do banco
histórico de schema
caminhos técnicos
logs sanitizados recentes
```

## Aplicação sobre a Fase 1

1. encerre o modo de desenvolvimento com `Ctrl + C`;
2. feche a janela do FinnacialUX Desktop;
3. extraia o ZIP da Fase 2 diretamente na raiz do projeto;
4. permita substituir os arquivos existentes;
5. execute:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
Remove-Item -Recurse -Force .\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\out -ErrorAction SilentlyContinue
npm install
.\01_CONFIGURAR_DESKTOP.cmd
.\02_RODAR_DESKTOP.cmd
```

Não apague o banco SQLite e não remova a pasta de dados do aplicativo.

## Teste de aceitação

1. entre no aplicativo e confirme que os dados existentes continuam presentes;
2. acesse **Configurações → Backups**;
3. crie um backup manual;
4. acesse **Configurações → Diagnóstico**;
5. execute a verificação do banco;
6. cadastre um registro de teste;
7. restaure o backup criado;
8. entre novamente e confirme que o estado voltou ao momento do backup;
9. ative backup automático e reabra o aplicativo;
10. encerre o processo à força uma vez para validar a tela de recuperação;
11. abra em modo seguro e confirme que consultas funcionam e alterações financeiras são bloqueadas.

## Limites desta fase

- o SQLite e os backups ainda não são criptografados;
- anexos ainda não fazem parte do produto;
- não existe sincronização com o FinnacialUX Core;
- não existe upload para nuvem;
- o diagnóstico é local e exportado somente por ação do usuário;
- backups automáticos são verificados uma vez por abertura do aplicativo.
