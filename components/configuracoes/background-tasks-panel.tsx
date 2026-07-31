"use client";

import { useCallback, useEffect, useState } from "react";
import { BellIcon, CheckIcon, RefreshIcon, WarningIcon } from "@/components/shared/icons";
import { backgroundTaskLabels, schedulerNextTick } from "@/lib/background-task-engine";
import {
  cancelBackgroundTask,
  getBackgroundSchedulerStatus,
  getBackgroundTaskPreferences,
  listBackgroundNotifications,
  listBackgroundTaskRuns,
  listBackgroundTasks,
  retryBackgroundTask,
  runBackgroundTasks,
  saveBackgroundTaskPreferences,
} from "@/lib/desktop/background-tasks";
import type {
  BackgroundNotification,
  BackgroundSchedulerStatus,
  BackgroundTask,
  BackgroundTaskKind,
  BackgroundTaskPreferences,
  BackgroundTaskRun,
} from "@/types/background-tasks";

type RoutineBooleanField =
  | "automationScanEnabled"
  | "dueAlertsEnabled"
  | "financialRiskEnabled"
  | "goalsBudgetEnabled"
  | "monthlyClosingEnabled"
  | "backupReminderEnabled"
  | "weeklySummaryEnabled";

const taskFlags: Array<{ kind: BackgroundTaskKind; field: RoutineBooleanField; helper: string }> = [
  { kind: "automation_scan", field: "automationScanEnabled", helper: "Gera uma prévia e avisa quando há regras ou recorrências para revisar." },
  { kind: "due_alerts", field: "dueAlertsEnabled", helper: "Verifica contas, recebimentos e assinaturas sem expor descrições na notificação." },
  { kind: "financial_risk", field: "financialRiskEnabled", helper: "Consulta a projeção local mais recente e sinaliza risco de saldo negativo." },
  { kind: "goals_budget", field: "goalsBudgetEnabled", helper: "Revisa metas próximas do prazo e categorias no limite configurado." },
  { kind: "monthly_closing", field: "monthlyClosingEnabled", helper: "Lembra contas ainda não fechadas nos primeiros dias do mês." },
  { kind: "backup_reminder", field: "backupReminderEnabled", helper: "Alerta quando não existe uma cópia criptografada recente." },
  { kind: "weekly_summary", field: "weeklySummaryEnabled", helper: "Entrega somente contagens agregadas dos últimos sete dias." },
];

function formatDate(value?: string | null): string {
  if (!value) return "Ainda não executado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function taskStatusLabel(status: BackgroundTask["status"]): string {
  return {
    pending: "Pendente",
    running: "Executando",
    succeeded: "Concluída",
    failed: "Falhou",
    cancelled: "Cancelada",
    skipped: "Ignorada",
  }[status];
}

