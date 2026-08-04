# FinnacialUX Desktop — Hotfix 24.0.9

Corrige a validação do EKU de Code Signing sob `Set-StrictMode`.

## Causa

O Hotfix 24.0.8 ainda acessava propriedades opcionais como `.Value` diretamente em alguns objetos retornados pelo provedor de certificados. Sob `Set-StrictMode`, um formato diferente do objeto encerrava a validação.

## Correção

- usa primeiro o filtro nativo `Get-ChildItem -CodeSigningCert` e compara o thumbprint;
- usa indexação segura de `PSObject.Properties`;
- mantém análise tipada da extensão EKU como fallback;
- não altera o certificado;
- não altera `release/windows-signing.local.json`;
- não altera `package.json`, `package-lock.json`, versão ou schema.

## Aplicação

```powershell
.\25_APLICAR_HOTFIX_24_0_9.cmd
.\25_VALIDAR_HOTFIX_24_0_9.cmd
```

O certificado autoassinado é adequado somente para homologação local. Para distribuição pública, use um certificado comercial confiável ou serviço de assinatura de código.
