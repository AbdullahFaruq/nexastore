import * as React from "react";
import { cn, hashIndex } from "@/lib/utils";

const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];

/**
 * Product thumbnail.
 *
 * When there is no image - which is the normal case for a shop that has just
 * started - it draws a monogram tile in the product's own hue rather than a
 * grey box with a broken-image icon. Deterministic, so a product looks the
 * same everywhere it appears.
 */
export function ProductTile({
  name,
  sku,
  image,
  size = 36,
  colorSlot,
  className,
}: {
  name: string;
  sku?: string;
  image?: string | null;
  size?: number;
  colorSlot?: number;
  className?: string;
}) {
  const slot = colorSlot ?? hashIndex(sku || name || "?", 8);
  const hue = `var(${SERIES[slot % 8]})`;

  const glyph = React.useMemo(() => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [name]);

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={cn("rounded-[7px] object-cover shrink-0 border border-[var(--line)]", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid place-items-center rounded-[7px] shrink-0 font-semibold select-none border",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.34),
        background: `color-mix(in oklab, ${hue} 13%, var(--surface))`,
        color: `color-mix(in oklab, ${hue} 72%, var(--ink))`,
        borderColor: `color-mix(in oklab, ${hue} 22%, var(--line))`,
      }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}
