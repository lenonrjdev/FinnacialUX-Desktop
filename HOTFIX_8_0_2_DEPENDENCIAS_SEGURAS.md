# FinnacialUX Desktop — Hotfix 8.0.2

## Objetivo

Eliminar as vulnerabilidades altas detectadas após a consolidação da Fase 8.0.1 sem executar `npm audit fix --force`, sem migrar para versões preview/canary e sem alterar os módulos financeiros.

## Atualizações controladas

- Next.js fixado na versão estável `16.2.12`.
- `eslint-config-next` alinhado em `16.2.12`.
- ESLint atualizado para `10.8.0`, usando a configuração flat já adotada pelo projeto.
- Vitest e cobertura V8 atualizados juntos para `4.1.10`.
- PostCSS fixado em `8.5.23`.
- Sharp fixado em `0.35.3`.
- Playwright mantido em `1.61.1` para não misturar uma atualização não relacionada ao incidente.
- Overrides por linha de compatibilidade para `brace-expansion`.

## Estratégia do lockfile

O hotfix não transporta um lockfile criado fora da máquina do projeto. O comando `09_CORRIGIR_VULNERABILIDADES.cmd`:

1. salva `package.json` e `package-lock.json` anteriores;
2. remove a árvore JavaScript antiga;
3. gera um lockfile novo a partir das versões revisadas;
4. instala por `npm ci`;
5. verifica a árvore com `npm ls`;
6. exige `npm audit --audit-level=high` aprovado;
7. restaura os manifests anteriores automaticamente se a correção não puder ser consolidada.

O novo `package-lock.json` deve ser incluído no commit.

## Validação obrigatória

Após aplicar o hotfix:

```powershell
.\09_CORRIGIR_VULNERABILIDADES.cmd
.\08_VALIDAR_QUALIDADE.cmd
```

A Fase 8.0.2 só está concluída quando a auditoria, os 39 testes unitários, cobertura, build, quatro testes Playwright, cinco testes Rust e Cargo Check forem aprovados.

## Não executar

```powershell
npm audit fix --force
```

Esse comando pode trocar versões principais sem respeitar a arquitetura consolidada.
