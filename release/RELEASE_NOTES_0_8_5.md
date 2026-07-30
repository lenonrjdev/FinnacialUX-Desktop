# FinnacialUX Desktop 0.8.5

## Segurança de dependências

- remove da árvore o `minimatch 3.1.5` transitivo afetado pela cadeia vulnerável de expansão de chaves;
- adiciona uma camada local de compatibilidade com a API CommonJS esperada pelos plugins antigos do ESLint;
- delega a execução ao pacote oficial `minimatch 10.2.6` e ao `brace-expansion 5.0.8` corrigido;
- mantém ESLint 9.39.4 para evitar uma migração major desnecessária;
- valida manifesto, lockfile, versões transitivas, API compatível e auditoria antes de alterar o projeto original.
