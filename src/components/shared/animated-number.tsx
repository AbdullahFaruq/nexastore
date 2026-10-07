"use client";

import * as React from "react";
import { formatMoney } from "@/lib/format/currency";
import { formatCount } from "@/lib/utils";

/**
 * Counts a figure up on mount.
 *
 * The animation is short and eased out, so the number settles rather than
 * spinning - it draws the eye to the headline once, then gets out of the way.
 * Respects prefers-reduced-motion by rendering the final value immediately.
 */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

function useCountUp(target: number, duration = 700, enabled = true) {
  // Whether to animate is decided at render time, not inside the effect - so
  // the effect only ever drives frames, and a disabled or reduced-motion
  // render starts at the final value instead of updating state to get there.
  const animate = enabled && !prefersReducedMotion();

  const [value, setValue] = React.useState(animate ? 0 : target);
  const frame = React.useRef<number | undefined>(undefined);
  const previous = React.useRef(animate ? 0 : target);

  // A target change on a non-animating figure is adopted during render. The
  // `previous` ref is left alone here - refs must not be written during render,
  // and only the effect ever reads it.
  const [lastTarget, setLastTarget] = React.useState(target);
  if (!animate && target !== lastTarget) {
    setLastTarget(target);
    setValue(target);
  }

  React.useEffect(() => {
    if (!animate) return;

    const from = previous.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo: fast out of the gate, then settles rather than spinning.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(from + (target - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else previous.current = target;
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, animate]);

  return value;
}

export function AnimatedMoney({
  value,
  currency,
  compact,
  noDecimals,
  className,
  animate = true,
}: {
  value: number;
  currency: string;
  compact?: boolean;
  noDecimals?: boolean;
  className?: string;
  animate?: boolean;
}) {
  const shown = useCountUp(value, 700, animate);
  const rounded = Math.round(shown);
  return (
    <span className={className} suppressHydrationWarning>
      {formatMoney(rounded, currency, { compact, noDecimals })}
    </span>
  );
}

export function AnimatedCount({
  value,
  className,
  compact,
  animate = true,
}: {
  value: number;
  className?: string;
  compact?: boolean;
  animate?: boolean;
}) {
  const shown = useCountUp(value, 700, animate);
  return (
    <span className={className} suppressHydrationWarning>
      {formatCount(Math.round(shown), compact)}
    </span>
  );
}
