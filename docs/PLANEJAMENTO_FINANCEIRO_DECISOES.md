# Planejamento financeiro orientado por decisões

A Fase 12 transforma as projeções locais em planos mensais ou anuais sem executar pagamentos, criar lançamentos ou alterar orçamentos automaticamente.

## Princípios

1. A projeção da Fase 11 é a fonte inicial do plano.
2. A simulação é recalculada a cada alteração e recebe um checksum determinístico.
3. Um plano só pode ser ativado quando o checksum salvo corresponde à simulação apresentada.
4. Somente um plano fica ativo por espaço financeiro.
5. A ativação gera um calendário de decisões, não transações financeiras.
6. Revisões mensais registram plano, realizado, desvios e ajustes aceitos.
7. O modo somente leitura bloqueia preferências, salvamento, ativação, revisões e decisões.

## Envelopes de renda

A renda mensal é distribuída entre essenciais, estilo de vida, dívidas, metas, reserva e margem flexível. A soma acima de 100% bloqueia a ativação. A margem flexível abaixo de 5% gera atenção.

## Limites por categoria

O limite usa o orçamento do mês quando disponível. Sem orçamento, usa a média dos últimos três meses concluídos. Um ajuste geral entre -50% e +100% pode ser simulado sem alterar o orçamento real.

## Estratégias de dívida

- `avalanche`: maior taxa de juros primeiro;
- `snowball`: menor saldo primeiro;
- `priority`: prioridade cadastrada e, em seguida, juros.

A simulação considera juros mensais, parcelas mínimas e pagamento extra. O resultado é explicável e não registra pagamentos.

## Metas e reserva

O envelope de metas é dividido por prioridade. A conclusão estimada é comparada com a data desejada. A reserva usa as contas incluídas no total e o envelope de essenciais para estimar meses de cobertura.

## Revisão mensal

Uma revisão pode ser registrada apenas para um plano ativo. Ela guarda:

- checksum das fontes;
- resumo do plano;
- desvios do mês;
- ajustes aceitos;
- notas do usuário.

## Persistência SQLCipher

O schema 9 adiciona:

- `financial_planning_preferences`;
- `financial_plans`;
- `financial_plan_reviews`;
- `financial_planning_decisions`.

Todo o conteúdo permanece no banco criptografado local e entra nos fluxos existentes de backup, integridade e recuperação.
