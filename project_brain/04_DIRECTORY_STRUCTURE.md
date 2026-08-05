# Estrutura de diretórios

- `app/`: rotas do App Router e páginas exportadas estaticamente.
- `components/`: UI e painéis funcionais.
- `lib/`: domínio frontend e adaptadores tipados para o desktop.
- `types/`: contratos TypeScript compartilhados.
- `src-tauri/`: configuração Tauri, Rust, capabilities, migrations e recursos nativos.
- `release/`: políticas, freeze de schema, notas e checklists rastreados.
- `releases/`: artefatos locais ignorados pelo Git; a versão 1.5.0 é preservada.
- `scripts/cli/`: implementação dos quatro comandos públicos.
- `scripts/core/`: helper de execução segura e cache verificado do libsodium.
- `scripts/development/`: preparação do ambiente local.
- `scripts/installer/`: build NSIS local/offline.
- `scripts/validation/`: suíte consolidada e servidor estático E2E.
- `scripts/signing/`: Authenticode, certificado, SignTool, timestamp e relatórios Windows.
- `scripts/updater/`: configuração segura do updater Tauri.
- `scripts/release/`: build, finalização, manifestos, validação e homologação.
- `scripts/publication/`: integração explícita com GitHub Release.
- `project_brain/`: contexto técnico e operacional ativo.

Diretórios como `node_modules/`, `.next/`, `out/`, `coverage/`, `.cache/` e `src-tauri/target/` são regeneráveis e não fazem parte da arquitetura versionada.
