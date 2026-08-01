# Hotfix 21.0.1 — Evidência estável UTF-8 com BOM

Corrige a leitura do `STABLE_VALIDATION_REPORT.json` homologado pela Fase 20 quando o Windows PowerShell grava o JSON em UTF-8 com BOM.

## Alterações

- remove somente o BOM inicial antes do `JSON.parse`;
- mantém obrigatórios versão, schema, matriz manual completa, canal Latest e SHA-256 do instalador;
- adiciona regressão automática com relatório e manifesto gravados no formato real do Windows PowerShell;
- preserva a versão 1.2.0 e o schema SQLCipher 14.
