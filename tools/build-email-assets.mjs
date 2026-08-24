/**
 * Képek az üdvözlő e-mailhez.
 *
 * A levelezőprogramok (különösen az Outlook) nem tudják a WebP-t, ezért
 * JPG/PNG kell. A logó a weboldalon CSS-szűrővel lesz fehér — levélben nincs
 * szűrő, ezért itt gyártunk belőle valódi fehér változatot.
 *
 * Futtatás:  node tools/build-email-assets.mjs
 * Eredmény:  assets/email/
 */
import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMG = join(ROOT, "assets/img");
const OUT = join(ROOT, "assets/email");
await mkdir(OUT, { recursive: true });

const kb = async (p) => ((await stat(p)).size / 1024).toFixed(0) + " kB";

/* 1) Fehér logó.
   Fehér lapot rajzolunk, majd a logót „dest-in" módban ráhelyezzük: ez ott
   hagyja meg a fehéret, ahol a logó nem átlátszó — vagyis a logó fehér
   sziluettjét kapjuk. (A joinChannel nyers puffert várna, nem kódolt PNG-t.) */
{
  const src = join(IMG, "logo.png");
  const meta = await sharp(src).metadata();
  const dst = join(OUT, "logo-white.png");
  const maszkolt = await sharp({
    create: {
      width: meta.width, height: meta.height, channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: src, blend: "dest-in" }])
    .png()
    .toBuffer();

  await sharp(maszkolt).resize({ width: 420 }).png({ compressionLevel: 9 }).toFile(dst);
  console.log(`logo-white.png      ${await kb(dst)}`);
}

/* 2) Fejléckép: az esti sátor, sötétítve, hogy a fehér szöveg olvasható legyen */
{
  const dst = join(OUT, "hero.jpg");
  await sharp(join(IMG, "tent-night.webp"))
    .resize({ width: 1200, height: 500, fit: "cover", position: "attention" })
    .modulate({ brightness: 0.82 })
    .jpeg({ quality: 78, progressive: true })
    .toFile(dst);
  console.log(`hero.jpg            ${await kb(dst)}`);
}

/* 3) Előtte/utána kép: a két Mercedes-fotó egymás mellett, elválasztó vonallal */
{
  const W = 1200, H = 460, GAP = 6;
  const fel = Math.floor((W - GAP) / 2);
  const [bal, jobb] = await Promise.all(
    ["mercedes-before.webp", "mercedes-after.webp"].map((n) =>
      sharp(join(IMG, "ba", n)).resize({ width: fel, height: H, fit: "cover" }).toBuffer()
    )
  );
  const dst = join(OUT, "before-after.jpg");
  await sharp({ create: { width: W, height: H, channels: 3, background: "#2b93c8" } })
    .composite([
      { input: bal, left: 0, top: 0 },
      { input: jobb, left: fel + GAP, top: 0 },
    ])
    .jpeg({ quality: 80, progressive: true })
    .toFile(dst);
  console.log(`before-after.jpg    ${await kb(dst)}`);
}
