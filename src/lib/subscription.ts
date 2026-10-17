export type SubscriptionPlan = {
  id: string;
  name: string;
  priceINR: number;
  credits: number;
};

export const PLANS: SubscriptionPlan[] = [
  { id: "starter", name: "Starter Plan", priceINR: 59, credits: 50 },
  { id: "pro", name: "Pro Plan", priceINR: 199, credits: 250 },
  { id: "enterprise", name: "Enterprise Plan", priceINR: 299, credits: 750 },
  { id: "ultimate", name: "Ultimate Pass", priceINR: 599, credits: 9999 },
];

const CREDITS_STORAGE_KEY = "myaipro_user_credits";
const SUBSCRIPTION_STORAGE_KEY = "myaipro_active_subscription";

export function getUserCredits(): number {
  if (typeof window === "undefined") return 5;
  try {
    const raw = localStorage.getItem(CREDITS_STORAGE_KEY);
    if (raw !== null) {
      return Number(raw);
    }
    // Default free credits for new users
    localStorage.setItem(CREDITS_STORAGE_KEY, "5");
    return 5;
  } catch {
    return 5;
  }
}

export function deductUserCredit(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const current = getUserCredits();
    if (current <= 0) return false;
    localStorage.setItem(CREDITS_STORAGE_KEY, String(current - 1));
    return true;
  } catch {
    return true;
  }
}

export function addUserCredits(count: number) {
  if (typeof window === "undefined") return;
  try {
    const current = getUserCredits();
    localStorage.setItem(CREDITS_STORAGE_KEY, String(current + count));
  } catch {
    /* ignore */
  }
}

export function getActiveSubscription(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveSubscriptionData(plan: SubscriptionPlan, paymentId: string) {
  if (typeof window === "undefined") return;
  try {
    const sub = {
      planId: plan.id,
      planName: plan.name,
      priceINR: plan.priceINR,
      paymentId,
      activatedAt: new Date().toISOString(),
    };
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(sub));
    addUserCredits(plan.credits);
  } catch {
    /* ignore */
  }
}
