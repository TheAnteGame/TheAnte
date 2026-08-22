/**
 * Screenshots the two moments the room will argue about — the reveal and the payout —
 * from the local torture season, at full page height.
 *
 * LOCAL ONLY. Requires: supabase start; npm run torture:reset; npm run dev.
 *   npx tsx scripts/preview-shots.mts [outDir]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.PREVIEW_BASE ?? "http://localhost:33333";
const outDir = process.argv[2] ?? "docs/preview-shots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });

async function shot(name: string, selector: string) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 15_000 });
  await el.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`  ✓ ${outDir}/${name}.png`);
}

// The homepage (public) and the open betting board — the two surfaces the contrast
// pass changed most. The board only renders as a board while a week is open; leave the
// DB there with TORTURE_STOP_AFTER_OPEN=1 before running this.
if (process.env.SHOTS_UI === "1") {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outDir}/ui-1-homepage.png` });
  console.log(`  ✓ ${outDir}/ui-1-homepage.png`);

  await page.goto(`${BASE}/mock-preview/1`, { waitUntil: "networkidle" });
  const tile = page.locator(".team-tile").first();
  if (await tile.count()) {
    await shot("ui-2-board-resting", "#board");
    await tile.hover();
    await page.waitForTimeout(300);
    await shot("ui-3-board-hover", "#board");
    await tile.click();
    await page.waitForTimeout(300);
    await shot("ui-4-board-selected", "#board");
  }
  await browser.close();
  console.log("done");
  process.exit(0);
}

for (const week of [1, 6]) {
  console.log(`week ${week}:`);
  await page.goto(`${BASE}/mock-preview/${week}`, { waitUntil: "networkidle" });

  // The reveal plays interstitial → shove beat (if any) → board. Capture each beat,
  // then click through: the button is the stage itself.
  const stage = page.locator("#reveal button").first();
  if (await stage.isVisible().catch(() => false)) {
    await shot(`w${week}-1-reveal-interstitial`, "#reveal section, #reveal > button");
    await stage.click();
    await page.waitForTimeout(400);
    const next = page.locator("#reveal button").first();
    if (await next.isVisible().catch(() => false)) {
      const isBeat = await next.locator("text=/SHOVE/i").count().catch(() => 0);
      if (isBeat) {
        await shot(`w${week}-2-reveal-shove-beat`, "#reveal > button");
        await next.click();
        await page.waitForTimeout(400);
      }
    }
  }
  await page.waitForTimeout(600);
  await shot(`w${week}-3-reveal-board`, "#reveal");
  await shot(`w${week}-4-settled-payout`, "#settled");
  await shot(`w${week}-5-pot-math`, "#potmath");
}

await browser.close();
console.log("done");
