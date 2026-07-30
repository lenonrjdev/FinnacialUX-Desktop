# Fase 7 — Importação, exportação e portabilidade de dados

Versão: 0.7.0

## Objetivo

Permitir que os dados financeiros entrem e saiam do FinnacialUX de forma controlada, verificável e reversível, mantendo todo o processamento offline e protegido pelo banco SQLCipher.

## Entregas

- Importação de CSV, OFX, XLSX e XLS.
- Detecção automática de separador, cabeçalhos, datas e moedas em padrão brasileiro.
- Mapeamento de colunas e prévia editável antes da confirmação.
- Regras automáticas aplicadas antes da importação.
- Detecção de possíveis duplicidades por data, descrição e valor.
- Importação atômica com snapshot integral do espaço antes da gravação.
- Histórico de portabilidade no schema 5 do banco SQLCipher.
- Desfazer importações reversíveis.
- Exportação em CSV, JSON e Excel.
- Exportação Excel completa com uma aba por conjunto de dados.
- Modelos oficiais em CSV e XLSX.
- Pacote protegido `.fuxportable` para migração entre computadores.
- Criptografia do pacote com PBKDF2-SHA256 e AES-256-GCM.
- Checksum SHA-256 do payload e de cada módulo.
- Importação por mesclagem ou substituição completa.
- Seletores nativos do Windows por meio dos plugins oficiais de diálogo e sistema de arquivos do Tauri.

## Fluxo de importação de planilha

```text
Selecionar arquivo
→ processar localmente
→ detectar cabeçalhos
→ mapear colunas
→ aplicar regras
→ identificar duplicidades
→ revisar linhas
→ salvar snapshot anterior
→ importar em transação
→ registrar operação
→ permitir desfazer
```

## Pacote portátil

O formato `.fuxportable` contém um envelope JSON criptografado. O payload possui:

```text
produto e versão do formato
versão do FinnacialUX de origem
data da exportação
identificador do espaço de origem
documentos financeiros
checksum individual de cada módulo
totais de módulos e registros
```

O pacote não contém:

```text
senha de login
PIN local
chave SQLCipher
chave do Stronghold
segredos do updater
credenciais do Windows
```

Ao importar em outro computador, os dados são gravados no banco SQLCipher já protegido pela chave local daquele dispositivo.

## Modos de importação

### Mesclar

- Mantém os módulos existentes.
- Atualiza registros que possuem o mesmo identificador.
- Adiciona registros novos.
- Preserva módulos ausentes no pacote.

### Substituir

- Remove os documentos financeiros atuais do espaço.
- Grava exatamente os documentos existentes no pacote.
- Mantém usuários, preferências de segurança, backups e chaves locais.

Ambos os modos registram um snapshot anterior e podem ser desfeitos pelo histórico enquanto a operação estiver marcada como reversível.

## Nova migration

```text
src-tauri/migrations/0005_data_portability.sql
```

A tabela `portability_operations` armazena metadados, checksums, módulos afetados e snapshots de recuperação dentro do próprio banco criptografado.

## Validação mínima no Windows

1. Executar `01_CONFIGURAR_DESKTOP.cmd`.
2. Confirmar schema 5 no diagnóstico.
3. Abrir `Dados e automações`.
4. Importar um CSV e desfazer pelo histórico.
5. Importar uma planilha XLSX.
6. Exportar CSV, JSON e XLSX.
7. Gerar os dois modelos oficiais.
8. Criar um `.fuxportable` com senha forte.
9. Validar que senha incorreta não abre o pacote.
10. Importar o pacote por mesclagem e confirmar os dados.
11. Desfazer a importação e confirmar o estado anterior.
12. Gerar e publicar a release `desktop-v0.7.0`.

## Commit recomendado

```text
feat(portability): adiciona importação, exportação e transferência protegida de dados
```

```powershell
git add .

git commit -m "feat(portability): adiciona importação, exportação e transferência protegida de dados" `
  -m "Implementa importação local de CSV, OFX, XLSX e XLS com prévia, mapeamento e detecção de duplicidades." `
  -m "Adiciona exportações CSV, JSON e Excel, modelos oficiais e seletores nativos de arquivos." `
  -m "Cria pacotes .fuxportable criptografados, checksums SHA-256, histórico no schema 5 e importações reversíveis." `
  -m "Mantém todo o processamento offline e protegido pelo banco SQLCipher."
```

A partir desta fase, cada nova fase, ação de manutenção e hotfix deve ser encerrado com um commit no padrão Conventional Commits:

```text
feat(<escopo>): para fases e novas capacidades
fix(<escopo>): para hotfixes e correções
chore(<escopo>): para release, dependências e manutenção técnica
docs(<escopo>): para documentação sem alteração funcional
```
