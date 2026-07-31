# Fase 16 — Diagnóstico, auditoria e suporte local

## Objetivo

Transformar a área de diagnóstico existente em uma central técnica completa, capaz de validar o ambiente local, ensaiar a recuperação dos dados e gerar material de suporte sem expor informações financeiras.

A versão `0.16.0` introduz o schema SQLCipher `13` e registra apenas resultados técnicos, contagens, estados, duração das verificações e reparos executados.

## Princípios

- Diagnósticos funcionam mesmo em modo somente leitura.
- Testes de escrita usam uma transação técnica revertida.
- O ensaio de restauração utiliza um snapshot temporário e nunca substitui o banco real.
- Reparos não alteram lançamentos, pagamentos, planos ou documentos financeiros.
- Pacotes de suporte nunca incluem senhas, PIN, chaves SQLCipher ou conteúdo dos documentos.
- Logs exportados removem caminhos, e-mails e tokens longos.
- Toda ação de reparo exige confirmação sensível na interface.

## Schema 13

A migration `0013_local_diagnostics_and_support.sql` cria:

- `diagnostic_preferences`;
- `diagnostic_runs`;
- `diagnostic_checks`;
- `diagnostic_repairs`;
- `support_package_exports`;
- `diagnostic_probe`.

## Verificações

A suíte valida:

- abertura e criptografia SQLCipher;
- versão do schema e tabelas essenciais;
- `PRAGMA quick_check` e chaves estrangeiras;
- modo somente leitura;
- leitura e escrita reversíveis;
- Stronghold, salt e chaves técnicas;
- pastas de configuração, dados, backups e logs;
- espaço livre em disco;
- saúde dos backups e pontos de recuperação;
- ensaio de restauração em snapshot temporário;
- tarefas travadas e leases expirados;
- canal do atualizador;
- tamanho e retenção dos logs técnicos.

## Reparos permitidos

- checkpoint, `ANALYZE` e `PRAGMA optimize`;
- liberação de rotinas travadas e leases expirados;
- atualização do estado de arquivos de backup e recuperação;
- remoção de logs técnicos com mais de 30 dias.

## Pacote de suporte

O arquivo `.fuxsupport` usa o formato 2 e contém:

- manifesto técnico;
- SHA-256 do payload;
- versão do aplicativo e schema;
- resultados das verificações;
- histórico técnico resumido;
- migrations aplicadas;
- logs sanitizados opcionais.

A própria aplicação consegue reabrir o pacote e validar o checksum.

## Aplicação e validação

```powershell
.\17_APLICAR_FASE_16.cmd
.\17_VALIDAR_FASE_16.cmd
```
