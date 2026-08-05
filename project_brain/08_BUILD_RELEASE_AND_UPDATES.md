# Build, release e atualizações

## Comandos oficiais

- `01_RODAR_PROJETO.cmd`: desenvolvimento diário. Confere Node, npm, Rust, Cargo e Perl, instala o lockfile somente quando `node_modules` está ausente, prepara o cache verificado do libsodium e inicia `npm run desktop:dev`.
- `02_GERAR_INSTALADOR.cmd`: oferece instalador local, offline ou de release. `-Offline` inclui o WebView2; `-Release` delega ao fluxo assinado. Nenhum modo publica.
- `03_VALIDAR_E_PREPARAR_ATUALIZACAO.cmd`: executa qualidade e segurança e prepara a release 1.5.0. Aceita `-SomenteValidar`, `-ReutilizarArtefatos`, `-Offline` e `-ForceRebuild`; a execução padrão reutiliza artefatos somente quando eles passam pelos gates.
- `04_PUBLICAR_ATUALIZACAO.cmd`: publicação externa separada. Exige Git limpo em `main`, artefatos e hashes válidos, Authenticode com publisher/timestamp, assinatura do updater, homologação manual completa e confirmação `PUBLICAR-1.5.0`.

## Organização interna

`scripts/cli/` implementa os quatro comandos. `core/` contém execução segura e cache nativo; `development/`, `installer/`, `validation/`, `signing/`, `updater/`, `release/` e `publication/` isolam responsabilidades permanentes. Scripts internos não são atalhos públicos.

O updater Tauri assina o pacote para que o aplicativo reconheça atualizações legítimas. Authenticode assina executáveis/instaladores para que o Windows reconheça publisher e timestamp; uma assinatura não substitui a outra. A chave privada do updater e a configuração Authenticode permanecem fora do Git.

A release 1.5.0 está em modo `bootstrap-full-installer` porque a 1.4.0 não possui homologação manual completa. Não declarar upgrade 1.4.0 → 1.5.0 como homologado. Metadados locais ficam em `releases/1.5.0`; binários não são rastreados. Preparar nunca publica, e publicar nunca recompila.
