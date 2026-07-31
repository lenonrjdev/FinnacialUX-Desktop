# Onboarding e experiência final

## Persistência

O progresso é salvo por `workspace_id`. Trocar de espaço financeiro troca também o checklist apresentado. As tabelas do schema 14 não armazenam valores, descrições, contas, categorias ou documentos financeiros.

## Conclusão automática

A sincronização observa somente contagens e estados booleanos:

- quantidade de contas;
- quantidade de lançamentos, pagamentos e recebimentos;
- existência de orçamento ou meta;
- Stronghold e bloqueio local preparados;
- existência de backup disponível.

A etapa de apresentação inicial continua manual para garantir que o usuário realmente tenha visto o fluxo.

## Modo protegido

Quando o SQLCipher entra em modo somente leitura:

- o estado atual do guia pode ser carregado;
- conclusões detectadas podem aparecer apenas em memória;
- nenhuma preferência, etapa ou evento é persistido;
- reiniciar, pular e concluir manualmente são bloqueados.

## Busca e privacidade

A busca global usa um catálogo estático de navegação, ações e ajuda. Ela não cria índice de lançamentos, comprovantes, saldos ou descrições financeiras.

## Acessibilidade

- foco restaurado ao fechar diálogos e painéis;
- `Esc` fecha as superfícies temporárias;
- elementos possuem títulos e rótulos acessíveis;
- redução de movimento respeitada;
- layout responsivo para telas menores;
- atalhos documentados na central de ajuda.
