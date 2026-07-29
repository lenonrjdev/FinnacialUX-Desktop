# Hotfix 6.0.2 — Navegação sem piscar

## Problema corrigido

O indicador `.desktop-route-progress` tinha largura de 38% e altura de 3 px. Como ele era renderizado como filho direto do `body`, a regra global `body > div { min-height: 100%; }` elevava sua altura mínima para toda a janela. Durante a navegação, ele aparecia como um painel roxo ocupando a lateral esquerda.

## Alterações

- remove o estado `routeBusy`;
- remove o listener global de cliques em links;
- remove o indicador visual de troca de rota;
- remove a animação e o CSS relacionados;
- mantém navegação, atalhos, central de comandos e demais recursos da Fase 6.

## Arquivos alterados

- `components/providers/desktop-experience-provider.tsx`
- `app/globals.css`

## Segurança

Não altera banco SQLCipher, Stronghold, backups, updater, instalador, autenticação ou dados financeiros.
