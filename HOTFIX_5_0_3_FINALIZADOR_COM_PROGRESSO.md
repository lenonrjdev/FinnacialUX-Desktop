# FinnacialUX Desktop — Hotfix 5.0.3

## Finalizador de release com progresso e escrita atomica

Corrige a falta de retorno visual do `05B_FINALIZAR_RELEASE_EXISTENTE.cmd`.
O finalizador anterior podia aparentar congelamento enquanto copiava o instalador,
aguardava o arquivo ser liberado pelo Windows/antivirus ou calculava o SHA-256.

### Alteracoes

- informa cada etapa do processo;
- mostra o progresso da copia do instalador;
- copia primeiro para `.partial` e somente depois publica o arquivo final;
- abre o instalador de origem permitindo compartilhamento de leitura;
- mostra progresso durante o calculo do SHA-256;
- remove residuos parciais de uma tentativa interrompida;
- informa exatamente a etapa que falhou;
- valida os seis arquivos finais antes de concluir;
- preserva o instalador e a assinatura em `src-tauri/target`.

### Recuperacao

Encerre apenas o PowerShell que executa `05_GERAR_RELEASE.ps1`, aplique este
hotfix na raiz do projeto e rode:

```powershell
.\05B_FINALIZAR_RELEASE_EXISTENTE.cmd
```

Nao execute um novo build e nao apague `src-tauri\target`.
