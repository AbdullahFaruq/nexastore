import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Counter",
    price: "Free",
    cadence: "for one store",
    blurb: "For a single shop and a small team.",
    features: [
      "One store, up to 3 team members",
      "Point of sale and order history",
      "Products, inventory and stock alerts",
      "Sales, profit and expense reports",
      "CSV export and printable reports",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Ledger",
    price: "29",
    cadence: "per store, per month",
    blurb: "For growing shops and larger teams.",
    features: [
      "Everything in Counter",
      "Unlimited team members and roles",
      "Multi-store switching in one account",
      "Customer segments and lifetime value",
      "Insights and scheduled reports",
      "Priority support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Group",
    price: "Talk to us",
    cadence: "for multi-site retailers",
    blurb: "For retailers managing several locations.",
    features: [
      "Everything in Ledger",
      "Consolidated group reporting",
      "Per-location permissions",
      "Data export and API access",
      "Onboarding and migration help",
    ],
    cta: "Get in touch",
    highlighted: false,
  },
];

export function PricingTable({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="pricing" className="scroll-mt-16 border-t border-[var(--line)]">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 sm:py-14">
        <div className="text-center max-w-[52ch] mx-auto">
          <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-[var(--accent-ink)]">
            Pricing
          </p>
          <h2 className="mt-3 text-[clamp(24px,3.5vw,34px)] font-semibold text-ink tracking-[-0.03em] leading-[1.12]">
            Priced per store, not per transaction
          </h2>
          <p className="mt-4 text-[14.5px] text-ink-2 leading-relaxed">
            Your takings are yours. NexaStore never takes a cut of a sale.
          </p>
        </div>

        <p className="text-[12px] text-ink-3 text-center mt-5 max-w-[60ch] mx-auto leading-relaxed">
          Illustrative pricing. Billing is not enabled; every account can use all features.
        </p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-[11px] border p-5 sm:p-6 ${
                plan.highlighted
                  ? "border-[var(--accent)] bg-[var(--surface)] shadow-pop"
                  : "border-[var(--line)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 min-h-6">
                <h3 className="text-[15px] font-semibold text-ink">{plan.name}</h3>
                {plan.highlighted ? (
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent-ink)]">
                    Most popular
                  </span>
                ) : null}
              </div>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="num-hero text-[30px] font-semibold text-ink leading-none">
                  {plan.price === "Free" || plan.price === "Talk to us" ? (
                    plan.price
                  ) : (
                    <>
                      <span className="text-[19px] align-top mr-0.5">$</span>
                      {plan.price}
                    </>
                  )}
                </span>
              </p>
              <p className="text-[12px] text-ink-3 mt-1.5">{plan.cadence}</p>
              <p className="text-[13px] text-ink-2 mt-3.5 leading-relaxed lg:min-h-10">{plan.blurb}</p>

              <ul className="mt-5 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="size-4 mt-0.5 grid place-items-center rounded-full bg-[var(--pos-soft)] shrink-0">
                      <Check className="size-2.5 text-[var(--pos)] stroke-[3]" aria-hidden />
                    </span>
                    <span className="text-[12.5px] text-ink-2 leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                <Button
                  asChild
                  variant={plan.highlighted ? "primary" : "secondary"}
                  size="md"
                  className="w-full min-h-11"
                >
                  <Link href={signedIn ? "/dashboard" : "/sign-up"}>
                    {signedIn ? "Open dashboard" : plan.cta}
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
