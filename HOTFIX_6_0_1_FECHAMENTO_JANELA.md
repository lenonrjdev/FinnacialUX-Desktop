# FinnacialUX Desktop — Hotfix 6.0.1

## Fechamento da janela e bandeja do Windows

Este hotfix corrige o erro exibido ao clicar no botão **X** da janela:

```text
window.destroy not allowed
Permissions associated with this command: core:window:allow-destroy
```

## Causa

A Fase 6 registra um listener `onCloseRequested` para decidir entre:

- encerrar completamente o FinnacialUX; ou
- ocultar a janela na bandeja do Windows.

O conjunto `core:window:default` não inclui permissões destrutivas ou de ocultação. Por isso, o fechamento normal era bloqueado pelo ACL do Tauri.

## Correção

Foram adicionadas somente estas permissões para a janela `main`:

```json
"core:window:allow-destroy",
"core:window:allow-hide"
```

Comportamento esperado:

- **Fechar para a bandeja desativado:** o botão X encerra a janela e o aplicativo;
- **Fechar para a bandeja ativado:** o botão X oculta a janela e mantém o ícone próximo ao relógio;
- **Encerrar FinnacialUX**, no menu da bandeja, encerra completamente o processo.

## Segurança

A correção não amplia acesso a arquivos, banco, rede, shell ou comandos arbitrários. As duas permissões ficam limitadas à capability da janela `main`.

## Aplicação

1. Encerre o modo de desenvolvimento com `Ctrl + C`.
2. Extraia o ZIP na raiz do projeto.
3. Permita substituir `src-tauri/capabilities/default.json`.
4. Execute `01_CONFIGURAR_DESKTOP.cmd`.
5. Execute `02_RODAR_DESKTOP.cmd` e teste o botão X nos dois modos.

Não é necessário apagar `node_modules`, `src-tauri/target`, banco, Stronghold ou backups.
