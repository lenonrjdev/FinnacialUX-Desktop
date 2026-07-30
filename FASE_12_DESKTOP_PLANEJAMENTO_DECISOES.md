# Fase 12 — Planejamento financeiro orientado por decisões

Versão: `0.12.0`  
Schema SQLCipher: `9`
Pacote incremental: `31 arquivos novos ou modificados`

## Objetivo

Converter a inteligência financeira da Fase 11 em planos executáveis pelo usuário, sem automatizar decisões financeiras sensíveis.

## Entregas

- nova aba `Relatórios → Planejamento`;
- planos mensais ou anuais;
- distribuição da renda por envelopes;
- limites dinâmicos por categoria;
- estratégias de redução de dívidas;
- priorização de metas e reserva;
- comparação plano x realizado;
- recomendações explicáveis;
- calendário de decisões;
- revisão mensal com aceite manual;
- ativação protegida por checksum;
- schema 9 e comandos Tauri;
- testes TypeScript e Rust integrados à suíte existente.

## Aplicação

```powershell
.\13_APLICAR_FASE_12.cmd
.\13_VALIDAR_FASE_12.cmd
```

A Fase 12 exige a base `0.11.0` validada. O script de aplicação altera somente as versões dos manifests; os arquivos funcionais são entregues no pacote incremental.
