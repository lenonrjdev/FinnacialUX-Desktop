# Fase 21 — Backup automático e continuidade operacional

## Versão

- FinnacialUX Desktop `1.2.0`
- SQLCipher schema `14`, congelado
- nenhuma migration `0015`

## Entregas

- provider global para executar o comando nativo de backup automático;
- verificação ao iniciar, ao focar a janela e por intervalo;
- painel em Configurações → Backup automático;
- saúde operacional e próxima periodicidade;
- histórico técnico local com sanitização;
- integração com Stronghold para cópias protegidas;
- retenção e prevenção de duplicações mantidas no Rust;
- testes unitários do motor puro;
- pipeline de atualização estável 1.2.0 promovida da 1.1.0;
- scripts de aplicação, validação, geração, homologação e publicação.

## Limites

A fase não envia dados para nuvem, não restaura automaticamente e não altera lançamentos financeiros. A restauração permanece uma ação explícita confirmada pelo usuário.
