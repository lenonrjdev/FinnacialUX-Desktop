import { BankIcon, SavingsIcon, WalletIcon } from "@/components/shared/icons";
import { reportsContent } from "@/content/relatorios";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { AccountReportRow } from "@/types/relatorios";

function accountIcon(name: string) {
  if (name.toLocaleLowerCase("pt-BR").includes("reserva")) return <SavingsIcon />;
  if (name.toLocaleLowerCase("pt-BR").includes("carteira")) return <WalletIcon />;
  return <BankIcon />;
}

export function AccountDistributionReport({ rows, total }: { rows: AccountReportRow[]; total: number }) {
  return (
    <article className="report-panel account-distribution-report">
      <header className="report-panel-header">
        <div>
          <h2>{reportsContent.accounts.title}</h2>
          <p>{reportsContent.accounts.description}</p>
        </div>
        <div className="report-total-caption">
          <span>{reportsContent.accounts.total}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </header>

      <div className="account-distribution-list">
        {rows.map((row) => (
          <div className="account-distribution-row" key={row.id}>
            <span className="account-distribution-icon">{accountIcon(row.name)}</span>
            <div>
              <strong>{row.name}</strong>
              <small>{row.institution}</small>
            </div>
            <div className="account-distribution-share">
              <strong>{formatCurrency(row.balance)}</strong>
              <span>{formatPercentage(row.percentage)}</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
