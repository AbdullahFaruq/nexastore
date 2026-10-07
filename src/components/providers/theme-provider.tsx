"use client";

import * as React from "react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Dropdown, DropdownContent, DropdownRadioGroup, DropdownRadioItem, DropdownTrigger } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

export function ThemeSwitcher({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  // The resolved theme is unknowable on the server, so render a stable
  // placeholder until hydration rather than flashing the wrong icon.
  const Icon = !hydrated ? Monitor : theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="ghost" size={compact ? "iconSm" : "icon"} aria-label="Change theme">
          <Icon />
        </Button>
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownRadioGroup value={hydrated ? theme : "system"} onValueChange={setTheme}>
          <DropdownRadioItem value="light">
            <Sun /> Light
          </DropdownRadioItem>
          <DropdownRadioItem value="dark">
            <Moon /> Dark
          </DropdownRadioItem>
          <DropdownRadioItem value="system">
            <Monitor /> System
          </DropdownRadioItem>
        </DropdownRadioGroup>
      </DropdownContent>
    </Dropdown>
  );
}
