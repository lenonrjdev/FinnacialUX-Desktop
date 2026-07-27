import {
  BookIcon,
  CreditCardIcon,
  HomeIcon,
  LockIcon,
  ReportsIcon,
  SubscriptionIcon,
  TargetIcon,
  UserIcon,
} from "@/components/shared/icons";
import type { SubscriptionCategory } from "@/types/assinaturas";

export function SubscriptionCategoryIcon({ category }: { category: SubscriptionCategory }) {
  switch (category) {
    case "streaming":
      return <SubscriptionIcon />;
    case "software":
      return <ReportsIcon />;
    case "health":
      return <TargetIcon />;
    case "education":
      return <BookIcon />;
    case "utilities":
      return <HomeIcon />;
    case "insurance":
      return <LockIcon />;
    case "membership":
      return <UserIcon />;
    default:
      return <CreditCardIcon />;
  }
}
