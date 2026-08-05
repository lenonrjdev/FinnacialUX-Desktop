# Build, release e atualizações

## Fluxos atuais

- Configurar: `01_CONFIGURAR_DESKTOP.cmd`.
- Desenvolver: `02_RODAR_DESKTOP.cmd`.
- Instalador local: `03_GERAR_INSTALADOR.cmd` ou `03A_GERAR_INSTALADOR_OFFLINE.cmd`.
- Configurar updater: `04_CONFIGURAR_ATUALIZACOES.cmd`.
- Gerar/finalizar release genérica: `05_GERAR_RELEASE.cmd` e `05B_FINALIZAR_RELEASE_EXISTENTE.cmd`.
- Publicar release existente: `06_PUBLICAR_RELEASE_GITHUB.cmd`.
- Validar projeto: `VALIDAR_PROJETO.cmd`.
- Assinatura/release estável 1.5.0: comandos `25_CONFIGURAR_ASSINATURA_WINDOWS`, `25_VALIDAR_AMBIENTE_ASSINATURA_WINDOWS`, `25_GERAR_ATUALIZACAO_ESTAVEL`, `25_HOMOLOGAR_ATUALIZACAO_ESTAVEL` e `25_PUBLICAR_ATUALIZACAO_ESTAVEL`.

O updater Tauri assina o pacote para que o aplicativo reconheça atualizações legítimas. Authenticode assina PE/MSI para que o Windows reconheça o publisher e o timestamp. Uma assinatura não substitui a outra.

A release 1.5.0 está em modo `bootstrap-full-installer` porque a 1.4.0 não possui homologação manual completa. Não declarar upgrade 1.4.0 → 1.5.0 como homologado. Metadados locais ficam em `releases/1.5.0`; binários não são rastreados. Publicação futura exige validação automática, Authenticode e matriz manual real; esta tarefa não publica instaladores.
