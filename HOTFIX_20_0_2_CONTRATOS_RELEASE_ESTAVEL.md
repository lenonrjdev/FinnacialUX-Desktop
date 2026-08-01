# Hotfix 20.0.2 — Contratos da release estável

## Problema

A Fase 20 atualizou `release-candidate-panel.tsx` e os testes para usar o contrato estável introduzido na Fase 19, mas os arquivos que exportam esse contrato não foram incluídos no pacote incremental acumulado.

O TypeScript encontrou cinco erros relacionados a:

- `stableReleaseConfig` ausente;
- `ReleaseSnapshot` ausente;
- `promotedFrom` ausente em `ReleaseReadinessReport`.

## Correção

O hotfix restaura os contratos estáveis em:

- `lib/release-candidate.ts`;
- `types/release-candidate.ts`.

`stableReleaseConfig` é carregado de `release/stable-release.json`, que já está configurado para a versão `1.1.0` e o schema SQLCipher 14.

## Impacto

- nenhuma migration nova;
- nenhuma dependência nova;
- nenhuma alteração no SQLCipher;
- nenhuma alteração no bootstrap da release;
- versão mantida em `1.1.0`;
- schema mantido em `14`.

## Validação

Depois de extrair o hotfix, execute somente:

```powershell
.\21_VALIDAR_FASE_20.cmd
```
