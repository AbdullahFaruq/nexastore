import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { getStoreContext } from "@/lib/auth/context";
import { authMode } from "@/lib/auth/provider";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/layout/logo";
import { ThemeSwitcher } from "@/components/providers/theme-provider";
import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { PricingTable } from "@/components/marketing/pricing-table";
import { MobileLandingNavigation } from "@/components/marketing/mobile-navigation";

const SECTION_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Analytics", href: "#analytics" },
  { label: "Operations", href: "#operations" },
  { label: "Pricing", href: "#pricing" },
];

export const metadata: Metadata = {
  title: "NexaStore - Sales, stock, and profit. One clear view.",
  description:
    "Record sales, track stock, and see what your shop earns. NexaStore brings independent retail operations into one clear view.",
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Signed-in visitors get "Open dashboard" rather than "Start free".
  const ctx = await getStoreContext().catch(() => null);
  const signedIn = Boolean(ctx);
  const configured = authMode() !== "unconfigured";

  return (
    <div className="min-h-dvh bg-[var(--page)]">
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="NexaStore home">
            <Wordmark size={26} />
          </Link>

          <nav aria-label="Sections" className="hidden md:flex items-center gap-7">
            {SECTION_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="text-[13.5px] text-ink-2 hover:text-ink transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeSwitcher compact />
            <MobileLandingNavigation links={SECTION_LINKS} signedIn={signedIn} />
            {signedIn ? (
              <Button asChild variant="primary" size="sm" className="hidden md:inline-flex">
                <Link href="/dashboard">
                  Open dashboard
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild variant="primary" size="sm" className="hidden md:inline-flex">
                  <Link href="/sign-up">
                    Start free
                    <ArrowRight />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        {/* --------------------------------------------------------- hero */}
        <section className="relative overflow-hidden">
          {/* Engineering-drawing grid, faded at the edges. */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.55]"
            style={{
              backgroundImage:
                "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse 70% 55% at 50% 20%, black, transparent)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 20%, black, transparent)",
            }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8 pt-10 sm:pt-14 pb-6 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-medium text-[var(--accent-ink)]">
              <span className="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
              Built for independent retail
            </p>

            <h1 className="mt-6 text-[clamp(34px,6.5vw,60px)] font-semibold text-ink tracking-[-0.035em] leading-[1.04]">
              Sales, stock, and profit.
              <br />
              <span className="text-[var(--accent-ink)]">One clear view.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-[54ch] text-[15px] sm:text-[16.5px] text-ink-2 leading-relaxed">
              Record sales, track stock, and see what your shop earns — all in one place.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Button asChild variant="primary" size="lg" className="w-full sm:w-auto sm:px-7">
                <Link href={signedIn ? "/dashboard" : "/sign-up"}>
                  {signedIn ? "Open your dashboard" : "Start free"}
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto sm:px-7">
                <a href="#product">See how it works</a>
              </Button>
            </div>

            <p className="mt-4 text-[12.5px] text-ink-3">
              {configured
                ? "No card required. Explore with sample data."
                : "Set up your database and Clerk keys to get started - see the README."}
            </p>
          </div>

          {/* ---------------------------------------------------- mockup */}
          <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8 pb-10 sm:pb-14 scroll-mt-20" id="product">
            <DashboardMockup />
          </div>
        </section>

        {/* ------------------------------------------------------ numbers */}
        <section className="border-y border-[var(--line)] bg-[var(--inset)]">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10">
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                ["Every figure", "computed from your own ledger, never estimated"],
                ["Two clicks", "from opening the app to knowing this month's profit"],
                ["One source", "sales, stock, costs and customers in the same place"],
                ["Any currency", "formatted correctly, with tax handled properly"],
              ].map(([term, def]) => (
                <div key={term}>
                  <dt className="text-[15px] font-semibold text-ink tracking-[-0.015em]">{term}</dt>
                  <dd className="text-[12.5px] text-ink-3 mt-1.5 leading-relaxed">{def}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ----------------------------------------------------- features */}
        <FeatureGrid />

        {/* ------------------------------------------------------ honesty */}
        <section className="border-t border-[var(--line)]">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 sm:py-14">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 lg:gap-16 items-center">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-[var(--accent-ink)]">
                  Numbers you can stand behind
                </p>
                <h2 className="mt-3 text-[clamp(24px,3.5vw,34px)] font-semibold text-ink tracking-[-0.03em] leading-[1.12]">
                  Know what you actually keep.
                </h2>
                <p className="mt-4 text-[14.5px] text-ink-2 leading-relaxed">
                  See sales minus product costs and expenses. Tax stays separate, and past sales keep their original costs.
                </p>

                <ul className="mt-6 space-y-3">
                  {[
                    "Accurate amounts, without rounding drift",
                    "Sales and stock stay in sync",
                    "Refunds keep a clear audit trail",
                    "Discounts and tax accounted for",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="size-4 mt-0.5 grid place-items-center rounded-full bg-[var(--pos-soft)] shrink-0">
                        <Check className="size-2.5 text-[var(--pos)] stroke-[3]" aria-hidden />
                      </span>
                      <span className="text-[13.5px] text-ink-2 leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-ink">From takings to profit</p>
                  <span className="text-[11.5px] text-ink-3">This month</span>
                </div>
                <dl className="divide-y divide-[var(--line)]">
                  {[
                    ["Gross revenue", "100,583.57", false, false],
                    ["Discounts", "-765.36", true, false],
                    ["Refunds", "-1,697.90", true, false],
                    ["Net revenue", "98,120.31", false, true],
                    ["Cost of goods sold", "-57,542.10", true, false],
                    ["Gross profit", "40,578.21", false, true],
                    ["Operating expenses", "-17,733.77", true, false],
                    ["Net profit", "22,844.44", false, true],
                  ].map(([label, value, negative, strong], i, all) => (
                    <div
                      key={label as string}
                      className={`flex items-baseline justify-between gap-4 px-5 py-2.5 ${
                        i === all.length - 1 ? "bg-[var(--accent-soft)]" : ""
                      }`}
                    >
                      <dt
                        className={`text-[13px] ${
                          strong ? "font-semibold text-ink" : "text-ink-2"
                        }`}
                      >
                        {label as string}
                      </dt>
                      <dd
                        className={`text-[13px] tnum ${
                          negative ? "text-[var(--neg)]" : strong ? "font-semibold text-ink" : "text-ink-2"
                        }`}
                      >
                        {value as string}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="px-5 py-2.5 text-[11px] text-ink-3 border-t border-[var(--line)] bg-[var(--inset)]">
                  Illustrative figures. In your store these come from your own ledger.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ pricing */}
        <PricingTable signedIn={signedIn} />

        {/* ---------------------------------------------------------- cta */}
        <section className="border-t border-[var(--line)] bg-[var(--inset)]">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 sm:py-14 text-center">
            <h2 className="text-[clamp(24px,3.5vw,34px)] font-semibold text-ink tracking-[-0.03em] leading-[1.12]">
              Open your books in about a minute.
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[14.5px] text-ink-2 leading-relaxed">
              Create a store and try the till, stock tracking, and reports with sample data.
            </p>
            <Button asChild variant="primary" size="lg" className="mt-7 sm:px-8">
              <Link href={signedIn ? "/dashboard" : "/sign-up"}>
                {signedIn ? "Open your dashboard" : "Create your store"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------- footer */}
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="col-span-2 sm:col-span-1">
              <Wordmark size={24} />
              <p className="text-[12.5px] text-ink-3 mt-3 leading-relaxed max-w-[30ch]">
                A financial operating system for independent retailers.
              </p>
            </div>

            {[
              {
                title: "Product",
                links: [
                  ["Dashboard", "/dashboard"],
                  ["Point of sale", "/pos"],
                  ["Analytics", "/analytics"],
                  ["Reports", "/reports"],
                ],
              },
              {
                title: "Operations",
                links: [
                  ["Products", "/products"],
                  ["Inventory", "/inventory"],
                  ["Customers", "/customers"],
                  ["Expenses", "/expenses"],
                ],
              },
              {
                title: "Account",
                links: [
                  ["Sign in", "/sign-in"],
                  ["Create a store", "/sign-up"],
                  ["Settings", "/settings"],
                  ["Team", "/team"],
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                  {col.title}
                </p>
                <ul className="mt-3 space-y-2">
                  {col.links.map(([label, href]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="text-[13px] text-ink-2 hover:text-ink transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-ink-3">
              NexaStore - a demonstration product. Not affiliated with any real retailer.
            </p>
            <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
              <ShieldCheck className="size-3.5" aria-hidden />
              Store data is isolated per tenant and enforced server-side.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
