# FinnacialUX Desktop — Hotfix 24.0.6

## Correção

O Hotfix 24.0.5 consolidou corretamente:

- `brace-expansion@5.0.9`;
- `minimatch-secure@10.2.6`;
- lockfile reproduzível por `npm ci`;
- auditoria npm sem vulnerabilidades.

A validação acumulada ainda continha uma regra histórica invertida:

```js
entry.version !== "5.0.8"
```

Essa comparação rejeitava a versão corrigida `5.0.9`. O Hotfix 24.0.6 altera somente
`scripts/validate-installed-dependencies.mjs`, passando a validar os limites seguros
por linha principal:

- linha 1: `>=1.1.18`;
- linha 2: `>=2.1.4`;
- linha 3: `>=3.0.6`;
- linha 4: rejeitada;
- linha 5: `>=5.0.9`.

Nenhuma dependência, versão do aplicativo, schema, package.json, package-lock.json ou
arquivo vendor é alterado.

## Execução

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\25_APLICAR_HOTFIX_24_0_6.cmd
.\25_VALIDAR_HOTFIX_24_0_6.cmd
```
