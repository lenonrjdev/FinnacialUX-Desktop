import { DebtCard } from "@/components/dividas/debt-card";
import { DebtIcon } from "@/components/shared/icons";
import { debtsContent } from "@/content/dividas";
import type { DebtRow } from "@/types/dividas";

export function DebtsList({
  debts,
  accountNames,
  selectedId,
  onSelect,
  onPay,
  onEdit,
  onSettle,
}: {
  debts: DebtRow[];
  accountNames: Record<string, string>;
  selectedId: string;
  onSelect: (debt: DebtRow) => void;
  onPay: (debt: DebtRow) => void;
  onEdit: (debt: DebtRow) => void;
  onSettle: (debt: DebtRow) => void;
}) {
  return (
    <section className="debts-list-card">
      <header className="debts-list-header">
        <div>
          <span className="section-eyebrow">{debtsContent.list.eyebrow}</span>
          <h2>{debtsContent.list.title}</h2>
        </div>
        <span>{debts.length} {debts.length === 1 ? debtsContent.list.resultSingular : debtsContent.list.resultPlural}</span>
      </header>

      {debts.length ? (
        <div className="debts-card-grid">
          {debts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              accountName={accountNames[debt.accountId] ?? debtsContent.list.unknownAccount}
              selected={selectedId === debt.id}
              onSelect={() => onSelect(debt)}
              onPay={() => onPay(debt)}
              onEdit={() => onEdit(debt)}
              onSettle={() => onSettle(debt)}
            />
          ))}
        </div>
      ) : (
        <div className="debts-empty-state">
          <span><DebtIcon /></span>
          <strong>{debtsContent.list.emptyTitle}</strong>
          <p>{debtsContent.list.emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
