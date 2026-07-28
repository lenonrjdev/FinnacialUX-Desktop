# FinnacialUX Desktop — Hotfix 5.0.4

## Finalizador de release em Node.js

Corrige o travamento do Windows PowerShell na etapa `Gerando latest.json`.

O finalizador não usa mais `ConvertTo-Json` nem a rotina manual de hash do PowerShell. A organização dos artefatos agora é feita por `scripts/finalize-release.mjs`, usando APIs nativas do Node.js.

## Alterações

- finalização de releases existentes sem PowerShell;
- geração atômica de `latest.json` e dos manifestos;
- cálculo SHA-256 pelo Node.js;
- repetição automática ao copiar arquivos temporariamente bloqueados;
- watchdog de 120 segundos;
- lock contra duas finalizações simultâneas;
- preservação do instalador e da assinatura originais;
- o build normal também usa o novo finalizador após o Tauri concluir.

## Aplicação

Extraia o conteúdo na raiz do projeto e substitua os arquivos existentes.

Para aproveitar a release já compilada:

```powershell
.\05B_FINALIZAR_RELEASE_EXISTENTE.cmd
```

Não execute novamente o build completo para a versão 0.5.0.
