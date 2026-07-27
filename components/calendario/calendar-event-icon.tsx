import {
  ArrowRightLeftIcon,
  BillsIcon,
  CreditCardIcon,
  IncomeIcon,
  SubscriptionIcon,
  TargetIcon,
} from "@/components/shared/icons";
import type { CalendarEventType } from "@/types/calendario";

export function CalendarEventIcon({ type }: { type: CalendarEventType }) {
  if (type === "income") return <IncomeIcon />;
  if (type === "invoice") return <CreditCardIcon />;
  if (type === "transfer") return <ArrowRightLeftIcon />;
  if (type === "goal") return <TargetIcon />;
  if (type === "subscription") return <SubscriptionIcon />;
  return <BillsIcon />;
}
