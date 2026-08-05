# Estrutura de diretórios

- `app/`: rotas do App Router e composição das páginas.
- `components/`: componentes por domínio, providers, elementos compartilhados e segurança.
- `content/` e `data/`: conteúdo estático e definições locais usadas pela interface.
- `lib/`: motores TypeScript, regras de apresentação e adaptadores `lib/desktop/`.
- `types/`: contratos compartilhados do frontend e da ponte desktop.
- `tests/`: testes unitários/integração e `tests/e2e/`.
- `src-tauri/src/`: comandos e motores Rust.
- `src-tauri/migrations/`: migrations SQL imutáveis do schema 1 ao 14.
- `src-tauri/capabilities/`: permissões explícitas dos plugins Tauri.
- `scripts/`: scripts operacionais atuais de configuração, build, release, assinatura e validação.
- `release/`: configurações e documentos da release atual; configuração local privada é ignorada.
- `releases/`: artefatos locais gerados e ignorados pelo Git.
- `.github/workflows/`: qualidade, validação de release e distribuição.
- `project_brain/`: contexto técnico central.

Diretórios como `node_modules/`, `.next/`, `out/`, `coverage/`, `playwright-report/`, `test-results/` e `src-tauri/target/` são gerados e não fazem parte da arquitetura versionada.
