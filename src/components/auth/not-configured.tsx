import { KeyRound } from "lucide-react";

/** Shown when neither Clerk nor development auth is available. */
export function AuthNotConfigured() {
  return (
    <div className="text-center">
      <div className="size-11 mx-auto grid place-items-center rounded-[10px] bg-[var(--surface-2)] border border-[var(--line)] mb-4">
        <KeyRound className="size-5 text-[var(--ink-3)]" />
      </div>
      <h1 className="text-[19px] font-semibold text-ink tracking-[-0.02em]">
        Authentication is not configured
      </h1>
      <p className="text-[13.5px] text-ink-3 mt-2 leading-relaxed">
        NexaStore needs an identity provider before anyone can sign in.
      </p>

      <div className="mt-5 text-left rounded-[9px] border border-[var(--line)] bg-[var(--surface-2)] p-4">
        <p className="text-[12.5px] font-medium text-ink mb-2">Add to your .env.local</p>
        <pre className="text-[11.5px] font-mono text-ink-2 leading-relaxed overflow-x-auto">
{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."`}
        </pre>
        <p className="text-[12px] text-ink-3 mt-3 leading-relaxed">
          Or set <code className="font-mono text-[11px]">NEXASTORE_DEV_AUTH=1</code> to use the local
          development identity while you are still setting up.
        </p>
      </div>
    </div>
  );
}
