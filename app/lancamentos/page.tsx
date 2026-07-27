import DashboardShell from "@/components/dashboard/dashboard-shell";
import LancamentosView from "@/components/lancamentos/lancamentos-view";

export default function LancamentosPage() {
  return (
    <DashboardShell>
      <LancamentosView />
    </DashboardShell>
  );
}
