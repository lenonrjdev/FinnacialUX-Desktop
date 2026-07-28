# Fase 5 — Instalador, atualizações e distribuição

Versão: 0.5.0

## Entregas

- Updater oficial do Tauri integrado à interface.
- Assinatura obrigatória de pacotes de atualização.
- Verificação manual e automática com intervalo configurável.
- Notas de versão e progresso de download.
- Backup SQLCipher criptografado antes de atualizar.
- Recuperação do marcador de sessão quando a instalação falha.
- Setup NSIS para o usuário atual, sem exigir administrador.
- Setup offline opcional com WebView2 incorporado.
- Scripts de configuração da chave, build da release e publicação no GitHub.
- Workflow de GitHub Actions preparado.
- Configurador opcional para assinatura Authenticode do Windows.
- Preservação dos dados locais durante atualização e desinstalação padrão.

## Comandos

1. `04_CONFIGURAR_ATUALIZACOES.cmd` — gera a chave fora do projeto e configura o endpoint.
2. `05_GERAR_RELEASE.cmd` — cria o setup, `.sig`, `latest.json`, hash e manifesto.
3. `06_PUBLICAR_RELEASE_GITHUB.cmd` — publica a release com GitHub CLI.
4. `07_CONFIGURAR_ASSINATURA_WINDOWS.cmd` — conecta um certificado de assinatura de código já instalado no Windows.
5. `03A_GERAR_INSTALADOR_OFFLINE.cmd` — gera uma variante grande que instala sem internet.

## Regra crítica

A chave privada e sua senha não podem ser enviadas ao GitHub, incluídas em ZIPs ou copiadas para o instalador. O arquivo público `src-tauri/tauri.updater.conf.json` contém somente a chave pública e pode ser versionado. O arquivo `src-tauri/tauri.release.conf.json` habilita a geração dos artefatos `.sig` somente durante a release. A identidade de editor exibida pelo Windows exige um certificado Authenticode separado; o projeto apenas prepara essa integração e nunca cria um certificado confiável por conta própria.

## Testes mínimos

- Instalar 0.5.0 em uma máquina limpa.
- Publicar uma versão posterior de teste.
- Confirmar detecção da atualização no aplicativo instalado.
- Confirmar criação do backup `pre_update`.
- Confirmar instalação e reabertura com os dados preservados.
- Confirmar que uma instalação sobre a versão anterior não remove AppData, Stronghold ou backups.
- Testar falha de rede e verificar que o app permanece utilizável.
