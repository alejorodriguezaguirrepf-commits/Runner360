// Genera los íconos de la app instalable (PWA) a partir de apps/web/src/app/icon.svg.
// Uso: node apps/web/scripts/render-pwa-icons.mjs   (usa el Chromium de Playwright)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const svg = readFileSync(join(root, "apps/web/src/app/icon.svg"), "utf8");
const out = join(root, "apps/web/public/icons");
// Maskable: fondo a sangre y el corredor dentro de la zona segura (80 % central).
const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<rect[^>]*\/>/, "");
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#18A999"/><g transform="translate(5.6 5.6) scale(0.65)">${inner}</g></svg>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
async function render(source, size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${source.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  writeFileSync(join(out, file), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
  await page.close();
}
for (const s of [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]) await render(svg, s, `icon-${s}.png`);
for (const s of [192, 512]) await render(maskable, s, `maskable-${s}.png`);
await browser.close();
console.log(`Íconos en ${out}`);
