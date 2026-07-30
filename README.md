# FinnacialUX Desktop

Aplicativo desktop offline do FinnacialUX, construído com Tauri 2, Next.js,
React, TypeScript e SQLCipher. A versão `0.8.0` reúne criptografia integral do banco local, Stronghold,
Argon2id, PIN, backups criptografados, atualizações assinadas, integração
nativa com o Windows, acessibilidade, portabilidade protegida dos dados e uma
suíte automatizada de regressão para os fluxos críticos.

Este projeto é separado do **FinnacialUX Core**. O Core continua sendo a versão
web com NestJS, Prisma, PostgreSQL e Docker. O Desktop reaproveita a interface e
as regras financeiras, mas salva os dados no próprio computador.

## Estrutura

```text
FinnacialUX Desktop/
├── app/
├── components/
├── content/
├── data/
├── lib/
│   ├── api/       # contratos preservados do Core
│   └── desktop/   # adaptadores locais para a ponte SQLCipher
├── types/
├── src-tauri/
│   ├── capabilities/
│   ├── icons/
│   ├── migrations/
│   ├── src/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── scripts/
├── 01_CONFIGURAR_DESKTOP.cmd
├── 02_RODAR_DESKTOP.cmd
└── 03_GERAR_INSTALADOR.cmd
```

## Pré-requisitos no Windows

- Windows 10 ou 11;
- Node.js 22 LTS;
- Rust com toolchain MSVC;
- Microsoft C++ Build Tools com **Desktop development with C++**;
- Microsoft Edge WebView2;
- Strawberry Perl para compilar o OpenSSL incorporado ao SQLCipher;
- NASM recomendado para otimizações nativas.

## Configurar

Na raiz do projeto:

```powershell
.\01_CONFIGURAR_DESKTOP.cmd
```

## Executar

```powershell
.\02_RODAR_DESKTOP.cmd
```

O Next.js é iniciado apenas como servidor de desenvolvimento e o Tauri abre a
janela nativa. Não inicie pelo navegador para testar o SQLite do Desktop.


## Validar a qualidade da Fase 8

Na raiz do projeto, execute:

```powershell
.\08_VALIDAR_QUALIDADE.cmd
```

O comando instala as dependências necessárias e executa lint, TypeScript,
testes unitários com cobertura, build estático, Playwright, testes Rust,
validação das migrations e `cargo check`. Nenhuma correção de dependência é
aplicada com `--force`.

Relatórios locais:

```text
coverage/
playwright-report/
test-results/
```

Consulte também [`docs/TESTES_E_REGRESSAO.md`](docs/TESTES_E_REGRESSAO.md).

## Gerar o instalador

```powershell
.\03_GERAR_INSTALADOR.cmd
```

O instalador será criado em:

```text
src-tauri\target\release\bundle\nsis\
```

## Primeiro acesso

O Desktop não possui usuário de demonstração. Na primeira abertura:

1. escolha **Criar conta gratuita**;
2. cadastre seu nome, e-mail e senha local;
3. o aplicativo criará um espaço financeiro pessoal vazio;
4. todos os registros seguintes serão salvos no SQLite deste computador.

## Persistência, criptografia e proteção de dados

Os dados permanecem no computador depois de fechar o aplicativo ou reiniciar o
Windows. O arquivo principal é criptografado integralmente com SQLCipher e sua
chave fica protegida pelo Stronghold. Não apague a pasta de dados nem o cofre do
aplicativo sem antes criar um backup portátil com senha.

Em **Configurações → Backups**, é possível criar arquivos `.fuxbackup`, ativar
backups automáticos e restaurar uma cópia validada. Em **Configurações →
Diagnóstico**, o aplicativo verifica a integridade do SQLite, mostra o histórico
de schema e exporta um pacote técnico sem informações financeiras.

Leia também:

- `FASE_1_DESKTOP.md`;
- `FASE_2_DESKTOP_PROTECAO_DADOS.md`;
- `FASE_3_DESKTOP_SEGURANCA_LOCAL.md`;
- `FASE_4_DESKTOP_BANCO_SQLCIPHER.md`;
- `FASE_5_DESKTOP_DISTRIBUICAO_ATUALIZACOES.md`;
- `FASE_6_DESKTOP_EXPERIENCIA_ACESSIBILIDADE.md`;
- `FASE_7_DESKTOP_PORTABILIDADE_DADOS.md`;
- `docs/OPERACAO_BACKUP_RECUPERACAO.md`;
- `docs/SEGURANCA_LOCAL.md`;
- `docs/CRIPTOGRAFIA_BANCO_SQLCIPHER.md`;
- `docs/EXPERIENCIA_DESKTOP_ACESSIBILIDADE.md`;
- `docs/ARQUITETURA_DESKTOP.md`;
- `docs/CORE_REUSE_MANIFEST.md`.


## Fase 5 — releases assinadas

Para configurar o canal estável e gerar uma release atualizável:

```powershell
.\04_CONFIGURAR_ATUALIZACOES.cmd
# opcional, quando houver certificado de editor instalado no Windows:
.\07_CONFIGURAR_ASSINATURA_WINDOWS.cmd
.\05_GERAR_RELEASE.cmd
.\06_PUBLICAR_RELEASE_GITHUB.cmd
```

Use `03_GERAR_INSTALADOR.cmd` para testes locais e `03A_GERAR_INSTALADOR_OFFLINE.cmd` para uma instalação sem internet. Nunca envie a chave privada do updater junto do projeto.


## Fase 6 — experiência nativa e acessibilidade

A versão `0.6.0` adiciona estado persistente da janela, bandeja do sistema,
inicialização opcional com o Windows, notificações nativas, central de comandos,
atalhos, métricas locais, ajuda interna e preferências de acessibilidade.

Acesse **Configurações → Desktop**, **Configurações → Acessibilidade** ou pressione
`F1` para abrir a nova área de ajuda. Para encerrar completamente quando
“Fechar para a bandeja” estiver ativo, use o item **Encerrar FinnacialUX** no
menu do ícone próximo ao relógio do Windows.


## Fase 7 — importação e portabilidade

A versão `0.7.0` permite importar CSV, OFX, XLSX e XLS, exportar os módulos em
CSV, JSON ou Excel e transferir o espaço financeiro entre computadores usando
um pacote `.fuxportable` protegido por senha.

Acesse **Dados e automações → Portabilidade** para gerar modelos, exportar uma
planilha completa, criar um pacote portátil ou desfazer uma importação pelo
histórico local. O pacote portátil não contém PIN, senha, chave SQLCipher ou
segredos do Stronghold.
