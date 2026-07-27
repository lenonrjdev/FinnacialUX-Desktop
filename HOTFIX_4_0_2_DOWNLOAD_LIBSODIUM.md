# FinnacialUX Desktop — Hotfix 4.0.2

## Motivo

A validação da Fase 4 chegou ao build nativo, mas o `libsodium-sys-stable` perdeu a conexão durante o download e encerrou com `UnexpectedEof: Peer disconnected`.

## Correção

- baixa os arquivos oficiais do libsodium antes do Cargo;
- realiza até cinco tentativas por arquivo;
- guarda os arquivos em `.cache/libsodium`;
- entrega o cache ao build por `SODIUM_DIST_DIR`;
- mantém a verificação Minisign feita pelo próprio `libsodium-sys-stable`;
- executa até três tentativas do `cargo check`;
- limpa somente o build temporário do libsodium entre tentativas;
- reutiliza o mesmo cache no modo de desenvolvimento e no build do instalador;
- ignora `.cache/` no Git.

## Aplicação

Extraia o pacote na raiz do projeto e substitua os arquivos. Depois execute:

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\01_CONFIGURAR_DESKTOP.cmd
```

Não apague o banco, Stronghold, backups, `node_modules` ou todo o `src-tauri/target`.
