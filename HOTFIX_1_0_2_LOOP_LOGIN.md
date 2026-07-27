# FinnacialUX Desktop — Hotfix 1.0.2

## Correção

Remove o loop infinito de navegação em `/login/` que deixava a janela Tauri preta.

O projeto utiliza `trailingSlash: true`, mas a lista de rotas públicas comparava apenas caminhos sem a barra final. Com isso, `/login/` era interpretada como uma rota protegida e redirecionada repetidamente para a própria tela de login.

## Alterações

- normalização de caminhos com e sem barra final;
- reconhecimento correto das páginas públicas;
- proteção para executar o redirecionamento de sessão somente uma vez;
- padronização do logout para `/login/`.

## Aplicação

1. Encerre `tauri dev` com `Ctrl + C`.
2. Extraia este ZIP diretamente na raiz do FinnacialUX Desktop.
3. Exclua os caches `.next` e `src-tauri/target/debug` se necessário.
4. Execute `02_RODAR_DESKTOP.cmd` novamente.
