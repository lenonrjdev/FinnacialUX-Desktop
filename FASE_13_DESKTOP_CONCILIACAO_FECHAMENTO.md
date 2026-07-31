# Fase 13 — Conciliação e fechamento financeiro

## Objetivo

Fechar o ciclo entre extratos, lançamentos, automações, projeções e planejamento sem remover o controle do usuário. A aplicação passa a comparar movimentações bancárias com registros locais, exigir uma prévia antes da aplicação e bloquear alterações em meses formalmente fechados.

## Versão e schema

- aplicação: `0.13.0`;
- SQLCipher: schema `10`;
- migration: `0010_bank_reconciliation_and_monthly_closing.sql`.

## Entregas

- importação de extratos CSV e OFX;
- fingerprint local para detectar repetição;
- correspondência por valor, data, descrição e conta;
- revisão manual de cada decisão e prevenção de vínculo duplo ao mesmo lançamento;
- criação, vínculo ou descarte explícito;
- checksum da fonte e da prévia;
- aplicação atômica e snapshot reversível;
- desfazer apenas quando o estado posterior permanece intacto;
- fechamento mensal por conta;
- checklist obrigatório e conferência de saldo;
- bloqueio nativo de lançamentos de meses fechados;
- reabertura com justificativa auditável;
- comprovantes criptografados no SQLCipher, com exportação somente após revalidar o SHA-256;
- integração com automações e portabilidade;
- limpeza dos avisos técnicos conhecidos.

## Limites de segurança

O fechamento não executa pagamentos e a conciliação não aceita uma prévia antiga. Meses fechados só podem mudar depois de uma reabertura explícita. Arquivos de comprovante são limitados a 5 MB e permanecem dentro do banco criptografado.
