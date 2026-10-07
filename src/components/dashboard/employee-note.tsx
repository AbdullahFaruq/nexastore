import { Lock } from "lucide-react";

/**
 * Employees can record sales but not see margins. Saying so plainly is better
 * than silently rendering a thinner dashboard and leaving them to wonder.
 */
export function EmployeeDashboardNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-[9px] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3">
      <Lock className="size-4 text-[var(--ink-3)] shrink-0 mt-px" aria-hidden />
      <p className="text-[12.5px] text-ink-2 leading-relaxed">
        You are signed in with an <strong className="font-medium">Employee</strong> role, so this
        dashboard shows trading activity but not revenue, costs or margins. Ask a store owner if you
        need financial reporting.
      </p>
    </div>
  );
}
