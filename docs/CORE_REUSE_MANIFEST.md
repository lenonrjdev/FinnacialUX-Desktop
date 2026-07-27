# Manifesto de reaproveitamento do FinnacialUX Core

## Reaproveitado integralmente

- `app/` — páginas estáticas compatíveis;
- `components/` — dashboard, módulos, formulários, tema e loaders;
- `content/` — textos fixos;
- `data/` — estados vazios e configurações iniciais;
- `types/` — contratos financeiros;
- regras de busca e inteligência em `lib/financial-intelligence.ts`;
- tema persistente, Poppins, sidebar, cabeçalho e navegação sem flashes.

## Adaptado para Desktop

- `next.config.ts` — mudou de servidor standalone para `output: "export"`;
- `lib/api/*` — mantém o contrato público e chama SQLite local;
- autenticação — conta local em vez de cookies HTTP;
- persistência — SQLite em vez de NestJS/PostgreSQL;
- recuperação de senha — token local em vez de e-mail;
- mensagens de interface — modo offline/Desktop;
- rota raiz — redirecionamento no cliente compatível com exportação estática.

## Não copiado

- backend NestJS;
- Prisma/PostgreSQL;
- Docker e scripts do Core;
- rotas dinâmicas de convite;
- placeholder dinâmico `[modulo]`.
