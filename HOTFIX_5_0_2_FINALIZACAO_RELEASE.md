# FinnacialUX Desktop — Hotfix 5.0.2

## Finalizacao de release apos o Tauri concluir o bundle

Este hotfix corrige um caso observado no Windows em que o instalador NSIS e o
arquivo `.sig` sao gerados com sucesso, mas o processo intermediario do `npm`
permanece aberto e impede o script de continuar para a organizacao da release.

## Alteracoes

- `05_GERAR_RELEASE.ps1` passa a chamar `node_modules/.bin/tauri.cmd` diretamente,
  sem manter um processo `npm` intermediario.
- Foi adicionada uma mensagem clara entre o fim do build e a organizacao dos
  artefatos.
- Foi criado `05B_FINALIZAR_RELEASE_EXISTENTE.cmd` para reutilizar o instalador e
  a assinatura ja gerados, sem recompilar e sem pedir novamente a senha da chave.
- O finalizador valida o `.sig`, gera `latest.json`, `SHA256SUMS.txt`,
  `release-manifest.json` e copia as notas da versao.

## Recuperacao da tentativa atual

1. Confirme que a tela mostra `Finished 1 updater signature`.
2. Pressione `Ctrl + C` uma vez.
3. Aplique este hotfix na raiz do projeto.
4. Execute:

```powershell
.\05B_FINALIZAR_RELEASE_EXISTENTE.cmd
```

A pasta esperada e:

```text
releases\0.5.0\
```

Nao execute `cargo clean` e nao apague `src-tauri\target`, pois o finalizador
reutiliza exatamente os artefatos que ja foram produzidos.
