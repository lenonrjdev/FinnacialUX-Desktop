# Regras de desenvolvimento

1. Preserve o funcionamento local-first e os contratos tipados.
2. Não use mocks ou dados demonstrativos como fonte definitiva quando existe persistência real.
3. Não altere schema sem migration sequencial, atualização do freeze e testes históricos.
4. Nunca exponha chaves, senhas, PFX, tokens, bancos ou caminhos privados.
5. Não modifique release, updater ou assinatura sem validar os artefatos aplicáveis.
6. Não crie scripts temporários sem finalidade, proprietário e plano de remoção.
7. Mantenha TypeScript estrito, Rust tipado e adaptadores de desktop centralizados.
8. Atualize testes para mudanças de comportamento.
9. Atualize o Project Brain quando arquitetura, estado ou comandos mudarem.
10. Não invente dependências, rotas, tabelas, comandos Tauri ou serviços externos.
11. Pesquise referências em package, workflows e scripts antes de remover arquivos.
12. Execute `VALIDAR_PROJETO.cmd` antes de commit/push e não esconda falhas.
13. Não relaxe gates manuais para transformar ausência de evidência em aprovação.
