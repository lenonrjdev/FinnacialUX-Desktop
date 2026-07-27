import {
  ArrowRightLeftIcon,
  IncomeIcon,
  TransactionsIcon,
} from "@/components/shared/icons";
import type { TransactionType } from "@/types/lancamentos";

const iconByType = {
  income: IncomeIcon,
  expense: TransactionsIcon,
  transfer: ArrowRightLeftIcon,
};

export function TransactionTypeIcon({ type }: { type: TransactionType }) {
  const Icon = iconByType[type];

  return (
    <span className={`transaction-type-icon ${type}`} aria-hidden="true">
      <Icon />
    </span>
  );
}
