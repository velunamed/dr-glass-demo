/**
 * Egyetlen, önmagában futó HTML-t épít az oldalból: a CSS, a JS és az összes kép
 * bele van ágyazva a fájlba. Így megosztható olyan helyen is, ahol nincs külön
 * fájlkiszolgálás (pl. Claude Artifact).
 *
 * Futtatás:  node tools/build-standalone.mjs
 * Eredmény:  dist/preview.html
 */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_W = 1400;   // előnézethez elég, sokkal kisebb fájl
const QUALITY = 78;

const MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

async function toDataUri(relPath) {
  const abs = join(ROOT, relPath);
  const ext = extname(relPath).toLowerCase();

  // PNG-t átlátszóság miatt nem alakítunk WebP-re, csak beágyazzuk
  if (ext === ".png") {
    const buf = await readFile(abs);
    return { uri: `data:image/png;base64,${buf.toString("base64")}`, bytes: buf.length };
  }

  const meta = await sharp(abs).metadata();
  const buf = await sharp(abs)
    .resize({ width: Math.min(meta.width || MAX_W, MAX_W), withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer();
  return { uri: `data:image/webp;base64,${buf.toString("base64")}`, bytes: buf.length };
}

const html = await readFile(join(ROOT, "index.html"), "utf8");
const css = await readFile(join(ROOT, "assets/css/style.css"), "utf8");
const i18n = await readFile(join(ROOT, "assets/js/i18n.js"), "utf8");
const main = await readFile(join(ROOT, "assets/js/main.js"), "utf8");

// 1. csak a body tartalma kell — a fejlécet mi állítjuk össze
const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));

// 2. külső JS-hivatkozások helyett beágyazott kód
const guard = (s) => s.replace(/<\/script/gi, "<\\/script");
let out = body
  .replace('<script src="assets/js/i18n.js"></script>', `<script>\n${guard(i18n)}\n</script>`)
  .replace('<script src="assets/js/main.js"></script>', `<script>\n${guard(main)}\n</script>`);

// 3. minden kép data URI-ként
const srcs = [...new Set([...out.matchAll(/src="(assets\/img\/[^"]+)"/g)].map((m) => m[1]))];
let total = 0;
for (const rel of srcs) {
  const { uri, bytes } = await toDataUri(rel);
  const before = (await stat(join(ROOT, rel))).size;
  total += uri.length;
  out = out.replaceAll(`src="${rel}"`, `src="${uri}"`);
  console.log(`${rel.padEnd(38)} ${(before / 1024).toFixed(0).padStart(4)} → ${(bytes / 1024).toFixed(0).padStart(4)} kB`);
}

// 4. fejléc: cím, leírás, betűtípusok, stílus
const head = `<title>Dr.Glass</title>
<meta name="description" content="Szélvédőjavítás, fényszóró-polírozás és felújítás, ózonos klímatisztítás Esztergomban és Štúrovóban.">
<meta name="theme-color" content="#06111a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
${css}
</style>
`;

await mkdir(join(ROOT, "dist"), { recursive: true });
const file = join(ROOT, "dist/preview.html");
await writeFile(file, head + out, "utf8");

const size = (await stat(file)).size;
console.log(`\ndist/preview.html — ${(size / 1024 / 1024).toFixed(2)} MB (ebből kép: ${(total / 1024 / 1024).toFixed(2)} MB)`);
