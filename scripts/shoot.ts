/**
 * Screenshot harness for local visual review.
 *
 * Drives the system Chrome through puppeteer-core, signs in with the local
 * development identity, and captures each route in both themes. Console
 * errors and failed requests are reported, so a screenshot that "looks fine"
 * cannot hide a broken component.
 *
 *   npx tsx scripts/shoot.ts                       all routes, both themes
 *   npx tsx scripts/shoot.ts /dashboard /pos       specific routes
 *   npx tsx scripts/shoot.ts --theme=dark --w=430  mobile width, dark only
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { mkdirSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.SHOOT_BASE || "http://localhost:3000";
const OUT = process.env.SHOOT_OUT || "/Users/abdallah/.nexastore/shots";

const DEFAULT_ROUTES = [
  "/", "/dashboard", "/sales", "/products", "/inventory",
  "/customers", "/expenses", "/analytics", "/reports", "/insights", "/pos",
];

function arg(name: string, fallback: string) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function devCookie(email: string, displayName: string) {
  const userId = `dev_${Buffer.from(email).toString("base64url").slice(0, 24)}`;
  const payload = JSON.stringify({ userId, email, displayName });
  const secret = process.env.NEXASTORE_DEV_AUTH_SECRET || "nexastore-local-development-only";
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

async function main() {
  const routes = process.argv.slice(2).filter((a) => a.startsWith("/"));
  const list = routes.length ? routes : DEFAULT_ROUTES;
  const themes = arg("theme", "light,dark").split(",");
  const width = Number(arg("w", "1440"));
  const height = Number(arg("h", "1000"));
  const full = process.argv.includes("--full");

  mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb", "--hide-scrollbars"],
    defaultViewport: { width, height, deviceScaleFactor: 2 },
  });

  const problems: string[] = [];

  try {
    for (const theme of themes) {
      const page = await browser.newPage();

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // React's dev-only hydration hints and favicon noise are not defects.
          if (/favicon|Download the React DevTools/i.test(text)) return;
          problems.push(`[console ${theme}] ${text.slice(0, 220)}`);
        }
      });
      page.on("pageerror", (err: unknown) => problems.push(`[pageerror ${theme}] ${String((err as Error)?.message ?? err).slice(0, 220)}`));
      page.on("requestfailed", (req) => {
        const f = req.failure()?.errorText ?? "";
        if (/ERR_ABORTED/.test(f)) return;
        problems.push(`[request ${theme}] ${req.url().slice(0, 120)} ${f}`);
      });

      await page.setCookie({
        name: "nexastore_dev_identity",
        value: devCookie("owner@nexastore.dev", "Owner"),
        domain: "localhost",
        path: "/",
      });

      for (const route of list) {
        const url = `${BASE}${route}`;
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        } catch (e) {
          problems.push(`[nav] ${route} ${(e as Error).message.slice(0, 120)}`);
          continue;
        }

        // Force the theme deterministically, then let charts finish animating.
        await page.evaluate((t) => {
          localStorage.setItem("theme", t);
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(t);
          document.documentElement.style.colorScheme = t;
        }, theme);
        await new Promise((r) => setTimeout(r, 1400));

        const name = `${route === "/" ? "landing" : route.replace(/\//g, "-").replace(/^-/, "")}--${theme}${width < 700 ? "-mobile" : ""}.png`;
        await page.screenshot({ path: `${OUT}/${name}`, fullPage: full });
        console.log(`  shot  ${name}`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (problems.length) {
    const unique = [...new Set(problems)];
    console.log(`\n  ${unique.length} problem(s) detected:\n`);
    for (const p of unique.slice(0, 40)) console.log(`    ${p}`);
    writeFileSync(`${OUT}/problems.txt`, unique.join("\n"));
  } else {
    console.log("\n  No console errors or failed requests.\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
