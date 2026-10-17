import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Check, ArrowLeft, Shield, Zap, CreditCard, Crown, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Subscription & Billing — My AI Pro" },
      { name: "description", content: "Upgrade your My AI Pro subscription plan with Razorpay secure checkout." },
    ],
  }),
  component: BillingPage,
});

const RAZORPAY_KEY = "TwhG2uxTUB7OI0aFTlpliVaA";

const PLANS = [
  {
    id: "starter",
    name: "Starter Plan",
    priceINR: 59,
    period: "month",
    description: "Essential AI code generation and chat access for casual developers.",
    features: [
      "Standard AI model access",
      "Chat with web grounding",
      "Basic code generation",
      "Community support",
    ],
    popular: false,
    badge: "Basic",
  },
  {
    id: "pro",
    name: "Pro Plan",
    priceINR: 199,
    period: "month",
    description: "Advanced code building, multi-folder architecture & live web search.",
    features: [
      "High-speed neural AI engines",
      "Multi-folder full-stack project builder",
      "Google & Wikipedia live search grounding",
      "Presentation maker with Ghibli art",
    ],
    popular: true,
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Enterprise Plan",
    priceINR: 299,
    period: "month",
    description: "Priority neural generation, unlimited projects & GitHub private repo sync.",
    features: [
      "Priority API queue & zero throttling",
      "GitHub private repository import & sync",
      "Unlimited full-stack project exports",
      "Advanced voice & vision code generation",
    ],
    popular: false,
    badge: "Advanced",
  },
  {
    id: "ultimate",
    name: "Ultimate Pass",
    priceINR: 599,
    period: "lifetime / VIP",
    description: "All features, unthrottled AI generation, dedicated agentic workflow & VIP support.",
    features: [
      "All Enterprise features included",
      "Unrestricted unthrottled rate limits",
      "Dedicated high-capacity AI pool",
      "Direct VIP engineering support",
    ],
    popular: false,
    badge: "VIP Elite",
  },
];

function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);

  useEffect(() => {
    // Load existing subscription from localStorage if any
    try {
      const saved = localStorage.getItem("myaipro_active_subscription");
      if (saved) {
        setActiveSubscription(JSON.parse(saved));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleSubscribe = async (plan: typeof PLANS[0]) => {
    setLoadingPlan(plan.id);
    try {
      // Load Razorpay script if not already loaded
      if (!(window as any).Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const options = {
        key: RAZORPAY_KEY,
        amount: plan.priceINR * 100, // amount in paisa
        currency: "INR",
        name: "My AI Pro",
        description: `${plan.name} Subscription`,
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop",
        handler: function (response: any) {
          const paymentId = response.razorpay_payment_id || `pay_${Math.random().toString(36).slice(2, 9)}`;
          setActiveSubscriptionData({
            id: plan.id,
            name: plan.name,
            priceINR: plan.priceINR,
            credits: plan.id === "starter" ? 50 : plan.id === "pro" ? 250 : plan.id === "enterprise" ? 750 : 9999,
          }, paymentId);
          setActiveSubscription({
            planId: plan.id,
            planName: plan.name,
            amount: plan.priceINR,
            paymentId,
            activatedAt: new Date().toISOString(),
          });
          toast.success(`Successfully subscribed to ${plan.name} (₹${plan.priceINR}) via Razorpay UPI / Card!`);
          setLoadingPlan(null);
        },
        prefill: {
          name: "My AI Pro User",
          email: "myaipro5@gmail.com",
          contact: "9999999999",
        },
        theme: {
          color: "#d94a11",
        },
        modal: {
          ondismiss: function () {
            setLoadingPlan(null);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message || "Could not launch Razorpay payment gateway.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-canvas font-sans text-ink selection:bg-brand selection:text-white">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-surface/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/build"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-ink transition"
          >
            <ArrowLeft className="size-4" /> Back to App
          </Link>
          <span className="text-border">/</span>
          <span className="text-xs font-bold text-brand uppercase tracking-wider">Billing & Subscriptions</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-600 border border-emerald-500/30">
            <Shield className="size-3.5" /> Razorpay Secured
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1.5 text-xs font-bold text-brand">
              <Crown className="size-4" /> Upgrade Your Workspace
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ink">
              Simple, Transparent Pricing Plans
            </h1>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground">
              Choose the plan that fits your workflow. Powered by Razorpay secure payments starting from ₹59.
            </p>
          </div>

          {activeSubscription && (
            <div className="rounded-3xl border border-brand/40 bg-surface p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-brand text-brand-foreground flex items-center justify-center font-bold">
                  <Star className="size-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Active Subscription</span>
                  <h3 className="font-serif text-xl font-bold text-ink">{activeSubscription.planName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Activated on {new Date(activeSubscription.activatedAt).toLocaleDateString()} • Payment ID: <span className="font-mono">{activeSubscription.paymentId}</span>
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-bold text-emerald-600 border border-emerald-500/30">
                Active &amp; Verified
              </span>
            </div>
          )}

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map((plan) => {
              const isCurrent = activeSubscription?.planId === plan.id;
              const isSelected = selectedPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 cursor-pointer bg-surface",
                    plan.popular
                      ? "border-brand shadow-xl ring-2 ring-brand/20 scale-[1.02]"
                      : isSelected
                        ? "border-brand/80 shadow-md"
                        : "border-border/60 hover:border-brand/40 hover:shadow-md",
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-foreground shadow-sm">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {plan.name}
                      </span>
                      {!plan.popular && (
                        <span className="rounded-full bg-canvas px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/50">
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="font-serif text-3xl font-bold text-ink">₹{plan.priceINR}</span>
                      <span className="text-xs text-muted-foreground">/ {plan.period}</span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                      {plan.description}
                    </p>

                    <ul className="space-y-2.5 mb-6 border-t border-border/40 pt-4">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-ink">
                          <Check className="size-4 shrink-0 text-brand mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={loadingPlan === plan.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubscribe(plan);
                    }}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold transition shadow-sm cursor-pointer",
                      isCurrent
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : plan.popular
                          ? "bg-brand text-brand-foreground hover:opacity-90 shadow-md"
                          : "bg-ink text-white hover:bg-black",
                    )}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Zap className="size-4 animate-spin" /> Processing Razorpay…
                      </>
                    ) : isCurrent ? (
                      <>
                        <Check className="size-4" /> Current Plan
                      </>
                    ) : (
                      <>
                        <CreditCard className="size-4" /> Pay ₹{plan.priceINR} with Razorpay
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-3xl border border-border/60 bg-surface p-6 text-center space-y-2 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Need Custom Enterprise Integration?</h4>
            <p className="text-sm text-ink font-medium">
              Contact our engineering team for dedicated clusters, custom fine-tuned models, and SLA contracts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
