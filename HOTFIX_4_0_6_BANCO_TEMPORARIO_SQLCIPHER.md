# FinnacialUX Desktop — Hotfix 4.0.6

## Banco temporário SQLCipher no Windows

Este hotfix corrige o erro SQLite `code: 14 - unable to open database` durante a primeira conversão do banco local para SQLCipher.

## Causa

A conexão principal era aberta sem a flag de criação de arquivos. Durante o `ATTACH DATABASE`, o SQLCipher recebia o caminho de um banco temporário ainda inexistente e podia falhar ao criá-lo no Windows.

## Correções

- prepara previamente o arquivo temporário antes do `ATTACH DATABASE`;
- confirma que a pasta local existe e é gravável;
- remove arquivos auxiliares `-wal`, `-shm` e `-journal` de tentativas interrompidas;
- remove bancos temporários órfãos de conversão e restauração;
- limpa o arquivo temporário se o `ATTACH` ou o `sqlcipher_export` falhar;
- aplica a mesma proteção aos snapshots usados por backup e restauração;
- não altera o banco principal até a conversão e a validação final terminarem.

## Arquivo alterado

- `src-tauri/src/encrypted_database.rs`

## Aplicação

1. Encerre o modo de desenvolvimento com `Ctrl + C`.
2. Feche qualquer processo `finnacialux-desktop.exe` restante.
3. Extraia este pacote na raiz do projeto e permita a substituição.
4. Execute `01_CONFIGURAR_DESKTOP.cmd`.
5. Após a validação, execute `02_RODAR_DESKTOP.cmd`.

O banco SQLite original permanece preservado até que o banco SQLCipher temporário tenha sido criado, migrado e validado.
