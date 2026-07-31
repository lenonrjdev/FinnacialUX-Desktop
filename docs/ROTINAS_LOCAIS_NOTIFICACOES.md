# Operação das rotinas locais e notificações

## Funcionamento

As rotinas são executadas somente enquanto o FinnacialUX Desktop estiver aberto, inclusive minimizado para a bandeja. Não existe serviço remoto, conta em nuvem ou telemetria.

Ao desbloquear o cofre, o aplicativo pode executar uma primeira varredura. Depois, novos ciclos seguem o intervalo configurado em **Configurações → Rotinas locais**.

## Segurança

As rotinas podem ler informações já criptografadas no SQLCipher para produzir contagens e alertas locais. Elas não podem:

- aplicar regras financeiras;
- criar pagamentos;
- alterar lançamentos;
- reabrir fechamentos;
- exportar dados;
- ignorar o modo somente leitura.

A revisão de automações chama apenas a simulação protegida da Fase 10.

## Estados da fila

- `pending`: aguardando o horário ou uma nova tentativa;
- `running`: execução reivindicada pelo agendador;
- `succeeded`: concluída;
- `failed`: esgotou as tentativas configuradas;
- `cancelled`: cancelada manualmente antes da execução;
- `skipped`: ciclo dispensado por proteção ou condição operacional.

## Deduplicação

As chaves evitam repetir trabalho automático:

- diária para vencimentos, riscos, metas, orçamento, backup e automações;
- semanal para o resumo;
- mensal para o fechamento.

O botão **Executar agora** cria chaves manuais exclusivas e inclui todas as rotinas habilitadas, inclusive as rotinas semanal e mensal.

## Horário silencioso

Quando o horário atual está dentro da janela silenciosa, a notificação não é emitida. Ela permanece no SQLCipher até uma próxima tentativa de entrega.

Uma janela com início e fim iguais representa silêncio durante todo o dia.

## Notificações nativas

A entrega exige que:

1. as notificações das rotinas estejam habilitadas;
2. as notificações Desktop estejam habilitadas;
3. o Windows conceda permissão ao aplicativo;
4. o horário atual não esteja na janela silenciosa.

O texto enviado ao Windows é resumido. Descrições de transações e valores não são incluídos na tela bloqueada.

## Diagnóstico

Na central, confira:

- quantidade de tarefas pendentes;
- falhas finais;
- avisos aguardando entrega;
- última execução bem-sucedida;
- resumo sanitizado de cada tarefa;
- histórico das tentativas.

Uma falha pode ser repetida manualmente. Uma tarefa pendente pode ser cancelada.

## Modo somente leitura

Quando a integridade coloca o banco em modo somente leitura:

- o agendador não cria tarefas;
- nenhuma preferência é alterada;
- nenhuma tentativa ou notificação é gravada;
- a interface exibe o estado bloqueado.

Após a integridade ser revalidada, o usuário pode executar uma nova varredura manual.
