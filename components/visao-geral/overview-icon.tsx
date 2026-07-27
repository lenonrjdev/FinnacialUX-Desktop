import type { ComponentType } from "react";
import {
  BillsIcon,
  CreditCardIcon,
  IncomeIcon,
  ShoppingBagIcon,
  TransactionsIcon,
  WalletIcon,
  type IconProps,
} from "@/components/shared/icons";
import type { OverviewIconName } from "@/types/overview";

const icons: Record<OverviewIconName, ComponentType<IconProps>> = {
  wallet: WalletIcon,
  income: IncomeIcon,
  transactions: TransactionsIcon,
  bills: BillsIcon,
  shopping: ShoppingBagIcon,
  "credit-card": CreditCardIcon,
};

export function OverviewIcon({ name }: { name: OverviewIconName }) {
  const Icon = icons[name];
  return <Icon />;
}
