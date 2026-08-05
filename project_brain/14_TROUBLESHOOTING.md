# Troubleshooting

- ExecutionPolicy: execute os `.cmd`; eles iniciam PowerShell com `Bypass` apenas no processo.
- `$LASTEXITCODE`: leia somente logo após executáveis nativos. Para scripts/funções PowerShell use `try/catch` e `$?`.
- Splatting: scripts PowerShell com parâmetros nomeados exigem hashtable e `@Parameters`; arrays transformam `-ConfigPath` em argumento posicional.
- Authenticode inválido: valide configuração local, certificado com chave privada/EKU, publisher e acesso ao timestamp; nunca regrave o instalador depois do `.sig` do updater.
- Certificado autoassinado: pode validar a mecânica local, mas não substitui identidade pública confiável em distribuição real.
- Updater: chave privada e senha ficam fora do projeto; a chave pública não deve ser regenerada durante correções.
- NSIS: temporários `nst*.tmp` só são assináveis quando possuem cabeçalho MZ e assinatura PE válida.
- SQLCipher: falhas de abertura podem indicar chave incorreta, corrupção ou migração incompleta; use diagnóstico/backup, não SQLite em claro.
- npm: `npm ci` exige lockfile alinhado; não use `npm audit fix --force` sem avaliação.
- Tauri/Rust: confirme MSVC, Perl e cache/libsodium; use `cargo check --manifest-path src-tauri/Cargo.toml`.
- Build: o export Next deve gerar `out/`; avisos do Vite sobre config nativa são externos e não bloquearam os testes atuais, mas devem ser reavaliados em upgrade do Vite/Vitest.
