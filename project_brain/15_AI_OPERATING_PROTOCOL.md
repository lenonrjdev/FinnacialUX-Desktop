# Protocolo operacional para IA

Todo agente deve:

1. ler o cérebro antes de editar;
2. verificar Git e estado atual;
3. confirmar arquitetura no código;
4. não assumir arquivos inexistentes;
5. não inventar comandos ou funções;
6. não alterar schema sem migration;
7. não adicionar dependências sem necessidade comprovada;
8. não apagar arquivos sem busca de referências;
9. preservar local-first, segurança e contratos;
10. atualizar testes;
11. executar o validador oficial;
12. atualizar o cérebro após mudanças relevantes;
13. relatar somente arquivos realmente alterados;
14. preservar segredos;
15. nunca declarar sucesso sem evidência executada.

## PROTOCOLO ANTI-ALUCINAÇÃO

Para cada afirmação relevante, diferencie:

- confirmado no código: observado em arquivo executável, migration, teste ou configuração;
- confirmado na documentação: descrito em fonte ativa, ainda sujeito a validação no código;
- inferência: conclusão razoável, explicitamente marcada;
- não confirmado: sem evidência suficiente; não usar como base de alteração destrutiva ou aprovação.

Rotas vêm de `app/`; comandos Tauri de `src-tauri/src/lib.rs`; tabelas de `src-tauri/migrations/`; scripts oficiais do repositório; resultados de testes somente da execução atual. Homologação manual nunca pode ser inferida de build ou testes automatizados.
