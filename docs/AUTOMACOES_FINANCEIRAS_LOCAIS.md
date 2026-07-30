# Automações financeiras locais

A versão `0.10.0` adiciona um motor de automações executado dentro do Tauri e do banco SQLCipher. Nenhuma regra, lançamento, alerta ou recorrência é enviada para serviços externos.

## Princípios de segurança

1. Toda aplicação começa com uma simulação.
2. A simulação recebe um checksum dos documentos que originaram a prévia.
3. A aplicação recalcula o checksum e recusa dados alterados depois da simulação.
4. As alterações são gravadas em uma única transação SQLite.
5. O histórico guarda snapshot somente dos módulos afetados.
6. O desfazer compara o checksum do estado posterior antes de restaurar.
7. O modo somente leitura da Fase 9 bloqueia aplicação, desfazer, preferências e dispensa de alertas.

## Fontes processadas

- `automation-rules`: regras de categorização existentes;
- histórico de `transactions`: sugestões locais somente quando ao menos dois lançamentos com a mesma descrição concordam em 75% ou mais sobre a categoria;
- `recurring-templates`: modelos programados pelo usuário;
- `transactions`: lançamentos a revisar ou gerar;
- `payables`: contas próximas ou vencidas;
- `receivables`: recebimentos esperados ou atrasados;
- `subscriptions`: cobranças futuras de assinaturas.

## Sugestões pelo histórico

O motor só sugere uma categoria para lançamentos vazios, em “Outros” ou “Sem categoria”. A sugestão exige pelo menos dois lançamentos locais com a mesma descrição normalizada e concordância mínima de 75%. Regras explícitas sempre têm prioridade e nenhuma sugestão é gravada sem seleção na prévia.

## Recorrências

As recorrências podem ser semanais, mensais, trimestrais ou anuais. O motor limita cada simulação a 12 ocorrências vencidas por modelo para impedir geração acidental sem limite. Lançamentos gerados recebem `sourceType=automation-recurrence` e um identificador determinístico, evitando duplicidade para a mesma data.

## Execuções reversíveis

Uma execução pode ser desfeita enquanto:

- estiver com estado `applied`;
- não tiver sido desfeita anteriormente;
- os módulos afetados ainda corresponderem ao checksum gravado após a execução.

Caso qualquer lançamento seja alterado posteriormente, o motor bloqueia o desfazer para não sobrescrever trabalho novo.

## Alertas

Os alertas são derivados localmente, considerando a janela configurada entre 1 e 60 dias. Itens dispensados são registrados em `automation_alert_states`, sem modificar os documentos financeiros originais.
