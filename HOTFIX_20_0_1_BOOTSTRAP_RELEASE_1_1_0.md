# Hotfix 20.0.1 — Bootstrap seguro da release 1.1.0

## Causa

As Fases 18, 19 e 20 foram distribuídas corretamente como pacotes incrementais para serem sobrepostos ao mesmo projeto acumulado. O bloqueio não foi causado pela ausência de um pacote completo.

A Fase 20 exigia obrigatoriamente estes artefatos gerados fora do código-fonte:

- `releases/1.0.0/STABLE_VALIDATION_REPORT.json`;
- `releases/1.0.0/release-manifest.json`.

Eles só seriam produzidos depois de gerar e homologar manualmente o instalador 1.0.0. Como a Fase 19 foi validada no código, mas a release 1.0.0 não foi efetivamente gerada, homologada, commitada e marcada com tag, a evidência não existia. O gerador 1.1.0 tratava essa ausência como bloqueio absoluto.

## Correção

O fluxo agora permite dois modos:

1. `bootstrap-full-installer`: usado automaticamente quando não existe uma release anterior homologada. Gera a 1.1.0 como primeiro instalador estável completo e registra explicitamente que o upgrade a partir da 1.0.0 não foi validado.
2. `stable-update`: usado quando a evidência anterior existe e está homologada.

O modo estrito continua disponível com `-RequirePreviousReleaseEvidence`.

## Segurança preservada

- nenhum relatório da 1.0.0 é criado artificialmente;
- nenhum teste de upgrade é marcado como realizado;
- assinatura, checksum, instalação limpa, backup, restauração e canal Latest continuam obrigatórios;
- o teste `-UpgradeFrom100` só é obrigatório quando existe uma baseline 1.0.0 homologada;
- schema SQLCipher 14 e versão 1.1.0 permanecem inalterados.
