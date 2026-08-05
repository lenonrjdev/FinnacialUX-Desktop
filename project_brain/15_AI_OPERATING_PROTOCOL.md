# Protocolo operacional para IA

Todo agente deve:

1. ler o Project Brain antes de editar;
2. verificar Git e estado atual;
3. confirmar arquitetura no código;
4. não assumir arquivos, comandos ou funções inexistentes;
5. preservar versão, schema, migrations, local-first e segredos;
6. não adicionar dependências sem necessidade comprovada;
7. não apagar arquivos sem busca de referências;
8. manter somente os quatro comandos públicos oficiais;
9. colocar implementação na pasta interna correta de `scripts/`;
10. preservar a separação entre preparar e publicar;
11. atualizar testes e documentação afetada;
12. executar `03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd -SomenteValidar`;
13. apresentar somente arquivos realmente alterados;
14. nunca confirmar publicação durante testes;
15. nunca declarar sucesso sem evidência executada.

## PROTOCOLO ANTI-ALUCINAÇÃO

Classifique afirmações relevantes como: confirmado no código, confirmado na documentação, inferência ou não confirmado. Rotas vêm de `app/`; comandos Tauri de `src-tauri/src/lib.rs`; tabelas das migrations; operações públicas dos quatro `.cmd`; resultados de teste apenas da execução atual. Homologação manual nunca pode ser inferida de build ou testes automatizados.
