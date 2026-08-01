# Backup automático e continuidade operacional

## Objetivo

A versão 1.2.0 conecta o comando nativo `run_automatic_backup` ao ciclo real do FinnacialUX Desktop. A política já persistida no SQLCipher passa a ser verificada ao iniciar, ao retornar para a janela e em intervalos locais configuráveis.

## Garantias

- nenhuma migration nova;
- schema SQLCipher 14 permanece congelado;
- o Rust continua sendo a autoridade para periodicidade e retenção;
- uma verificação antes do prazo não cria cópia duplicada;
- backups com proteção do dispositivo usam a chave do Stronghold;
- falhas são sanitizadas e registradas somente no computador;
- nenhum saldo, lançamento ou arquivo é enviado para serviços externos;
- o modo automático não substitui o backup manual nem a restauração assistida.

## Fluxo

1. O provider aguarda autenticação, cofre e runtime Tauri.
2. As preferências nativas são consultadas.
3. A chave do dispositivo é solicitada somente quando a política exige criptografia local.
4. O comando Rust avalia se a cópia está vencida.
5. Quando necessário, cria `.fuxbackup`, verifica integridade, atualiza `last_automatic_at` e aplica retenção.
6. O frontend registra somente o resultado técnico local.

## Central de configuração

`Configurações → Backup automático` mostra a saúde da proteção, próxima periodicidade, último arquivo, estado do executor, opções de ciclo e histórico local.

## Recuperação

A restauração continua sendo deliberada e protegida. O painel direciona para `Configurações → Backups`, onde o arquivo é inspecionado antes de qualquer substituição e uma cópia de segurança é criada antes da restauração.
