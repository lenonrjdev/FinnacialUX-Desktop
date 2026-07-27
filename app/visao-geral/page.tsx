import DashboardShell from "@/components/dashboard/dashboard-shell";
import OverviewView from "@/components/visao-geral/overview-view";

export default function VisaoGeralPage() {
  return (
    <DashboardShell>
      <OverviewView />
    </DashboardShell>
  );
}
