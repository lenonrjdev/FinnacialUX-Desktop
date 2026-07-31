# Hotfix 20.0.3 — Documentação final da release 1.1.0

## Problema

O build NSIS e a assinatura do updater eram concluídos, mas o finalizador genérico recriava `releases/1.1.0` depois que os documentos estáveis haviam sido copiados. A verificação final então falhava por ausência de `SUPPORT.md`.

## Correção

- sincroniza novamente manifestos e documentos depois da finalização do instalador;
- inclui `SUPPORT.md` na raiz para garantir a fonte do artefato;
- reutiliza instalador, assinatura, `latest.json`, checksums e manifesto já gerados quando estão íntegros;
- adiciona `-ForceRebuild` para solicitar uma recompilação intencional;
- preserva versão `1.1.0`, schema SQLCipher 14 e modo bootstrap.

## Execução

```powershell
.\21_GERAR_ATUALIZACAO_ESTAVEL.cmd -SkipQuality
```

Para recompilar intencionalmente:

```powershell
.\21_GERAR_ATUALIZACAO_ESTAVEL.cmd -SkipQuality -ForceRebuild
```
