import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptySearchMark } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="min-h-dvh grid place-items-center px-5 py-12 bg-[var(--page)]">
      <div className="w-full max-w-[420px] text-center">
        <div className="size-12 mx-auto text-[var(--ink-3)] mb-5">
          <EmptySearchMark />
        </div>

        <h1 className="text-[21px] font-semibold text-ink tracking-[-0.025em]">
          We could not find that
        </h1>
        <p className="text-[13.5px] text-ink-2 mt-2.5 leading-relaxed">
          The page, order or product you were looking for does not exist, or it belongs to a
          different store.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button asChild variant="primary" size="md" className="w-full sm:w-auto">
            <Link href="/dashboard">
              <ArrowLeft />
              Back to dashboard
            </Link>
          </Button>
          <Button asChild variant="secondary" size="md" className="w-full sm:w-auto">
            <Link href="/sales">
              <Search />
              Browse sales
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
