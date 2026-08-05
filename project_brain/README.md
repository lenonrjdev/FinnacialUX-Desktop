# Project Brain — FinnacialUX Desktop

Esta pasta é a fonte central de contexto técnico do FinnacialUX Desktop. O código, as migrations e as configurações executáveis continuam sendo a fonte primária; o cérebro documenta o estado confirmado sem substituí-los.

## ORDEM OBRIGATÓRIA PARA UMA IA

1. `README.md`
2. `PROJECT_STATE.json`
3. `11_CURRENT_STATE.md`
4. `03_ARCHITECTURE.md`
5. `09_DEVELOPMENT_RULES.md`
6. arquivo específico relacionado à tarefa

Para banco, leia `05_DATA_AND_DATABASE.md`; para Tauri, release ou assinatura, leia `07_DESKTOP_TAURI.md` e `08_BUILD_RELEASE_AND_UPDATES.md`; para validação, leia `10_VALIDATION_AND_TESTING.md`.

Os únicos comandos operacionais públicos ficam na raiz: `01_RODAR_PROJETO.cmd`, `02_GERAR_INSTALADOR.cmd`, `03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd` e `04_PUBLICAR_ATUALIZACAO.cmd`. Implementações internas ficam em `scripts/` e não devem ser apresentadas ao usuário como fluxos concorrentes.

Atualize o cérebro no mesmo commit de mudanças arquiteturais, de schema, segurança, release, comandos operacionais ou estado atual. Nunca registre senhas, chaves privadas, tokens, dados financeiros reais ou caminhos pessoais. Não invente rotas, comandos Tauri, tabelas, integrações, resultados de testes ou homologações manuais.
