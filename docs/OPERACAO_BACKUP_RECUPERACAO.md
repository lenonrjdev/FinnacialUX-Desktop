# Operação de backup e recuperação

## Regra principal

Nunca teste uma restauração usando o único backup disponível. Mantenha pelo menos duas cópias em locais diferentes antes de uma operação importante.

## Backup manual

1. abra **Configurações → Backups**;
2. selecione **Criar backup**;
3. escolha uma pasta acessível pelo seletor do Windows;
4. aguarde a confirmação de criação e integridade;
5. não renomeie a extensão `.fuxbackup`.

## Backup automático

O FinnacialUX verifica a política uma vez por abertura. Se o período estiver vencido, cria uma cópia na pasta privada de backups. A retenção remove apenas cópias automáticas antigas.

## Restauração

A restauração executa esta sequência:

```text
validar pacote
validar checksum
validar SQLite
confirmar schema
criar backup pré-restauração
fechar conexão do frontend
substituir banco
validar banco restaurado
reverter em caso de falha
encerrar sessão local
```

Após uma restauração bem-sucedida, entre novamente no aplicativo.

## Encerramento inesperado

Se a inicialização anterior não tiver sido finalizada normalmente, o aplicativo oferece:

- abrir normalmente;
- verificar banco;
- selecionar backup;
- abrir em modo seguro.

O modo seguro bloqueia gravações financeiras durante a sessão e é indicado para consulta antes de decidir por uma restauração.

## Diagnóstico

Em **Configurações → Diagnóstico**, verifique:

- integridade geral;
- violações de chaves estrangeiras;
- schema atual;
- tamanho do banco;
- espaço livre;
- histórico de migrations;
- pastas locais.

O arquivo `.fuxdiag` pode ser enviado ao suporte técnico. Ele não contém saldos, lançamentos, senhas ou documentos financeiros.

## Arquivos que não devem ser manipulados durante o uso

Não edite, mova ou substitua manualmente:

```text
finnacialux.db
finnacialux.db-wal
finnacialux.db-shm
session-active.marker
```

Use sempre os recursos de backup e restauração da interface.
