import { ChevronRightIcon, CheckIcon } from "@/components/shared/icons";
import { accountsContent } from "@/content/contas";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialAccount } from "@/types/contas";
import { AccountIcon } from "@/components/contas/account-icon";

export function AccountCard({
  account,
  selected,
  onSelect,
}: {
  account: FinancialAccount;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`account-card ${selected ? "selected" : ""}`}>
      <div className="account-card-top">
        <span className={`account-card-icon ${account.group}`}>
          <AccountIcon name={account.icon} />
        </span>
        <div className="account-card-badges">
          {account.isPrimary && (
            <span className="account-primary-badge">
              {accountsContent.accounts.primary}
            </span>
          )}
          {selected && (
            <span className="account-selected-badge" aria-label={accountsContent.accounts.selected}>
              <CheckIcon />
            </span>
          )}
        </div>
      </div>

      <div className="account-card-copy">
        <span>{accountsContent.accountTypes[account.type]}</span>
        <h3>{account.name}</h3>
        <p>{account.institution}</p>
      </div>

      <div className="account-card-balance">
        <span>{accountsContent.accounts.balance}</span>
        <strong>{formatCurrency(account.balance)}</strong>
      </div>

      <div className="account-card-footer">
        <div>
          <span>{accountsContent.accounts.projected}</span>
          <strong>{formatCurrency(account.projectedBalance)}</strong>
        </div>
        <button type="button" onClick={onSelect}>
          {accountsContent.accounts.viewMovements}
          <ChevronRightIcon />
        </button>
      </div>
    </article>
  );
}
