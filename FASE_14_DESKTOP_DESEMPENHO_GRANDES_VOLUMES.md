# Fase 14 — Desempenho e grandes volumes

**Versão:** 0.14.0  
**Schema SQLCipher:** 11

## Objetivo

Garantir que o aplicativo continue responsivo com anos de lançamentos,
extratos extensos e históricos operacionais, sem coletar telemetria externa e
sem enfraquecer as proteções das fases anteriores.

## Entregas

- paginação nativa de lançamentos;
- índice SQLCipher derivado e verificável por checksum;
- filtros por período, tipo, situação, conta, categoria e texto;
- reconstrução em lotes canceláveis;
- importações de conciliação com progresso por lote;
- fallback somente leitura sem escrita de cache;
- métricas sanitizadas de duração e quantidade;
- benchmark local contra meta configurável;
- manutenção por ANALYZE, PRAGMA optimize e WAL checkpoint;
- índices adicionais para conciliação, fechamentos e automações;
- painel Configurações → Desempenho;
- testes TypeScript e Rust;
- scripts de aplicação e homologação.

## Segurança

O documento `finance_documents/transactions` permanece como fonte de verdade.
O índice é descartável, não contém chaves e pode ser reconstruído. Operações de
manutenção e cancelamento respeitam o modo somente leitura.
