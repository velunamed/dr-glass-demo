/**
 * Képoptimalizálás: az assets/img alatti JPG/PNG fájlokból WebP-et készít.
 * Futtatás:  node tools/optimize-images.mjs
 * (a sharp csomagot az npx tölti le: `npx -y -p sharp node tools/optimize-images.mjs`)
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import { join, extname, dirname, basename } from "node:path";
import sharp from "sharp";

const ROOT = new URL("../assets/img/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const MAX_W = 1600;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(jpe?g|png)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
let saved = 0;

for (const f of files) {
  const target = join(dirname(f), basename(f, extname(f)) + ".webp");
  const img = sharp(f);
  const meta = await img.metadata();
  const buf = await img
    .resize({ width: Math.min(meta.width || MAX_W, MAX_W), withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();
  await writeFile(target, buf);
  const before = (await stat(f)).size;
  saved += before - buf.length;
  console.log(
    `${basename(f).padEnd(28)} ${(before / 1024).toFixed(0).padStart(5)} kB → ${(buf.length / 1024).toFixed(0).padStart(5)} kB`
  );
}

console.log(`\nÖsszesen megspórolva: ${(saved / 1024 / 1024).toFixed(2)} MB`);
