/**
 * Feltöltésre kész csomagot állít össze a Rackhost tárhelyhez.
 * Csak azt viszi át, ami az éles oldalhoz kell — a .jpg eredetiket,
 * a fejlesztői szkripteket és a GitHub Pages CNAME fájlt nem.
 *
 * Futtatás:  node tools/build-rackhost.mjs
 * Eredmény:  dist/rackhost/
 */
import { readFile, writeFile, mkdir, readdir, copyFile, rm, stat } from "node:fs/promises";
import { join, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist/rackhost");

// az assets alól csak ezek a kiterjesztések kellenek (a .jpg eredetik nem)
const KEEP = new Set([".webp", ".png", ".css", ".js", ".svg", ".ico"]);

async function copyTree(srcDir, dstDir) {
  await mkdir(dstDir, { recursive: true });
  for (const e of await readdir(srcDir, { withFileTypes: true })) {
    const s = join(srcDir, e.name);
    const d = join(dstDir, e.name);
    if (e.isDirectory()) await copyTree(s, d);
    else if (KEEP.has(extname(e.name).toLowerCase())) await copyFile(s, d);
  }
}

async function sizeOf(dir) {
  let total = 0, files = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { const r = await sizeOf(p); total += r.total; files += r.files; }
    else { total += (await stat(p)).size; files++; }
  }
  return { total, files };
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// gyökérfájlok
for (const f of ["index.html", "robots.txt", "sitemap.xml"]) {
  await copyFile(join(ROOT, f), join(OUT, f));
}

// .htaccess (a repóban pont nélkül tároljuk, hogy jól látszódjon)
await writeFile(join(OUT, ".htaccess"), await readFile(join(ROOT, "deploy/htaccess"), "utf8"), "utf8");

// az űrlap feldolgozója – csak ide kerül, a GitHub Pages-re nem
await copyFile(join(ROOT, "deploy/send.php"), join(OUT, "send.php"));

// assets
await copyTree(join(ROOT, "assets"), join(OUT, "assets"));


// ellenőrzés: minden hivatkozott kép megvan-e
const html = await readFile(join(OUT, "index.html"), "utf8");
const refs = [...new Set([...html.matchAll(/(?:src|href)="((?:assets)\/[^"]+)"/g)].map((m) => m[1]))];
const missing = [];
for (const r of refs) {
  try { await stat(join(OUT, r)); } catch { missing.push(r); }
}

const { total, files } = await sizeOf(OUT);
console.log(`dist/rackhost/ — ${files} fájl, ${(total / 1024 / 1024).toFixed(2)} MB`);
console.log(`hivatkozott fájlok: ${refs.length}, hiányzó: ${missing.length}`);
if (missing.length) { console.error("HIÁNYZIK:", missing); process.exitCode = 1; }
