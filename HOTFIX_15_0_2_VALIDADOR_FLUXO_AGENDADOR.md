# Hotfix 15.0.2 — Validador do fluxo do agendador

## Problema

A suíte completa da versão 0.15.0 foi aprovada, mas o verificador complementar exigia literalmente `startBackgroundScheduler(true)` no provedor.

A implementação usa corretamente uma função intermediária:

- `refreshPreferences(true)` durante a inicialização;
- `refreshPreferences(false)` após alterações nas preferências;
- `startBackgroundScheduler(runStartup)` dentro dessa função.

O falso negativo ocorria porque o validador não reconhecia o encaminhamento do parâmetro.

## Correção

O validador agora confirma estruturalmente que:

1. `refreshPreferences` recebe `runStartup: boolean`;
2. o corpo encaminha `runStartup` para `startBackgroundScheduler(runStartup)`;
3. a inicialização usa `refreshPreferences(true)`;
4. a reconfiguração usa `refreshPreferences(false)`;
5. notificações, timer e eventos permanecem integrados.

Nenhum arquivo de produção, migration, dependência ou versão foi alterado.

- Versão: `0.15.0`
- Schema SQLCipher: `12`
