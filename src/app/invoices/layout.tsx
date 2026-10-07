/**
 * Invoices render outside the app shell so that printing produces a clean
 * document - no sidebar, no navigation, no theme chrome bleeding onto paper.
 */
export default function InvoiceLayout({ children }: LayoutProps<"/invoices">) {
  return <div className="min-h-dvh bg-[var(--surface-2)] print:bg-white">{children}</div>;
}
