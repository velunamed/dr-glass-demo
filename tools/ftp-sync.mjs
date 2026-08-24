/**
 * Újraindítható letöltés FTP-ről, ellenőrzéssel.
 *
 * A basic-ftp downloadToDir egyetlen megszakadt adatkapcsolat után feladja.
 * Ez a változat fájlonként dolgozik: ami már megvan és stimmel a mérete, azt
 * átugorja, hibánál újracsatlakozik, a végén pedig kilistázza, mi hiányzik.
 *
 *   node tools/ftp-sync.mjs pull <távoli út> [cél mappa]
 *   node tools/ftp-sync.mjs verify <távoli út> [cél mappa]
 */
import { Client } from "basic-ftp";
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(await readFile(join(homedir(), ".drglass-ftp.json"), "utf8"));
const mask = (s) => String(s).replace(cfg.password, "***");

const [mode, remoteRoot = "/", localName = "backup-ftp"] = process.argv.slice(2);
const LOCAL = join(ROOT, localName);

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
      process.stdout.write(`\n  újra (${i}/${tries - 1}) ${label}: ${mask(e.message).slice(0, 60)}\n`);
      try { client.close(); } catch {}
      await new Promise((r) => setTimeout(r, 1500 * i));
      client = await fresh();
    }
  }
}

/** rekurzívan összeszedi a távoli fájlokat */
async function walk(dir, acc = []) {
  const list = await withRetry((c) => c.list(dir), `lista ${dir}`);
  for (const e of list) {
    const p = posix.join(dir, e.name);
    if (e.isDirectory) await walk(p, acc);
    else if (!e.isSymbolicLink) acc.push({ path: p, size: e.size });
  }
  return acc;
}

console.log(`Távoli fa beolvasása: ${remoteRoot}`);
const files = await walk(remoteRoot);
const totalBytes = files.reduce((s, f) => s + f.size, 0);
console.log(`${files.length} fájl, ${(totalBytes / 1024 / 1024).toFixed(1)} MB\n`);

async function localOk(f) {
  const rel = f.path.startsWith(remoteRoot) ? f.path.slice(remoteRoot.length) : f.path;
  const dst = join(LOCAL, rel.replace(/^\/+/, ""));
  try { return { dst, ok: (await stat(dst)).size === f.size }; }
  catch { return { dst, ok: false }; }
}

if (mode === "push") {
  /* Feltöltés fájlonként: ami már fent van és stimmel a mérete, azt átugorja,
     hibánál újracsatlakozik. Így egy szakadás nem hagy félkész oldalt. */
  const { readdir } = await import("node:fs/promises");
  const SRC = join(ROOT, localName);

  async function walkLocalSync(dir, acc = []) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walkLocalSync(p, acc);
      else acc.push(p);
    }
    return acc;
  }
  const all = await walkLocalSync(SRC);

  // mi van már fent
  const remote = new Map();
  for (const f of files) remote.set(f.path, f.size);

  let up = 0, skip = 0; const bad = [];
  for (const abs of all) {
    const rel = abs.slice(SRC.length + 1).split(/[\\/]/).join("/");
    const dest = posix.join(remoteRoot, rel);
    const size = (await stat(abs)).size;
    if (remote.get(dest) === size) { skip++; continue; }
    try {
      await withRetry(async (c) => {
        await c.ensureDir(posix.dirname(dest));
        await c.cd(remoteRoot);
        await c.uploadFrom(abs, dest);
      }, dest);
      up++;
      process.stdout.write(`\r  feltöltve ${up}, kihagyva ${skip}, hiba ${bad.length}   `);
    } catch (e) {
      bad.push(`${rel} — ${mask(e.message).slice(0, 60)}`);
    }
  }
  console.log(`\nKész — feltöltve ${up}, már fent volt ${skip}, sikertelen ${bad.length}`);
  bad.forEach((b) => console.log("  " + b));

} else if (mode === "verify") {
  const missing = [];
  for (const f of files) { const { ok } = await localOk(f); if (!ok) missing.push(f.path); }
  console.log(missing.length ? `HIÁNYZIK ${missing.length} fájl:` : "Minden fájl megvan, a méretek stimmelnek.");
  missing.slice(0, 40).forEach((m) => console.log("  " + m));
  if (missing.length > 40) console.log(`  … és még ${missing.length - 40}`);
  await writeFile(join(ROOT, "backup-missing.txt"), missing.join("\n"), "utf8");
} else {
  let done = 0, skipped = 0, failed = [];
  for (const f of files) {
    const { dst, ok } = await localOk(f);
    if (ok) { skipped++; continue; }
    await mkdir(dirname(dst), { recursive: true });
    try {
      await withRetry((c) => c.downloadTo(dst, f.path), f.path);
      done++;
    } catch (e) {
      failed.push(f.path);
    }
    if ((done + skipped) % 100 === 0) {
      process.stdout.write(`\r  ${done + skipped}/${files.length}  (letöltve ${done}, kihagyva ${skipped}, hiba ${failed.length})`);
    }
  }
  console.log(`\nKész — letöltve ${done}, már megvolt ${skipped}, sikertelen ${failed.length}`);
  if (failed.length) {
    await writeFile(join(ROOT, "backup-missing.txt"), failed.join("\n"), "utf8");
    console.log("A sikertelenek listája: backup-missing.txt (futtasd újra a parancsot)");
  }
}
client.close();
