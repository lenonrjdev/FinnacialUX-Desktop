# FinnacialUX Desktop — Hotfix 8.0.4

## Objetivo

Corrigir a validação do Hotfix 8.0.3 sem alterar as versões seguras já resolvidas.

## Causa corrigida

O staging 8.0.3 foi criado dentro da raiz do projeto. O npm interpretou o projeto original como um pacote local vinculado e o `npm ls --all` comparou a árvore 0.8.3 com o manifesto antigo 0.8.2. Isso gerou falsos erros `missing` e `extraneous`.

## Mudanças

- staging movido para a pasta temporária do Windows, fora da raiz;
- remoção da validação bloqueante `npm ls --all`;
- validador próprio para package.json, package-lock.json e dependências diretas;
- bloqueio explícito contra dependência do projeto nele mesmo;
- auditoria alta/crítica mantida como gate obrigatório;
- instalação final feita novamente na raiz por `npm ci`;
- Cargo.toml e tauri.conf.json só mudam depois da auditoria final;
- restauração completa de manifests, configuração nativa e node_modules em caso de falha.

## Aplicação

```powershell
cd "C:\Projetos\FinnacialUxDesktop"
.\09_CORRIGIR_VULNERABILIDADES.cmd
.\08_VALIDAR_QUALIDADE.cmd
```

## Resultado esperado

```text
HOTFIX 8.0.4 CONSOLIDADO COM SUCESSO
Manifesto, lockfile e node_modules representam a mesma arvore auditada.
```
