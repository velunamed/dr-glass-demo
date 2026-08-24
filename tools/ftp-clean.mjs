/**
 * Kitakarítja a webgyökeret: mindent töröl, AMI NINCS a megtartandó listán.
 *
 * Alapból csak kiírja, mit tenne. Ténylegesen törölni a --confirm kapcsolóval fog.
 *
 *   node tools/ftp-clean.mjs            # csak a terv
 *   node tools/ftp-clean.mjs --confirm  # végrehajtás
 */
import { Client } from "basic-ftp";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, posix } from "node:path";

// ezek maradnak a szerveren — a Rackhost saját mappái
const KEEP = new Set(["error", "stats", ".", ".."]);

const cfg = JSON.parse(await readFile(join(homedir(), ".drglass-ftp.json"), "utf8"));
const mask = (s) => String(s).replace(cfg.password, "***");
const ROOT = cfg.remoteRoot || "/";
const CONFIRM = process.argv.includes("--confirm");

async function fresh() {
  const c = new Client(25000);
  c.ftp.verbose = false;
  await c.access({
    host: cfg.host, user: cfg.user, password: cfg.password,
    secure: cfg.secure !== false,
    secureOptions: cfg.allowSelfSigned ? { rejectUnauthorized: false } : undefined,
  });
  return c;
}

let client = await fresh();
async function withRetry(fn, label, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try { return await fn(client); }
    catch (e) {
      if (i === tries) throw e;
      console.log(`   újra (${i}) ${label}: ${mask(e.message).slice(0, 60)}`);
      try { client.close(); } catch {}
      await new Promise((r) => setTimeout(r, 1200 * i));
      client = await fresh();
    }
  }
}

const list = await withRetry((c) => c.list(ROOT), "gyökér listázása");
const del = list.filter((e) => !KEEP.has(e.name));
const kept = list.filter((e) => KEEP.has(e.name));

console.log(`Webgyökér: ${ROOT}`);
console.log(`\nMARAD (${kept.length}):`);
kept.forEach((e) => console.log(`   ${e.isDirectory ? "[mappa]" : "       "} ${e.name}`));
console.log(`\nTÖRLÉS (${del.length}):`);
del.forEach((e) => console.log(`   ${e.isDirectory ? "[mappa]" : "       "} ${e.name}`));

if (!CONFIRM) {
  console.log("\n(Ez csak a terv. Végrehajtáshoz: --confirm)");
  client.close();
  process.exit(0);
}

console.log("\nTörlés indul…");
let okDb = 0;
const hibak = [];

/* Kézzel, fájlonként bontjuk le a mappákat. A basic-ftp removeDir egyetlen
   megszakadt kapcsolat után az egész mappát feladja; így viszont egy hiba
   csak egy fájlba kerül, és a következő futás onnan folytatja. */
async function rmTree(path, depth = 0) {
  let list;
  try { list = await withRetry((c) => c.list(path), `lista ${path}`); }
  catch (e) { hibak.push(`${path} — ${mask(e.message).slice(0, 60)}`); return; }

  for (const e of list) {
    if (e.name === "." || e.name === "..") continue;
    const p = posix.join(path, e.name);
    if (e.isDirectory) {
      await rmTree(p, depth + 1);
    } else {
      try { await withRetry((c) => c.remove(p), p); okDb++; }
      catch (err) { hibak.push(`${p} — ${mask(err.message).slice(0, 60)}`); }
    }
    if (okDb % 200 === 0 && okDb) process.stdout.write(`\r   ${okDb} fájl törölve…`);
  }
  try { await withRetry((c) => c.removeEmptyDir(path), `mappa ${path}`); okDb++; if (depth === 0) console.log(`\n   mappa törölve: ${path}`); }
  catch (err) { hibak.push(`${path} (mappa) — ${mask(err.message).slice(0, 60)}`); }
}

for (const e of del) {
  const p = posix.join(ROOT, e.name);
  if (e.isDirectory) {
    console.log(`   mappa bontása: ${e.name} …`);
    await rmTree(p);
  } else {
    try { await withRetry((c) => c.remove(p), `fájl ${p}`); okDb++; console.log(`   törölve: ${e.name}`); }
    catch (err) { hibak.push(`${e.name} — ${mask(err.message).slice(0, 70)}`); console.log(`   HIBA:    ${e.name}`); }
  }
}

const maradt = await withRetry((c) => c.list(ROOT), "ellenőrző listázás");
console.log(`\nKész: ${okDb} törölve, ${hibak.length} hiba.`);
if (hibak.length) hibak.forEach((h) => console.log("   " + h));
console.log(`A gyökérben most: ${maradt.map((e) => e.name).join("  ") || "(üres)"}`);
client.close();
