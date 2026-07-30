# Inteligência financeira local

A versão 0.11.0 adiciona uma camada de planejamento que processa os dados já
armazenados no SQLCipher. O motor não envia lançamentos, saldos, metas ou
cenários para APIs externas.

## Fontes consideradas

- saldo das contas incluídas no total;
- lançamentos concluídos e futuros;
- contas a pagar e recebimentos recorrentes;
- assinaturas ativas;
- parcelas de dívidas e compras;
- aportes mensais das metas, quando habilitados;
- hipóteses temporárias informadas no simulador.

## Cenários

Os cenários conservador, esperado e otimista alteram somente as premissas da
projeção. Eles não modificam registros financeiros. Ajustes manuais de receita,
despesas, entradas únicas e novos compromissos também permanecem restritos ao
simulador.

## Explicabilidade

Cada evento projetado registra origem, confiança e justificativa. O checksum da
fonte muda quando os dados ou as hipóteses mudam. Leituras registradas guardam
apenas o resumo da projeção e o checksum, permitindo comparar previsões sem
duplicar todo o acervo financeiro.

## Anomalias

A detecção usa medianas de períodos anteriores, evitando tratar um único mês
atípico como padrão. A sensibilidade pode ser configurada. Nenhuma categoria é
alterada automaticamente.

## Segurança

- preferências, cenários e leituras são armazenados no banco criptografado;
- gravações são recusadas quando o modo somente leitura está ativo;
- hipóteses têm limite de tamanho e validação nativa;
- valores monetários persistidos pelo Rust usam centavos inteiros;
- backups e pontos de recuperação passam a reconhecer o schema 8.
