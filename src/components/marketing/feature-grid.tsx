import * as React from "react";
import {
  BarChart3, Boxes, Lightbulb, Receipt, ScanLine, Users, Wallet,
} from "lucide-react";

const SECTIONS = [
  {
    id: "analytics",
    eyebrow: "Analytics",
    title: "Profit, explained step by step",
    body: "See what you earn, where it goes, and how it changes over time.",
    features: [
      { icon: BarChart3, title: "Profit and loss", text: "Sales, costs, and net profit in one clear statement." },
      { icon: Lightbulb, title: "Insights that check out", text: "Spot changes with the figures behind every insight." },
    ],
  },
  {
    id: "operations",
    eyebrow: "Operations",
    title: "From the till to the stockroom",
    body: "Sell, restock, and manage your shop in the same workspace.",
    features: [
      { icon: ScanLine, title: "Point of sale", text: "Scan products, apply discounts, and record payment." },
      { icon: Boxes, title: "Stock intelligence", text: "See what is running low and how much to reorder." },
      { icon: Receipt, title: "Full audit trail", text: "Know who changed stock, when, and why." },
      { icon: Wallet, title: "Expenses", text: "Track shop costs alongside your profit." },
      { icon: Users, title: "Customers", text: "Understand spending and repeat customers." },
      { icon: Users, title: "Team roles", text: "Give each team member the access they need." },
    ],
  },
];

export function FeatureGrid() {
  return (
    <>
      {SECTIONS.map((section, si) => (
        <section
          key={section.id}
          id={section.id}
          className={`scroll-mt-16 ${si > 0 ? "border-t border-[var(--line)] bg-[var(--inset)]" : ""}`}
        >
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 sm:py-14">
            <div className="max-w-[58ch]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-[var(--accent-ink)]">
                {section.eyebrow}
              </p>
              <h2 className="mt-3 text-[clamp(24px,3.5vw,34px)] font-semibold text-ink tracking-[-0.03em] leading-[1.12]">
                {section.title}
              </h2>
              <p className="mt-4 text-[14.5px] text-ink-2 leading-relaxed">{section.body}</p>
            </div>

            <div
              className={`mt-9 grid gap-px bg-[var(--line)] rounded-[11px] overflow-hidden border border-[var(--line)] ${
                section.features.length > 2
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              {section.features.map((f) => (
                <article key={f.title} className="bg-[var(--surface)] p-4 sm:p-5 flex gap-3 sm:block">
                  <span className="grid place-items-center size-9 shrink-0 rounded-[8px] bg-[var(--accent-soft)]">
                    <f.icon className="size-4 text-[var(--accent-ink)]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="sm:mt-3.5 text-[14px] font-semibold text-ink tracking-[-0.01em]">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] text-ink-3 leading-relaxed">{f.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
