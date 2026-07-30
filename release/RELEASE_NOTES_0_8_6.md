# FinnacialUX Desktop 0.8.6

## Dependências seguras

- torna a camada de compatibilidade do minimatch uma dependência direta e verificável;
- faz a camada declarar sua própria implementação segura `minimatch-secure@10.2.6`;
- elimina a dependência do hoisting do npm durante runtime e testes;
- preserva o override transitivo dos consumidores antigos do ESLint;
- mantém `brace-expansion 5.0.8`, auditoria alta/crítica e staging externo obrigatório.
