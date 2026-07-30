# FinnacialUX Desktop 0.8.0

## Qualidade e regressão

Esta versão adiciona a primeira suíte automatizada completa do Desktop. Os recursos da Fase 7 agora são protegidos por testes unitários, ponta a ponta e nativos.

### Incluído

- cobertura automatizada de CSV, OFX, XLS e XLSX;
- validação de datas e moedas brasileiras;
- testes de automações e duplicidades;
- testes de exportações e modelos oficiais;
- testes criptográficos do `.fuxportable`;
- validação de senha incorreta e pacote adulterado;
- Playwright para os fluxos públicos;
- testes Rust das migrations e do SQLCipher;
- validação de snapshots e rollback;
- workflow Windows e comando único de qualidade.

### Banco de dados

Não há nova migration. O schema continua na versão 5.

### Atualização

A atualização de `0.7.0` para `0.8.0` preserva o banco local, chaves, backups, preferências e histórico de portabilidade.
