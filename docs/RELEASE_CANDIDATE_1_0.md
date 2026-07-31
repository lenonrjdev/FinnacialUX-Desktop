# Release Candidate para o FinnacialUX Desktop 1.0

A Fase 18 congela o schema em 14 e muda o foco de desenvolvimento para homologação. Não devem ser adicionadas migrations, módulos financeiros ou alterações de formato até a promoção para `1.0.0`, salvo correções indispensáveis encontradas na RC.

## Fluxo

1. aplicar e validar a Fase 18;
2. configurar o updater e a assinatura de editor quando disponível;
3. gerar a RC com `19_GERAR_RELEASE_CANDIDATE.cmd`;
4. instalar em máquinas de teste Windows 10 e 11;
5. validar atualização a partir de `0.17.0` com dados de teste;
6. registrar a homologação manual;
7. publicar a tag como pré-release;
8. corrigir somente regressões bloqueadoras;
9. promover para `1.0.0` em uma fase separada.

## Build reproduzível

O manifesto `RC_BUILD_MANIFEST.json` registra hashes dos manifests, lockfiles disponíveis, configurações e migrations. O inventário `DEPENDENCY_INVENTORY.json` registra dependências diretas npm e Cargo. O instalador final recebe SHA-256 e assinatura do updater.

## Schema congelado

`release/schema-freeze-14.json` contém o SHA-256 de cada migration. Alterar uma migration existente ou criar a migration 15 faz a validação falhar. Correções de comportamento devem ser feitas no código, preservando a compatibilidade do banco.

## Promoção

A RC não é a versão estável. O GitHub Release deve usar `prerelease=true` e não pode ser marcada como `Latest`. A promoção para `1.0.0` exige checklist completo e uma tag nova.
