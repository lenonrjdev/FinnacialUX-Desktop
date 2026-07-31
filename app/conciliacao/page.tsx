import DashboardShell from "@/components/dashboard/dashboard-shell";
import ReconciliationView from "@/components/conciliacao/reconciliation-view";

export default function ConciliacaoPage() {
  return (
    <DashboardShell>
      <ReconciliationView />
    </DashboardShell>
  );
}
