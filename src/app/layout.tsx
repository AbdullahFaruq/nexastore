import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/popover";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "NexaStore - Know your store. Grow your business.",
    template: "%s - NexaStore",
  },
  description:
    "A financial operating system for independent retailers. Track revenue, profit, inventory and expenses in one place, and understand your business in seconds.",
  applicationName: "NexaStore",
  authors: [{ name: "NexaStore" }],
  openGraph: {
    title: "NexaStore",
    description: "Know your store. Grow your business.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcfa" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider delayDuration={300} skipDelayDuration={200}>
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-3 focus:left-3 focus:px-3 focus:py-2 focus:rounded-[7px] focus:bg-[var(--surface)] focus:border focus:border-[var(--accent)] focus:text-[13px] focus:font-medium"
              >
                Skip to content
              </a>
              {children}
              <Toaster
                position="bottom-right"
                offset={16}
                toastOptions={{
                  classNames: {
                    toast:
                      "!bg-[var(--surface)] !border !border-[var(--line-strong)] !shadow-pop !rounded-[9px] !text-[13px] !text-ink !font-sans",
                    description: "!text-ink-3 !text-[12.5px]",
                    actionButton: "!bg-[var(--accent)] !text-[var(--accent-fg)] !text-[12px] !rounded-[6px]",
                    cancelButton: "!bg-[var(--surface-2)] !text-ink-2 !text-[12px] !rounded-[6px]",
                    success: "[&_[data-icon]]:!text-[var(--pos)]",
                    error: "[&_[data-icon]]:!text-[var(--neg)]",
                  },
                }}
              />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
