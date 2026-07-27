# FinnacialUX Desktop

Aplicativo desktop offline do FinnacialUX, construído com Tauri 2, Next.js,
React, TypeScript e SQLite.

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
│   └── desktop/   # implementações locais SQLite
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
- Microsoft Edge WebView2.

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

## Persistência

Os dados permanecem no computador depois de fechar o aplicativo ou reiniciar o
Windows. Não apague a pasta de dados do aplicativo sem antes criar um backup.

Leia também:

- `FASE_1_DESKTOP.md`;
- `docs/ARQUITETURA_DESKTOP.md`;
- `docs/CORE_REUSE_MANIFEST.md`.
