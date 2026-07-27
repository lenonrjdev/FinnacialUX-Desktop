import type { ComponentType } from "react";
import type { NavigationIconName } from "@/types/navigation";
import type { IconProps } from "@/components/shared/icons";
import {
  AccountsIcon,
  BillsIcon,
  BudgetIcon,
  CalendarIcon,
  CreditCardIcon,
  DashboardIcon,
  DatabaseIcon,
  DebtIcon,
  IncomeIcon,
  ReportsIcon,
  SettingsIcon,
  SubscriptionIcon,
  TargetIcon,
  TransactionsIcon,
  UsersIcon,
} from "@/components/shared/icons";

const icons: Record<NavigationIconName, ComponentType<IconProps>> = {
  dashboard: DashboardIcon,
  transactions: TransactionsIcon,
  accounts: AccountsIcon,
  "credit-card": CreditCardIcon,
  bills: BillsIcon,
  income: IncomeIcon,
  calendar: CalendarIcon,
  budget: BudgetIcon,
  target: TargetIcon,
  debt: DebtIcon,
  subscription: SubscriptionIcon,
  reports: ReportsIcon,
  "data-tools": DatabaseIcon,
  access: UsersIcon,
  settings: SettingsIcon,
};

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  const Icon = icons[name];
  return <Icon />;
}
