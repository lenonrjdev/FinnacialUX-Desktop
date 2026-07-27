import { accountsContent } from "@/content/contas";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { FinancialAccount } from "@/types/contas";

export function AccountsDistribution({ accounts }: { accounts: FinancialAccount[] }) {
  const includedAccounts = accounts.filter((account) => account.includeInTotal);
  const total = includedAccounts.reduce((sum, account) => sum + account.balance, 0);
  const sortedAccounts = [...includedAccounts].sort((a, b) => b.balance - a.balance);

  return (
    <section className="accounts-distribution-card">
      <header className="accounts-panel-heading">
        <div>
          <span>{accountsContent.distribution.kicker}</span>
          <h2>{accountsContent.distribution.title}</h2>
        </div>
      </header>

      <p className="accounts-distribution-description">
        {accountsContent.distribution.description}
      </p>

      <div className="accounts-distribution-list">
        {sortedAccounts.map((account) => {
          const percentage = total ? (account.balance / total) * 100 : 0;

          return (
            <div className="accounts-distribution-item" key={account.id}>
              <div>
                <span>{account.name}</span>
                <strong>{formatCurrency(account.balance)}</strong>
              </div>
              <div className="accounts-distribution-track" aria-hidden="true">
                <span style={{ width: `${percentage}%` }} />
              </div>
              <small>{formatPercentage(percentage)}</small>
            </div>
          );
        })}
      </div>

      <footer className="accounts-distribution-total">
        <span>{accountsContent.distribution.total}</span>
        <strong>{formatCurrency(total)}</strong>
      </footer>
    </section>
  );
}
