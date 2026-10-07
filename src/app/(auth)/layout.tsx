import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/layout/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_minmax(420px,44%)]">
      {/* Left: the pitch. Hidden on small screens where it would just push the
          form below the fold. */}
      <aside className="hidden lg:flex flex-col justify-between p-10 bg-[var(--inset)] border-r border-[var(--line)] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.5] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 60% at 30% 40%, black, transparent)",
          }}
          aria-hidden
        />
        <Link href="/" className="relative z-10 w-fit">
          <Wordmark size={26} />
        </Link>

        <div className="relative z-10 max-w-[38ch]">
          <p className="text-[28px] font-semibold text-ink tracking-[-0.03em] leading-[1.15]">
            Know your store.
            <br />
            Grow your business.
          </p>
          <p className="text-[14px] text-ink-2 mt-4 leading-relaxed">
            Every sale, every cost and every margin in one place - so you can answer
            &ldquo;how did we do?&rdquo; without opening a spreadsheet.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-[12px] text-ink-3">
          <span>Real-time profit</span>
          <span className="size-1 rounded-full bg-[var(--line-strong)]" aria-hidden />
          <span>Stock intelligence</span>
          <span className="size-1 rounded-full bg-[var(--line-strong)]" aria-hidden />
          <span>Multi-store</span>
        </div>
      </aside>

      <main id="main" className="flex flex-col">
        <div className="lg:hidden flex items-center justify-between px-5 h-14 border-b border-[var(--line)]">
          <Link href="/">
            <Wordmark size={22} />
          </Link>
          <Link
            href="/"
            className="text-[12.5px] text-ink-3 hover:text-ink-2 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
        </div>
        <div className="flex-1 grid place-items-center p-5 sm:p-8">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
