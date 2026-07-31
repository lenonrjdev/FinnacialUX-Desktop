# Checklist de homologação — 0.18.0-rc.1

## Automático

- [ ] ESLint e React Compiler
- [ ] TypeScript
- [ ] testes unitários e cobertura
- [ ] build Next.js estático
- [ ] Playwright
- [ ] testes Rust e Cargo Check
- [ ] npm audit sem vulnerabilidades altas ou críticas
- [ ] schema 14 congelado e hashes conferidos
- [ ] atualização dos schemas 1, 4, 7, 10, 13 e 14
- [ ] instalador, `.sig`, `latest.json` e SHA-256

## Windows 10

- [ ] instalação limpa
- [ ] abertura, login local e bloqueio
- [ ] bandeja e notificações
- [ ] importação e exportação
- [ ] desinstalação verificada

## Windows 11

- [ ] instalação limpa
- [ ] abertura, login local e bloqueio
- [ ] bandeja e notificações
- [ ] importação e exportação
- [ ] desinstalação verificada

## Atualização

- [ ] instalar `0.17.0` e criar dados de teste
- [ ] gerar backup criptografado
- [ ] atualizar para `0.18.0-rc.1`
- [ ] confirmar schema 14
- [ ] confirmar preservação de contas, lançamentos, anexos e preferências
- [ ] simular falha de instalação e confirmar retomada segura

## Publicação

- [ ] tag `desktop-v0.18.0-rc.1`
- [ ] GitHub Release marcada como pré-release
- [ ] `make_latest=false`
- [ ] instalador não substitui a versão estável
- [ ] notas, privacidade, segurança e inventário incluídos
