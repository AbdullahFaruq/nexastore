"use client";

import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Print controls.
 *
 * "Download PDF" opens the same print dialog: every desktop browser offers
 * "Save as PDF" there, which produces a properly paginated, selectable-text
 * document. Rendering our own PDF client-side would be a heavier, worse
 * artefact for no gain.
 */
export function PrintBar({ backHref, orderNumber }: { backHref: string; orderNumber: string }) {
  return (
    <div className="no-print flex items-center justify-between gap-3 mb-4">
      <Button asChild variant="ghost" size="sm">
        <Link href={backHref}>
          <ArrowLeft />
          Order {orderNumber}
        </Link>
      </Button>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Download />
          Save as PDF
        </Button>
        <Button variant="primary" size="sm" onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </div>
    </div>
  );
}
