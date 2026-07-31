# Hotfix 17.0.1 — Retorno do comando de onboarding

## Problema

`window.dispatchEvent(...)` retorna um valor booleano. O contrato `DesktopCommand.run` aceita apenas `void` ou `Promise<void>`, causando TS2345 durante a validação da Fase 17.

## Correção

A emissão do evento foi movida para um bloco de função sem retorno explícito:

```tsx
run: () => {
  window.dispatchEvent(new CustomEvent("finnacialux-onboarding-open-request"));
},
```

O comportamento permanece o mesmo: o comando solicita a abertura do guia inicial. Somente o tipo de retorno passa a ser `void`.

## Estado preservado

- Versão: 0.17.0
- Schema SQLCipher: 14
- Nenhuma migration alterada
- Nenhuma dependência alterada
- Nenhum comando Rust alterado
