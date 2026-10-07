"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";

export function MobileLandingNavigation({
  links,
  signedIn,
}: {
  links: readonly { label: string; href: string }[];
  signedIn: boolean;
}) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden size-11" aria-label="Open navigation menu">
          <Menu aria-hidden />
        </Button>
      </DropdownTrigger>
      <DropdownContent align="end" className="md:hidden" aria-label="Landing page navigation">
        {links.map(({ label, href }) => (
          <DropdownItem key={href} asChild className="min-h-11 px-3 text-[14px]">
            <a href={href}>{label}</a>
          </DropdownItem>
        ))}
        <DropdownSeparator />
        {signedIn ? (
          <DropdownItem asChild className="min-h-11 px-3 text-[14px] text-[var(--accent-ink)]">
            <Link href="/dashboard">Open dashboard</Link>
          </DropdownItem>
        ) : (
          <>
            <DropdownItem asChild className="min-h-11 px-3 text-[14px]">
              <Link href="/sign-in">Sign in</Link>
            </DropdownItem>
            <DropdownItem asChild className="min-h-11 px-3 text-[14px] text-[var(--accent-ink)]">
              <Link href="/sign-up">Start free</Link>
            </DropdownItem>
          </>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
