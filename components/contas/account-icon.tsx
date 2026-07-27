import type { ComponentType } from "react";
import {
  AccountsIcon,
  BankIcon,
  InvestmentIcon,
  SavingsIcon,
  WalletIcon,
  type IconProps,
} from "@/components/shared/icons";
import type { AccountIconName } from "@/types/contas";

const icons: Record<AccountIconName, ComponentType<IconProps>> = {
  bank: BankIcon,
  wallet: WalletIcon,
  savings: SavingsIcon,
  investment: InvestmentIcon,
};

export function AccountIcon({ name }: { name: AccountIconName }) {
  const Icon = icons[name] ?? AccountsIcon;
  return <Icon />;
}
