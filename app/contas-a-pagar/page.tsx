import DashboardShell from "@/components/dashboard/dashboard-shell";
import ContasAPagarView from "@/components/contas-a-pagar/contas-a-pagar-view";

export default function ContasAPagarPage() {
  return (
    <DashboardShell>
      <ContasAPagarView />
    </DashboardShell>
  );
}
