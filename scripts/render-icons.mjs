/**
 * Renders PNG app icons from their SVG sources in public/icons.
 *
 *   node scripts/render-icons.mjs
 *
 * Uses the locally installed Chrome through playwright-core, so the PNGs match
 * exactly what a browser draws from the SVG. Set CHROME_PATH to use another
 * Chromium-based binary. Add an entry to ICONS to render another size or variant.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ICON_DIR = fileURLToPath(new URL("../public/icons/", import.meta.url));

/** Each SVG source and the square PNG sizes rendered from it. */
const ICONS = [
  { source: "icon-maskable.svg", outputs: [{ file: "icon-maskable-192.png", size: 192 }, { file: "icon-maskable-512.png", size: 512 }] },
];

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" },
);

try {
  for (const { source, outputs } of ICONS) {
    const svg = await readFile(`${ICON_DIR}${source}`, "utf8");

    for (const { file, size } of outputs) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      // The SVG fills the viewport exactly; no page margin or background leaks in.
      await page.setContent(
        `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
      );
      await page.screenshot({ path: `${ICON_DIR}${file}`, omitBackground: true });
      await page.close();
      console.log(`rendered ${file} (${size}×${size}) from ${source}`);
    }
  }
} finally {
  await browser.close();
}
