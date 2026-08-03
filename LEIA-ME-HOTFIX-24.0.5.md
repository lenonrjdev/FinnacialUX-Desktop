# FinnacialUX Desktop - Hotfix 24.0.5

## Objetivo

Corrigir a sincronizacao entre `package.json` e `package-lock.json` depois do Hotfix 24.0.4.

O projeto possui a dependencia direta:

```json
"minimatch": "file:vendor/minimatch-v3-secure-compat"
```

O manifesto desse pacote local declara:

```json
"minimatch-secure": "npm:minimatch@10.2.6"
```

O staging do Hotfix 24.0.4 copiou o `package.json`, mas nao copiou a pasta `vendor/minimatch-v3-secure-compat`. Como consequencia, o lockfile novo nao registrou `minimatch-secure`, e o `npm ci` acumulado recusou a instalacao.

## O que o Hotfix 24.0.5 faz

- preserva o `package.json` seguro produzido pelo Hotfix 24.0.4;
- copia o pacote local completo para um staging externo;
- gera um lockfile novo sem reutilizar o lock antigo;
- exige a entrada `minimatch-secure@10.2.6` no lockfile;
- exige `brace-expansion` em versao corrigida;
- reproduz o lockfile com `npm ci` no staging;
- valida a API CommonJS compativel do minimatch;
- executa `npm audit --audit-level=high` sem correcoes automaticas;
- substitui somente `package-lock.json`;
- restaura o lock anterior automaticamente em caso de falha.

## Aplicacao

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\25_APLICAR_HOTFIX_24_0_5.cmd
```

Somente depois de `HOTFIX 24.0.5 APLICADO COM SUCESSO`:

```powershell
.\25_VALIDAR_HOTFIX_24_0_5.cmd
```

Nao execute novamente a Fase 24 nem os Hotfixes 24.0.1 a 24.0.4.
