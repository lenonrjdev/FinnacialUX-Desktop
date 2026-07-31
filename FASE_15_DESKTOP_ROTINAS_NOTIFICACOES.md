# Fase 15 — Rotinas locais e notificações nativas

## Objetivo

Transformar o FinnacialUX Desktop em um aplicativo proativo, mantendo todo o processamento no computador do usuário e sem permitir alterações financeiras silenciosas.

A versão `0.15.0` introduz o schema SQLCipher `12`, uma fila persistente de tarefas, leases para impedir concorrência, tentativas com backoff, histórico auditável e uma caixa local de notificações.

## Princípios da fase

- Nenhum dado financeiro é enviado para servidores externos.
- Nenhuma automação é aplicada em segundo plano.
- A rotina de automações gera apenas uma prévia para revisão manual.
- O modo somente leitura suspende fila, métricas, notificações e preferências.
- Uma tarefa diária, semanal ou mensal não pode ser duplicada para o mesmo período.
- Uma execução manual pode repetir a análise com uma chave exclusiva, sem alterar dados automaticamente.
- Notificações exibem somente textos resumidos, sem descrições ou valores sensíveis.

## Schema 12

A migration `0012_local_background_tasks_and_notifications.sql` cria:

- `background_task_preferences`: preferências por espaço financeiro;
- `background_task_queue`: fila persistente e deduplicada;
- `background_task_runs`: histórico de cada tentativa;
- `background_notification_outbox`: caixa de saída local;
- `background_scheduler_leases`: lease por espaço para impedir ciclos simultâneos.

## Rotinas disponíveis

1. **Revisar automações** — reutiliza a simulação protegida da Fase 10 e avisa quando existem candidatos.
2. **Verificar vencimentos** — resume contas, recebimentos e assinaturas na janela configurada.
3. **Verificar riscos financeiros** — consulta a projeção local persistida mais recente.
4. **Revisar metas e orçamentos** — identifica prazos próximos e categorias no limite.
5. **Lembrar fechamento mensal** — procura contas do mês anterior ainda abertas.
6. **Lembrar backup** — alerta quando não existe backup disponível nos últimos sete dias.
7. **Preparar resumo semanal** — usa somente contagens agregadas dos últimos sete dias.

## Agendamento e concorrência

O provedor React inicia o agendador depois que o usuário e o cofre local estão prontos. O intervalo pode ser de 15, 30, 60, 120 ou 240 minutos e é reaplicado imediatamente após salvar as preferências.

No núcleo Rust, duas camadas impedem concorrência:

- claim em memória por espaço financeiro;
- lease persistente no SQLCipher com expiração de cinco minutos.

## Tentativas e falhas

Cada tarefa registra seu número de tentativas, erro sanitizado, duração e resultado resumido. O atraso aumenta de forma exponencial:

```text
5, 10, 20, 40, 80 e 160 minutos
```

O limite configurável representa tentativas adicionais após a primeira execução.

## Horário silencioso

Durante o horário silencioso, as notificações permanecem na caixa de saída. A entrega é retomada em uma próxima varredura, sem descartar o aviso.

## Interface

A central fica em:

```text
Configurações → Rotinas locais
```

Ela permite:

- ativar, pausar e executar as rotinas;
- configurar intervalo e tentativas;
- ativar o horário silencioso;
- escolher as análises habilitadas;
- acompanhar fila, falhas e histórico;
- repetir ou cancelar tarefas permitidas;
- consultar a caixa local de notificações.

Também existe a ação **Executar rotinas locais** no menu da bandeja do Windows.

## Aplicação e validação

```powershell
.\16_APLICAR_FASE_15.cmd
.\16_VALIDAR_FASE_15.cmd
```

A validação executa toda a suíte acumulada e confirma schema, fila, leases, deduplicação, backoff, horário silencioso, integração nativa e ausência de aplicação automática de dados financeiros.
