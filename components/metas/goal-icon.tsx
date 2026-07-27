import {
  BookIcon,
  DebtIcon,
  HomeIcon,
  PlaneIcon,
  SavingsIcon,
  ShoppingBagIcon,
  TargetIcon,
} from "@/components/shared/icons";
import type { GoalCategory, GoalTone } from "@/types/metas";

const iconByCategory = {
  emergency: SavingsIcon,
  travel: PlaneIcon,
  purchase: ShoppingBagIcon,
  home: HomeIcon,
  education: BookIcon,
  debt: DebtIcon,
  other: TargetIcon,
} satisfies Record<GoalCategory, typeof TargetIcon>;

export function GoalIcon({ category, tone }: { category: GoalCategory; tone: GoalTone }) {
  const Icon = iconByCategory[category];
  return (
    <span className={`goal-icon tone-${tone}`} aria-hidden="true">
      <Icon />
    </span>
  );
}
