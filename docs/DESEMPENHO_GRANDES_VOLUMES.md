# Desempenho e grandes volumes

A Fase 14 prepara o FinnacialUX Desktop para históricos extensos sem abandonar
o modelo offline e criptografado.

## Paginação nativa

Os lançamentos continuam tendo o documento financeiro como fonte de verdade.
O schema 11 cria um índice derivado com campos de busca, data, conta, categoria,
tipo e situação. O índice guarda também o JSON original de cada lançamento.

Antes de responder uma consulta, o núcleo compara o checksum do documento com
o checksum do índice. Quando houver diferença, o índice é reconstruído em
lotes. No modo somente leitura, nenhuma tabela é alterada: a consulta usa um
fallback em memória para preservar a integridade.

## Importações em lotes

A conciliação prepara extratos em lotes de 100 a 2.000 itens. Entre os lotes, o
núcleo consulta o pedido de cancelamento e publica o evento
`performance://progress`. O cancelamento ocorre antes da transação atômica que
substitui os lançamentos e registra o extrato.

## Métricas locais

As métricas registram apenas tipo da operação, quantidade, duração, situação e
metadados técnicos. Valores, descrições, contas e categorias não entram no
histórico de desempenho.

## Manutenção

A ação de manutenção executa:

1. `ANALYZE` para atualizar estatísticas;
2. `PRAGMA optimize` para recomendações internas do SQLite;
3. `PRAGMA wal_checkpoint(PASSIVE)` para consolidar o journal quando aplicável.

A manutenção respeita o modo somente leitura e nunca executa `VACUUM` de forma
automática, evitando cópias integrais inesperadas de bancos grandes.

## Limites

- página: 25 a 250 lançamentos;
- lote: 100 a 2.000 itens;
- meta de consulta: 50 a 10.000 ms;
- histórico visual: 20 operações e 20 métricas recentes;
- cancelamento: somente operações em fila ou execução.
