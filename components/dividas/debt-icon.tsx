import {
  BankIcon,
  CreditCardIcon,
  DebtIcon,
  HomeIcon,
  UserIcon,
  WalletIcon,
} from "@/components/shared/icons";
import type { DebtType } from "@/types/dividas";

export function DebtTypeIcon({ type }: { type: DebtType }) {
  if (type === "personal-loan") return <BankIcon />;
  if (type === "financing") return <HomeIcon />;
  if (type === "credit-card-installment") return <CreditCardIcon />;
  if (type === "family-debt") return <UserIcon />;
  if (type === "overdraft") return <WalletIcon />;
  return <DebtIcon />;
}
