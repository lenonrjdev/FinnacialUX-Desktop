export type NavigationIconName =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "credit-card"
  | "bills"
  | "income"
  | "calendar"
  | "budget"
  | "target"
  | "debt"
  | "subscription"
  | "reports"
  | "data-tools"
  | "access"
  | "settings";

export type NavigationItem = {
  label: string;
  href: string;
  icon: NavigationIconName;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};
