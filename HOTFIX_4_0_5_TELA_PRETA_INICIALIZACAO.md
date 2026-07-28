# Hotfix 4.0.5 — tela preta na inicialização

## Sintoma

O executável nativo compilava e iniciava, mas a janela permanecia preta após `Running target\\debug\\finnacialux-desktop.exe`.

## Correções

- O modo de desenvolvimento abre diretamente em `/login/`.
- A rota raiz ganhou redirecionamento imediato no HTML, sem depender apenas da hidratação do React.
- A verificação de encerramento inesperado deixou de bloquear toda a árvore visual.
- Uma espera superior a seis segundos libera a interface e mostra um aviso não destrutivo.
- A tela vazia foi substituída por indicador visível de inicialização.
- Foi adicionado um Error Boundary que mostra erros de interface em vez de uma janela preta.
- `freezePrototype` foi desativado para evitar um endurecimento opcional sobre o `Object.prototype` no protocolo de produção; CSP e capabilities continuam ativas.

## Arquivos

- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `components/providers/client-error-boundary.tsx`
- `components/providers/desktop-recovery-gate.tsx`
- `src-tauri/tauri.conf.json`
