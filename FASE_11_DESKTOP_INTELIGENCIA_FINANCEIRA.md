# Fase 11 — Inteligência financeira local

Versão: `0.11.0`  
Schema: `8`

## Objetivo

Transformar a projeção simples dos relatórios em uma central de planejamento
explicável, totalmente local e segura para testar decisões sem alterar os dados
reais.

## Entregas

- horizontes de 30, 60, 90 e 365 dias;
- cenários conservador, esperado e otimista;
- projeção diária e consolidação mensal;
- risco de saldo negativo e meses deficitários;
- taxa de renda comprometida e cobertura de reserva;
- comparação previsto versus realizado;
- detecção local de gastos atípicos;
- previsão de conclusão das metas;
- simulador de entradas, compras e compromissos mensais;
- cenários persistidos no SQLCipher;
- histórico resumido de leituras com checksum;
- bloqueio de gravações em modo somente leitura;
- testes TypeScript e Rust;
- integração com backups, continuidade e schema 8.

## Aplicação

```powershell
.\12_APLICAR_FASE_11.cmd
.\12_VALIDAR_FASE_11.cmd
```
