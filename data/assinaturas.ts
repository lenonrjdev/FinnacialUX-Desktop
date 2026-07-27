import { getReferenceDate } from "@/lib/reference-date";
import type { PersonalSubscription, SubscriptionCharge } from "@/types/assinaturas";

export const subscriptionsReferenceDate = getReferenceDate();
export const initialSubscriptions: PersonalSubscription[] = [];
export const initialSubscriptionCharges: SubscriptionCharge[] = [];
