import * as React from "react";

/**
 * A sparkline is a word-sized graphic: it shows shape, not values.
 * Drawn as inline SVG rather than through the chart library - at this size a
 * charting runtime is pure overhead, and these appear a dozen to a screen.
 */
export function Sparkline({
  data,
  width = 88,
  height = 26,
  color = "var(--accent)",
  fill = true,
  strokeWidth = 1.5,
  className,
  ariaLabel,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
}) {
  // Hooks must run in the same order every render, so this comes before the
  // early return for a series too short to draw.
  const gradientId = React.useId();

  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth;
  const innerH = height - pad * 2;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = pad + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      preserveAspectRatio="none"
    >
      {fill ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.6} fill={color} />
    </svg>
  );
}

/** Tiny bar variant, for counts where a line would imply false continuity. */
export function SparkBars({
  data,
  width = 88,
  height = 26,
  color = "var(--accent)",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (!data?.length) return <div style={{ width, height }} className={className} />;
  const max = Math.max(...data, 1);
  const gap = 1.5;
  const barW = Math.max(1.5, (width - gap * (data.length - 1)) / data.length);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {data.map((v, i) => {
        const h = Math.max(1, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={Math.min(1.5, barW / 2)}
            fill={color}
            opacity={v === 0 ? 0.18 : 0.55 + (v / max) * 0.45}
          />
        );
      })}
    </svg>
  );
}
