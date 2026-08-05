# Regras de desenvolvimento

1. Preserve o funcionamento local-first e os contratos tipados.
2. Não use mocks como fonte definitiva quando existe persistência real.
3. Não altere schema sem migration sequencial, freeze atualizado e testes históricos.
4. Nunca exponha chaves, senhas, PFX, tokens, bancos ou caminhos privados.
5. Não modifique release, updater ou assinatura sem validar os artefatos aplicáveis.
6. Os únicos comandos públicos são os quatro `.cmd` numerados de 01 a 04; novas implementações pertencem à pasta interna adequada em `scripts/`.
7. Não duplique build, validação, assinatura ou publicação entre wrappers.
8. Use `scripts/core/command-runner.ps1`: `try/catch` e `$?` para PowerShell; `$LASTEXITCODE` imediatamente após executáveis nativos.
9. Não use `Invoke-Expression`; passe argumentos como arrays e parâmetros PowerShell como hashtables.
10. Mantenha TypeScript estrito, Rust tipado e adaptadores desktop centralizados.
11. Atualize testes e Project Brain quando comportamento, estado ou comandos mudarem.
12. Pesquise referências em package, workflows e scripts antes de remover arquivos.
13. Execute `03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd -SomenteValidar` antes de commit/push.
14. Preparação e publicação são etapas separadas; testes nunca confirmam publicação.
15. Não relaxe gates manuais para transformar ausência de evidência em aprovação.