export function BackgroundTasksPanel({ onFeedback }: { onFeedback: (message: string) => void }) {
  const [preferences, setPreferences] = useState<BackgroundTaskPreferences | null>(null);
  const [status, setStatus] = useState<BackgroundSchedulerStatus | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [runs, setRuns] = useState<BackgroundTaskRun[]>([]);
  const [notifications, setNotifications] = useState<BackgroundNotification[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nextPreferences, nextStatus, nextTasks, nextRuns, nextNotifications] = await Promise.all([
      getBackgroundTaskPreferences(),
      getBackgroundSchedulerStatus(),
      listBackgroundTasks(undefined, 40),
      listBackgroundTaskRuns(30),
      listBackgroundNotifications(30),
    ]);
    setPreferences(nextPreferences);
    setStatus(nextStatus);
    setTasks(nextTasks);
    setRuns(nextRuns);
    setNotifications(nextNotifications);
  }, []);

  useEffect(() => {
    void refresh().catch((error) => onFeedback(error instanceof Error ? error.message : String(error)));
    const update = () => void refresh().catch(() => undefined);
    window.addEventListener("finnacialux-background-updated", update);
    return () => window.removeEventListener("finnacialux-background-updated", update);
  }, [onFeedback, refresh]);

  const nextTick = preferences
    ? status?.nextTickAt
      ? new Date(status.nextTickAt)
      : schedulerNextTick(preferences.lastSchedulerTickAt, preferences.intervalMinutes)
    : null;

  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      await refresh();
      onFeedback(success);
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preferences) return;
    await perform(async () => {
      const saved = await saveBackgroundTaskPreferences({
        enabled: preferences.enabled,
        paused: preferences.paused,
        runOnStartup: preferences.runOnStartup,
        intervalMinutes: preferences.intervalMinutes,
        nativeNotifications: preferences.nativeNotifications,
        quietHoursEnabled: preferences.quietHoursEnabled,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
        automationScanEnabled: preferences.automationScanEnabled,
        dueAlertsEnabled: preferences.dueAlertsEnabled,
        financialRiskEnabled: preferences.financialRiskEnabled,
        goalsBudgetEnabled: preferences.goalsBudgetEnabled,
        monthlyClosingEnabled: preferences.monthlyClosingEnabled,
        backupReminderEnabled: preferences.backupReminderEnabled,
        weeklySummaryEnabled: preferences.weeklySummaryEnabled,
        retryLimit: preferences.retryLimit,
      });
      setPreferences(saved);
      window.dispatchEvent(new CustomEvent("finnacialux-background-preferences-updated"));
    }, "Rotinas locais atualizadas.");
  }

  return (
    <section className="settings-panel background-tasks-panel" aria-labelledby="background-tasks-title">
      <div className="settings-panel-heading">
        <div>
          <p className="settings-eyebrow">Execução local</p>
          <h2 id="background-tasks-title">Rotinas e notificações</h2>
          <p>Fila persistente, tentativas controladas e avisos nativos sem servidor, nuvem ou telemetria externa.</p>
        </div>
        <span className={`background-runtime-badge ${status?.readOnlyBlocked ? "blocked" : status?.paused ? "paused" : status?.running ? "running" : "ready"}`}>
          {status?.readOnlyBlocked ? "Somente leitura" : status?.paused ? "Pausado" : status?.running ? "Executando" : "Ativo"}
        </span>
      </div>

      <div className="background-kpi-grid">
        <article><span>Próxima verificação</span><strong>{nextTick ? nextTick.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong><small>a cada {preferences?.intervalMinutes ?? 30} minutos</small></article>
        <article><span>Fila</span><strong>{status?.pendingTasks ?? 0}</strong><small>tarefas pendentes ou em execução</small></article>
        <article><span>Falhas finais</span><strong>{status?.failedTasks ?? 0}</strong><small>disponíveis para nova tentativa</small></article>
        <article><span>Notificações</span><strong>{status?.pendingNotifications ?? 0}</strong><small>aguardando entrega local</small></article>
      </div>

      {status?.readOnlyBlocked ? (
        <div className="background-warning" role="status"><WarningIcon /><p>As rotinas foram suspensas porque o banco está protegido em modo somente leitura. Nenhuma fila, métrica ou notificação será gravada até a integridade ser liberada.</p></div>
      ) : null}

      {preferences ? (
        <div className="background-settings-grid">
          <article className="settings-card background-control-card">
            <div className="settings-card-heading"><div><h3>Agendador local</h3><p>Continua funcionando enquanto o aplicativo estiver aberto ou minimizado para a bandeja.</p></div></div>
            <label className="settings-toggle-row compact"><span><strong>Ativar rotinas</strong><small>Permite gerar tarefas e avisos locais.</small></span><input type="checkbox" checked={preferences.enabled} onChange={(event) => setPreferences({ ...preferences, enabled: event.target.checked })} /><i /></label>
            <label className="settings-toggle-row compact"><span><strong>Pausar todas</strong><small>Mantém o histórico sem processar novos ciclos.</small></span><input type="checkbox" checked={preferences.paused} onChange={(event) => setPreferences({ ...preferences, paused: event.target.checked })} /><i /></label>
            <label className="settings-toggle-row compact"><span><strong>Executar ao abrir</strong><small>Faz uma varredura assim que o cofre local é desbloqueado.</small></span><input type="checkbox" checked={preferences.runOnStartup} onChange={(event) => setPreferences({ ...preferences, runOnStartup: event.target.checked })} /><i /></label>
            <label>Intervalo<select value={preferences.intervalMinutes} onChange={(event) => setPreferences({ ...preferences, intervalMinutes: Number(event.target.value) })}>{[15, 30, 60, 120, 240].map((value) => <option value={value} key={value}>{value < 60 ? `${value} minutos` : `${value / 60} hora${value > 60 ? "s" : ""}`}</option>)}</select></label>
            <label>Tentativas após falha<select value={preferences.retryLimit} onChange={(event) => setPreferences({ ...preferences, retryLimit: Number(event.target.value) })}>{[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
          </article>

          <article className="settings-card background-notification-card">
            <div className="settings-card-heading"><div><h3>Entrega de avisos</h3><p>O conteúdo é resumido para evitar expor descrições e valores na tela bloqueada.</p></div></div>
            <label className="settings-toggle-row compact"><span><strong>Notificações nativas</strong><small>Usa o canal local já autorizado no Windows.</small></span><input type="checkbox" checked={preferences.nativeNotifications} onChange={(event) => setPreferences({ ...preferences, nativeNotifications: event.target.checked })} /><i /></label>
            <label className="settings-toggle-row compact"><span><strong>Horário silencioso</strong><small>Os avisos permanecem na caixa de saída e são entregues depois.</small></span><input type="checkbox" checked={preferences.quietHoursEnabled} onChange={(event) => setPreferences({ ...preferences, quietHoursEnabled: event.target.checked })} /><i /></label>
            <div className="background-time-grid">
              <label>Início<input type="time" disabled={!preferences.quietHoursEnabled} value={preferences.quietHoursStart} onChange={(event) => setPreferences({ ...preferences, quietHoursStart: event.target.value })} /></label>
              <label>Fim<input type="time" disabled={!preferences.quietHoursEnabled} value={preferences.quietHoursEnd} onChange={(event) => setPreferences({ ...preferences, quietHoursEnd: event.target.value })} /></label>
            </div>
            <div className="background-primary-actions">
              <button className="settings-primary-button" type="button" disabled={busy || status?.readOnlyBlocked} onClick={() => void save()}>Salvar rotinas</button>
              <button type="button" disabled={busy || status?.readOnlyBlocked || preferences.paused} onClick={() => void perform(() => runBackgroundTasks(true), "Varredura local concluída.")}><RefreshIcon /> Executar agora</button>
            </div>
          </article>
        </div>
      ) : <p>Carregando preferências das rotinas…</p>}

      {preferences ? (
        <article className="settings-card background-routines-card">
          <div className="settings-card-heading"><div><h3>Rotinas habilitadas</h3><p>As análises são locais. Sugestões financeiras continuam exigindo revisão e confirmação manual.</p></div></div>
          <div className="background-routine-grid">
            {taskFlags.map((item) => (
              <label className="background-routine-item" key={item.kind}>
                <span><strong>{backgroundTaskLabels[item.kind]}</strong><small>{item.helper}</small></span>
                <input type="checkbox" checked={Boolean(preferences[item.field])} onChange={(event) => setPreferences({ ...preferences, [item.field]: event.target.checked })} />
                <i />
              </label>
            ))}
          </div>
        </article>
      ) : null}

      <div className="background-history-grid">
        <article className="settings-card">
          <div className="settings-card-heading"><div><h3>Fila e histórico</h3><p>As tarefas nunca executam duas vezes com a mesma chave diária, semanal ou mensal.</p></div></div>
          <div className="background-task-list">
            {tasks.length ? tasks.slice(0, 12).map((task) => (
              <div className="background-task-row" key={task.id}>
                <span className={`background-task-status ${task.status}`}>{task.status === "succeeded" ? <CheckIcon /> : task.status === "failed" ? <WarningIcon /> : <RefreshIcon />}</span>
                <div><strong>{backgroundTaskLabels[task.taskKind]}</strong><small>{taskStatusLabel(task.status)} · {formatDate(task.updatedAt)}{task.resultSummary ? ` · ${task.resultSummary}` : ""}</small></div>
                <span>{task.attempts}/{task.maxAttempts + 1}</span>
                {task.status === "failed" || task.status === "cancelled" ? <button type="button" disabled={busy} onClick={() => void perform(() => retryBackgroundTask(task.id), "Tarefa devolvida à fila.")}>Repetir</button> : null}
                {task.status === "pending" ? <button type="button" disabled={busy} onClick={() => void perform(() => cancelBackgroundTask(task.id), "Tarefa cancelada.")}>Cancelar</button> : null}
              </div>
            )) : <p>Nenhuma tarefa registrada ainda.</p>}
          </div>
          <small className="background-history-note">{runs.length} tentativa(s) auditada(s) · última execução bem-sucedida: {formatDate(status?.lastSuccessfulRunAt)}</small>
        </article>

        <article className="settings-card">
          <div className="settings-card-heading"><div><h3>Caixa de notificações</h3><p>Mensagens resumidas, persistentes e entregues somente pelo canal local.</p></div><BellIcon /></div>
          <div className="background-notification-list">
            {notifications.length ? notifications.slice(0, 10).map((notification) => (
              <div key={notification.id} className={`background-notification-row ${notification.severity}`}>
                <span>{notification.status}</span>
                <div><strong>{notification.title}</strong><small>{notification.body}</small></div>
                <time>{formatDate(notification.createdAt)}</time>
              </div>
            )) : <p>Nenhuma notificação gerada ainda.</p>}
          </div>
        </article>
      </div>
    </section>
  );
}
