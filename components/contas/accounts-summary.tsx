import {
  AccountsIcon,
  CalendarIcon,
  SavingsIcon,
  WalletIcon,
} from "@/components/shared/icons";
import { accountsContent } from "@/content/contas";
import { formatCurrency } from "@/lib/formatters";

export type AccountsSummaryValues = {
  totalBalance: number;
  projectedBalance: number;
  availableBalance: number;
  reservedBalance: number;
  activeAccounts: number;
};

export function AccountsSummary({ values }: { values: AccountsSummaryValues }) {
  const projectionPercentage = values.totalBalance
    ? Math.max(0, Math.min(100, (values.projectedBalance / values.totalBalance) * 100))
    : 0;

  return (
    <section className="accounts-summary-grid" aria-label="Resumo das contas">
      <article className="accounts-total-card">
        <div className="accounts-total-card-top">
          <span className="accounts-total-icon">
            <WalletIcon />
          </span>
          <span>{accountsContent.summary.totalBalanceHelper}</span>
        </div>
        <span className="accounts-total-label">
          {accountsContent.summary.totalBalance}
        </span>
        <strong>{formatCurrency(values.totalBalance)}</strong>
        <div className="accounts-projection-row">
          <div>
            <span>{accountsContent.summary.projectionLabel}</span>
            <strong>{formatCurrency(values.projectedBalance)}</strong>
          </div>
          <div className="accounts-projection-track" aria-hidden="true">
            <span style={{ width: `${projectionPercentage}%` }} />
          </div>
        </div>
      </article>

      <article className="account-summary-card">
        <span className="account-summary-icon">
          <AccountsIcon />
        </span>
        <span>{accountsContent.summary.availableBalance}</span>
        <strong>{formatCurrency(values.availableBalance)}</strong>
        <small>{accountsContent.summary.availableBalanceHelper}</small>
      </article>

      <article className="account-summary-card">
        <span className="account-summary-icon">
          <SavingsIcon />
        </span>
        <span>{accountsContent.summary.reservedBalance}</span>
        <strong>{formatCurrency(values.reservedBalance)}</strong>
        <small>{accountsContent.summary.reservedBalanceHelper}</small>
      </article>

      <article className="account-summary-card">
        <span className="account-summary-icon">
          <CalendarIcon />
        </span>
        <span>{accountsContent.summary.activeAccounts}</span>
        <strong>{values.activeAccounts}</strong>
        <small>{accountsContent.summary.activeAccountsHelper}</small>
      </article>
    </section>
  );
}
