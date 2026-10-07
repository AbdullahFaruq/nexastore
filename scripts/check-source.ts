/**
 * Guards against two classes of silent defect:
 *
 * 1. Look-alike Unicode in identifiers - a Cyrillic "С" or a full-width "]"
 *    compiles differently from the ASCII character it resembles, and the bug
 *    is invisible in review.
 * 2. Hardcoded currency symbols in components - every amount must go through
 *    formatMoney with the store's currency.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
let problems = 0;

// Characters that are legitimate in prose/JSX text but never in code.
const ALLOWED_NON_ASCII = new Set([
  "—", "–", "…", "‘", "’", "“", "”",
  " ", "−", "·", "→", "←", "↑", "↓",
  "°", "©", "®", "™", "×", "≤", "≥",
  "€", "£", "₺", "¥", "₹", "₦", "ـ",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);

// 3. A "use client" module must not import anything that pulls in the Mongo
//    driver. Turbopack only fails at build time and the message is opaque, so
//    catch it here where the offending import is obvious.
const SERVER_ONLY = [
  "@/lib/db/connect", "@/lib/db/tx", "@/lib/db/models/shared",
  "@/lib/analytics/summary", "@/lib/analytics/timeseries", "@/lib/analytics/products",
  "@/lib/analytics/inventory", "@/lib/analytics/categories", "@/lib/analytics/expenses",
  "@/lib/analytics/customers", "@/lib/analytics/pnl", "@/lib/analytics/insights",
  "@/lib/analytics/shared", "@/lib/auth/context", "@/lib/auth/provider",
  "@/lib/seed/generate", "mongoose",
];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!/^\s*["']use client["']/m.test(src)) continue;

  for (const mod of SERVER_ONLY) {
    // `import type` is erased at compile time and is always safe.
    const valueImport = new RegExp(
      `import\\s+(?!type\\b)[^;]*?from\\s+["']${mod.replace(/[/@]/g, "\\$&")}["']`,
      "s",
    );
    if (valueImport.test(src)) {
      console.log(`  ${file}  client component imports server-only module "${mod}"`);
      console.log("    Move the value into a dependency-free module and import it from there.");
      problems++;
    }
  }
}

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Comments describe the rule; they are not violations of it.
    const isComment = trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*");
    // The marker may sit on the line itself or in the comment above it.
    const optedOut =
      line.includes("source-check-ignore") ||
      (lines[i - 1]?.includes("source-check-ignore") ?? false);
    // 1. Suspicious Unicode outside string literals and comments.
    const stripped = line
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
      .replace(/\/\/.*$/, "")
      .replace(/\/\*.*?\*\//g, "");

    for (const ch of stripped) {
      if (ch.charCodeAt(0) > 127 && !ALLOWED_NON_ASCII.has(ch)) {
        console.log(
          `  ${file}:${i + 1}  non-ASCII in code: ${JSON.stringify(ch)} (U+${ch
            .charCodeAt(0)
            .toString(16)
            .toUpperCase()
            .padStart(4, "0")})`,
        );
        console.log(`    ${line.trim().slice(0, 110)}`);
        problems++;
        break;
      }
    }

    // 2. A hardcoded currency glyph pinned to a value. Template literals open
    //    with `${...}` and MongoDB field paths look like "$soldAt", so only
    //    these three shapes count - they are the actual mistake:
    //      `$${amount}`   "$" + value   "$12.00"
    const hardcodedMoney =
      /\$\$\{/.test(line) ||
      /["'`]\s*[$£€₺¥₹]\s*["'`]/.test(line) ||
      /["'`]\s*[$£€₺¥₹]\s*(?:\d{2,}|\d[.,])/.test(line);

    if (
      hardcodedMoney &&
      !isComment &&
      !optedOut &&
      !/formatMoney|formatMoneyPlain|currencyMeta|symbol|CURRENCIES|process\.env|import |from "/.test(line)
    ) {
      console.log(`  ${file}:${i + 1}  possible hardcoded currency symbol`);
      console.log(`    ${line.trim().slice(0, 110)}`);
      problems++;
    }
  });
}

console.log(
  problems === 0
    ? `\n  ${files.length} source files clean.\n`
    : `\n  ${problems} problem(s) found across ${files.length} files.\n`,
);
if (problems > 0) process.exit(1);
