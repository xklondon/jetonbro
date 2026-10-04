import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const html = pathToFileURL(join(root, "design/reference/classic/blackjack-fidelity-prototype.html")).href;
const out = join(root, "docs/screenshots/blackjack-fidelity-prototype");
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 860, height: 980 } });
await page.goto(html, { waitUntil: "networkidle" });

const phones = await page.locator(".phone").all();
const pairs = await page.locator(".pair").all();
for (const [index, phone] of phones.entries()) {
  const name = (await phone.getAttribute("data-screen")) ?? `phone-${index + 1}`;
  await phone.screenshot({ path: join(out, `${String(index + 1).padStart(2, "0")}-${name}.png`) });
}
for (const [index, pair] of pairs.entries()) {
  const id = (await pair.getAttribute("id")) ?? `pair-${index + 1}`;
  await pair.screenshot({ path: join(out, `pair-${id}.png`) });
}

await browser.close();
console.log(`wrote ${phones.length} phones and ${pairs.length} pairs to ${out}`);
