export type SubscriptionCategory =
  | "streaming"
  | "software"
  | "health"
  | "education"
  | "utilities"
  | "insurance"
  | "membership"
  | "other";

export type SubscriptionStatus = "active" | "trial" | "paused" | "cancelled";
export type BillingCycle = "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";
export type UsageFrequency = "high" | "medium" | "low" | "unknown";
export type SubscriptionView = "subscriptions" | "charges";
export type SubscriptionCategoryFilter = "all" | SubscriptionCategory;
export type SubscriptionStatusFilter = "all" | SubscriptionStatus;
export type SubscriptionAccountFilter = "all" | string;
export type ChargeStatus = "paid" | "scheduled" | "overdue" | "skipped";

export interface PersonalSubscription {
  id: string;
  name: string;
  provider: string;
  category: SubscriptionCategory;
  amount: number;
  billingCycle: BillingCycle;
  nextChargeDate: string;
  accountId: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  startDate: string;
  trialEndsAt?: string;
  previousAmount?: number;
  priceChangedAt?: string;
  usage: UsageFrequency;
  notes: string;
  createdAt: string;
}

export interface SubscriptionCharge {
  id: string;
  subscriptionId: string;
  date: string;
  amount: number;
  accountId: string;
  status: ChargeStatus;
  paidAmount?: number;
  note: string;
}

export type SubscriptionFormInput = Omit<PersonalSubscription, "id" | "createdAt">;

export interface SubscriptionChargeInput {
  subscriptionId: string;
  date: string;
  amount: number;
  accountId: string;
  status: Exclude<ChargeStatus, "overdue">;
  note: string;
}

export interface SubscriptionRow extends PersonalSubscription {
  monthlyEquivalent: number;
  annualEquivalent: number;
  daysUntilCharge: number;
  priceDifference: number;
  priceChangePercentage: number;
  computedChargeStatus: "upcoming" | "overdue" | "future" | "inactive";
}
