# Arquitetura do FinnacialUX Desktop

## Separação dos produtos

### FinnacialUX Core

Aplicação web/servidor já existente:

- Next.js;
- NestJS;
- Prisma;
- PostgreSQL;
- Docker;
- autenticação e espaços compartilhados;
- preparado para sincronização e uso por várias pessoas.

O Core não é substituído nem modificado por este projeto.

### FinnacialUX Desktop

Aplicativo instalado no computador:

- Tauri 2;
- Next.js exportado estaticamente;
- React, TypeScript e Tailwind;
- SQLite local;
- funcionamento sem internet;
- instalador Windows NSIS;
- interface reaproveitada do Core.

## Fluxo de dados da Fase 1

```text
Interface React reaproveitada
        ↓
contratos em lib/api
        ↓
adaptadores em lib/desktop
        ↓
Tauri SQL Plugin
        ↓
finnacialux.db (SQLite local)
```

Os componentes continuam consumindo os mesmos contratos `authApi`, `usersApi`,
`workspacesApi` e `financeDataApi`. Somente a implementação foi substituída.
Isso reduz a quantidade de alterações visuais e preserva a lógica financeira já
construída no FinnacialUX Core.

## Banco local

O arquivo `finnacialux.db` é criado automaticamente na pasta de configuração do
aplicativo. O schema inicial contém:

- `users`;
- `user_preferences`;
- `workspaces`;
- `finance_documents`;
- `password_reset_tokens`.

Os documentos financeiros mantêm a mesma divisão por módulo usada pelo Core.

## Limites deliberados da Fase 1

- não existe sincronização Desktop ↔ Core;
- convites e colaboração online permanecem no Core;
- backups nativos de arquivo entram na fase seguinte;
- o cofre Stronghold e a proteção ampliada entram na fase de segurança;
- o instalador ainda não possui assinatura digital.
