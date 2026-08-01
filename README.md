# FinnacialUX Desktop

Aplicativo desktop offline do FinnacialUX, construído com Tauri 2, Next.js,
React, TypeScript e SQLCipher. A versão `1.0.0` reúne criptografia integral do banco local, Stronghold,
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

## Fase 9 — continuidade e recuperação

A versão `0.9.0` adiciona pontos de recuperação SQLCipher, verificação de
integridade, retenção e restauração atômica com modo somente leitura nativo.

## Fase 10 — automações financeiras locais

A versão `0.10.0` adiciona simulação obrigatória, regras, recorrências, alertas,
histórico reversível e aplicação atômica das automações.

## Fase 11 — inteligência financeira local

A versão `0.11.0` transforma a projeção financeira em uma central explicável
com horizontes de 30 a 365 dias, cenários, riscos, anomalias, previsão de metas
e simuladores que não alteram os dados reais.

```powershell
.\12_APLICAR_FASE_11.cmd
.\12_VALIDAR_FASE_11.cmd
```

Consulte também `docs/INTELIGENCIA_FINANCEIRA_LOCAL.md`.

## Fase 12 — planejamento financeiro orientado por decisões

A versão `0.12.0` transforma as projeções em planos mensais ou anuais com
envelopes de renda, limites dinâmicos, estratégias de dívidas, priorização de
metas, revisão mensal e calendário de decisões. Ativar um plano não cria
lançamentos nem executa pagamentos automaticamente.

```powershell
.\13_APLICAR_FASE_12.cmd
.\13_VALIDAR_FASE_12.cmd
```

Consulte também `docs/PLANEJAMENTO_FINANCEIRO_DECISOES.md`.

## Fase 13 — conciliação e fechamento financeiro

A versão `0.13.0` adiciona importação conciliável de CSV e OFX, correspondências
explicáveis, snapshot reversível, fechamento mensal, bloqueio de períodos,
reabertura auditada e comprovantes armazenados no SQLCipher.

```powershell
.\14_APLICAR_FASE_13.cmd
.\14_VALIDAR_FASE_13.cmd
```

Consulte também `docs/CONCILIACAO_FECHAMENTO_FINANCEIRO.md`.


## Fase 14 — desempenho e grandes volumes

A versão `0.14.0` adiciona paginação nativa sobre um índice derivado no
SQLCipher, filtros executados no banco, importações em lotes com progresso e
cancelamento, métricas locais sanitizadas, benchmark e manutenção com
`ANALYZE`, `PRAGMA optimize` e checkpoint. Nenhuma telemetria é enviada para
serviços externos.

```powershell
.\15_APLICAR_FASE_14.cmd
.\15_VALIDAR_FASE_14.cmd
```

A central fica em **Configurações → Desempenho**. Consulte também
`docs/DESEMPENHO_GRANDES_VOLUMES.md`.

## Fase 15 — rotinas locais e notificações nativas

A versão `0.15.0` adiciona um agendador local com fila persistente, prevenção de
concorrência, tentativas com backoff, horário silencioso, histórico auditável e
notificações nativas resumidas. As rotinas analisam vencimentos, riscos, metas,
orçamentos, fechamento, backups e automações, mas nunca alteram dados
financeiros sem a confirmação manual do usuário.

```powershell
.\16_APLICAR_FASE_15.cmd
.\16_VALIDAR_FASE_15.cmd
```

A central fica em **Configurações → Rotinas locais**. Consulte também
`docs/ROTINAS_LOCAIS_NOTIFICACOES.md`.

## Fase 16 — diagnóstico, auditoria e suporte local

A versão `0.16.0` amplia **Configurações → Diagnóstico** com auditoria explicável,
teste reversível de escrita, ensaio de restauração temporário, saúde de backups,
reparos técnicos controlados e pacote `.fuxsupport` verificável por SHA-256.
Nenhuma senha, chave, saldo, descrição ou documento financeiro é exportado.

```powershell
.\17_APLICAR_FASE_16.cmd
.\17_VALIDAR_FASE_16.cmd
```

Consulte também `docs/DIAGNOSTICO_AUDITORIA_SUPORTE.md`.


## Fase 17 — onboarding e experiência final

A versão `0.17.0` adiciona primeiros passos persistentes por espaço, busca global
com relevância e histórico local, ajuda contextual por tela, painel de progresso
e preferências dedicadas. Nenhum dado financeiro de demonstração é criado e o
guia respeita integralmente o modo somente leitura.

```powershell
.\18_APLICAR_FASE_17.cmd
.\18_VALIDAR_FASE_17.cmd
```

Use `F1` para ajuda da tela atual, `Shift + F1` para o manual completo e
`Ctrl + K` para pesquisar páginas, ações, configurações e ajuda. Consulte também
`docs/ONBOARDING_EXPERIENCIA_FINAL.md`.

## Fase 18 — Release Candidate

A versão candidata `0.18.0-rc.1` congela o schema SQLCipher em 14 e prepara instalação, atualização, assinatura, checksums, inventário e homologação para a versão 1.0.

Comandos principais:

```powershell
.\19_APLICAR_FASE_18.cmd
.\19_VALIDAR_FASE_18.cmd
.\19_GERAR_RELEASE_CANDIDATE.cmd
```



## Fase 19 — versão estável 1.0.0

A versão `1.0.0` promove a Release Candidate homologada para o canal estável,
mantém o schema SQLCipher congelado em 14 e adiciona o fluxo final de geração,
homologação e publicação como `Latest`.

```powershell
.\20_APLICAR_FASE_19.cmd
.\20_VALIDAR_FASE_19.cmd
.\20_GERAR_RELEASE_ESTAVEL.cmd
```

Após testar o instalador final em Windows 10 e 11, registre a homologação com
`20_HOMOLOGAR_RELEASE_ESTAVEL.cmd` e publique com
`20_PUBLICAR_RELEASE_ESTAVEL.cmd`. Consulte também
`docs/RELEASE_ESTAVEL_1_0.md` e `SUPPORT.md`.


## Versão 1.1.0 — manutenção pós-lançamento

A Fase 20 adiciona janela de manutenção, adiamento controlado de atualizações, prontidão de rollback e diário técnico local opt-in, mantendo o schema SQLCipher 14 congelado.

## Fase 21 — Backup automático e continuidade

A versão 1.3.0 conecta o motor nativo de backups ao ciclo do Desktop, com verificações em inicialização, foco e intervalo configurável, retenção, histórico local sanitizado e restauração assistida. O schema SQLCipher permanece congelado em 14.


## Recuperação comprovada 1.3.0

Configurações → Teste de recuperação abre e valida a cópia mais recente sem substituir o banco atual, mede RPO/RTO e apresenta um plano de desastre local.


## Versão 1.4.0 — backup externo criptografado

A Fase 23 adiciona redundância real em outro volume ou pasta sincronizada. Somente pacotes `.fuxbackup` já criptografados são copiados; cada arquivo recebe SHA-256, sidecar independente, escrita atômica e retenção segura. A chave do Stronghold nunca sai do dispositivo.
