import {
  ArrowRightLeftIcon,
  IncomeIcon,
  TransactionsIcon,
} from "@/components/shared/icons";
import { accountsContent } from "@/content/contas";
import { formatShortDate, formatSignedCurrency } from "@/lib/formatters";
import type { AccountMovement, FinancialAccount } from "@/types/contas";

const movementIcons = {
  income: IncomeIcon,
  expense: TransactionsIcon,
  transfer: ArrowRightLeftIcon,
};

function movementValue(
  movement: AccountMovement,
  selectedAccountId: string,
): number {
  if (movement.type === "income") return movement.amount;
  if (movement.type === "expense") return -movement.amount;
  return movement.destinationAccountId === selectedAccountId
    ? movement.amount
    : -movement.amount;
}

function movementDescription(
  movement: AccountMovement,
  selectedAccountId: string,
  accountsById: Map<string, FinancialAccount>,
): string {
  if (movement.type !== "transfer") return movement.category;

  const received = movement.destinationAccountId === selectedAccountId;
  const relatedAccount = accountsById.get(
    received ? movement.accountId : movement.destinationAccountId ?? "",
  );

  return `${
    received
      ? accountsContent.movements.transferFrom
      : accountsContent.movements.transferTo
  } ${relatedAccount?.name ?? "outra conta"}`;
}

export function AccountMovements({
  account,
  accounts,
  movements,
}: {
  account: FinancialAccount | undefined;
  accounts: FinancialAccount[];
  movements: AccountMovement[];
}) {
  const accountsById = new Map(accounts.map((item) => [item.id, item]));
  const selectedAccountId = account?.id ?? "";
  const filteredMovements = movements
    .filter(
      (movement) =>
        movement.accountId === selectedAccountId ||
        movement.destinationAccountId === selectedAccountId,
    )
    .slice(0, 6);

  return (
    <section className="account-activity-card">
      <header className="accounts-panel-heading">
        <div>
          <span>{accountsContent.movements.kicker}</span>
          <h2>{accountsContent.movements.title}</h2>
        </div>
        {account && <small>{account.name}</small>}
      </header>

      {filteredMovements.length ? (
        <div className="account-movements-list">
          {filteredMovements.map((movement) => {
            const Icon = movementIcons[movement.type];
            const value = movementValue(movement, selectedAccountId);

            return (
              <article className="account-movement-item" key={movement.id}>
                <span className={`account-movement-icon ${movement.type}`}>
                  <Icon />
                </span>
                <div className="account-movement-copy">
                  <strong>{movement.description}</strong>
                  <span>
                    {movementDescription(
                      movement,
                      selectedAccountId,
                      accountsById,
                    )}
                  </span>
                </div>
                <div className="account-movement-value">
                  <strong className={value > 0 ? "income" : value < 0 ? "expense" : ""}>
                    {formatSignedCurrency(value)}
                  </strong>
                  <span>{formatShortDate(movement.date)}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="account-movements-empty">
          <strong>{accountsContent.movements.emptyTitle}</strong>
          <p>{accountsContent.movements.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
