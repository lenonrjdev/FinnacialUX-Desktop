# FinnacialUX Desktop — Hotfix 24.0.7

## Objetivo

Corrigir a sanitização de erros da assinatura Windows sem alterar dependências, lockfile, versão ou schema.

## Causa

A expressão regular histórica usada para remover caminhos Windows aceitava espaços e consumia todo o restante da linha. Assim, uma mensagem como:

```text
C:\segredos\cert.pfx password=abc token=xyz ...
```

virava apenas `[CAMINHO_REMOVIDO]`, impedindo a presença explícita de `[SEGREDO_REMOVIDO]` exigida pelo teste e pela política de suporte seguro.

## Alterações

- processa hashes, senhas e tokens antes dos caminhos;
- suporta caminhos entre aspas contendo espaços;
- limita caminhos sem aspas ao primeiro espaço;
- adiciona teste de regressão para preservar o restante da mensagem;
- remove o import `writeFile` não utilizado de `scripts/windows-signing.mjs`;
- não altera `package.json` nem `package-lock.json`.

## Aplicação

```powershell
.\25_APLICAR_HOTFIX_24_0_7.cmd
.\25_VALIDAR_HOTFIX_24_0_7.cmd
```

Não reaplique a Fase 24 nem os hotfixes anteriores.
