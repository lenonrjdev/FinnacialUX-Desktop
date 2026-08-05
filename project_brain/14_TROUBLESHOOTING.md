# Troubleshooting

- ExecutionPolicy: execute os quatro `.cmd`; eles usam `Bypass` apenas no processo filho.
- Ferramenta ausente no comando 01: instale Node 22.13+, Rust MSVC/Cargo ou Strawberry Perl conforme a mensagem; `node_modules` é instalado por `npm ci` somente quando ausente.
- Porta 3000 ocupada: encerre a execução Tauri/Next anterior antes de usar `01_RODAR_PROJETO.cmd`.
- Desenvolvimento: o aviso `Slow filesystem detected` do Next.js/Turbopack indica desempenho do disco local; ele não é falha quando o servidor chega a `Ready` e o aplicativo Tauri abre.
- `$LASTEXITCODE`: leia imediatamente após `node.exe`, `npm.cmd`, `cargo.exe`, `git.exe`, `gh.exe` ou SignTool. Para scripts PowerShell, use `try/catch` e `$?`.
- Splatting: scripts PowerShell exigem hashtable e `@Parameters`; comandos nativos recebem arrays de argumentos.
- Instalador local/offline: `02_GERAR_INSTALADOR.cmd -Offline` inclui WebView2 e pode ser maior; ambos executam pré-validação antes do Tauri.
- Authenticode inválido: valide configuração local, certificado com chave privada/EKU, publisher e timestamp. Nunca regrave o instalador depois do `.sig`.
- Certificado autoassinado: testa a mecânica local, mas não substitui identidade pública confiável.
- Updater: chave privada e senha ficam fora do projeto; a chave pública não deve ser regenerada durante correções.
- Reutilização bloqueada: use `-ForceRebuild` apenas quando os artefatos existentes falharem e o ambiente completo de assinatura estiver pronto.
- Publicação bloqueada: Git deve estar limpo em `main`, a matriz manual deve estar completa e a tag não pode existir.
- NSIS: temporários `nst*.tmp` só podem ser assinados quando são PE válidos.
- SQLCipher: use diagnóstico/backup; nunca substitua o banco cifrado por SQLite em claro.
- Linker Rust: avisos `LNK4099` sobre PDB de libsodium/OpenSSL afetam apenas símbolos de depuração das bibliotecas estáticas; são não bloqueantes quando testes e `cargo check` terminam com código zero.
- Vite/Vitest: o aviso sobre carregamento nativo da configuração é conhecido e não bloqueante na versão atual; reavalie em upgrade.
