"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True once the client has hydrated, false during server render.
 *
 * Uses useSyncExternalStore rather than the usual `useState(false)` plus an
 * effect: it needs no state update after mount, so it does not trigger the
 * cascading render that pattern causes.
 *
 * Use it for anything whose correct value is unknowable on the server - the
 * resolved theme, for instance - so the first paint is stable rather than
 * flickering to the right answer.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
