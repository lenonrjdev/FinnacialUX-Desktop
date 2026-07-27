import { AccountsIcon } from "@/components/shared/icons";
import { AccountCard } from "@/components/contas/account-card";
import { accountsContent } from "@/content/contas";
import type { FinancialAccount } from "@/types/contas";

export function AccountsGrid({
  accounts,
  selectedAccountId,
  onSelect,
}: {
  accounts: FinancialAccount[];
  selectedAccountId: string;
  onSelect: (accountId: string) => void;
}) {
  return (
    <section className="accounts-list-section">
      <header className="accounts-section-heading">
        <div>
          <span>{accountsContent.accounts.kicker}</span>
          <h2>{accountsContent.accounts.title}</h2>
        </div>
        <small>
          {accounts.length} {accountsContent.accounts.countSuffix}
        </small>
      </header>

      {accounts.length ? (
        <div className="accounts-grid">
          {accounts.map((account) => (
            <AccountCard
              account={account}
              selected={selectedAccountId === account.id}
              onSelect={() => onSelect(account.id)}
              key={account.id}
            />
          ))}
        </div>
      ) : (
        <div className="accounts-empty-state">
          <span>
            <AccountsIcon />
          </span>
          <strong>{accountsContent.accounts.emptyTitle}</strong>
          <p>{accountsContent.accounts.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
