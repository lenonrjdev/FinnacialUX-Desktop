# Diagnóstico, auditoria e suporte local

## Central de diagnóstico

Acesse:

```text
Configurações → Diagnóstico
```

A prévia inicial executa verificações de leitura e testes reversíveis das pastas. A **Auditoria completa** acrescenta um probe transacional no SQLCipher e um ensaio de restauração em arquivo temporário.

## Pontuação

A pontuação começa em 100:

- uma falha estrutural reduz 25 pontos;
- uma atenção reduz 7 pontos;
- uma verificação ignorada por proteção reduz 2 pontos.

A classificação também considera a existência de falhas, portanto uma pontuação alta não oculta um problema crítico.

## Teste reversível de escrita

O aplicativo grava um valor aleatório somente na tabela técnica `diagnostic_probe`, lê o mesmo valor e executa rollback. Nenhum documento financeiro participa do teste.

Quando o modo somente leitura está ativo, esse teste é ignorado antes de abrir a transação.

## Ensaio de restauração

O FinnacialUX:

1. exporta o banco criptografado para um snapshot SQLite temporário;
2. abre o snapshot isolado;
3. valida schema, `quick_check` e módulos financeiros;
4. fecha e apaga o arquivo temporário.

O banco real nunca é substituído nesse processo.

## Reparos seguros

Os reparos disponíveis dependem dos resultados da auditoria:

- **Otimizar banco local:** executa checkpoint, `ANALYZE` e `PRAGMA optimize`.
- **Liberar rotinas travadas:** finaliza tarefas em execução há mais de 30 minutos e remove leases expirados.
- **Atualizar estado dos arquivos:** compara o histórico com os arquivos realmente presentes no disco.
- **Limpar logs antigos:** remove arquivos técnicos com mais de 30 dias.

Todos os reparos são bloqueados no modo somente leitura.

## Pacote `.fuxsupport`

O pacote é um envelope JSON técnico com SHA-256. Ele não contém:

- senha ou PIN;
- chave SQLCipher ou Stronghold;
- saldos e valores;
- descrições de lançamentos;
- conteúdo de documentos financeiros;
- caminho completo persistido no histórico.

Nos logs, caminhos são substituídos por `<path>`, e-mails por `<email>` e tokens longos por `<token>`.

## Validação do pacote

Use **Validar pacote** para recalcular o SHA-256. Um pacote alterado ou incompleto será recusado.

## Histórico

Auditorias e reparos armazenam somente metadados técnicos no SQLCipher. A retenção padrão é de 25 auditorias por espaço financeiro.
