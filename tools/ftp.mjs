/**
 * FTP műveletek a Rackhost tárhelyhez.
 *
 * A hozzáférési adatokat a projekt mappáján KÍVÜL tárolt fájlból olvassa:
 *   C:\Users\<felhasználó>\.drglass-ftp.json
 * A szkript soha nem írja ki a jelszót, és a részletes naplózás ki van kapcsolva.
 *
 * Parancsok:
 *   node tools/ftp.mjs ls [útvonal]     – könyvtár tartalma
 *   node tools/ftp.mjs find-root        – megkeresi a domain webgyökerét
 *   node tools/ftp.mjs backup [útvonal] – letölti a távoli mappát ./backup-ftp/-be
 *   node tools/ftp.mjs upload           – feltölti a dist/rackhost/ tartalmát
 *   node tools/ftp.mjs rm <útvonal>...  – fájlt/mappát töröl (óvatosan!)
 */
import { Client } from "basic-ftp";
import { readFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CFG_PATH = join(homedir(), ".drglass-ftp.json");

async function loadConfig() {
  let raw;
  try {
    raw = await readFile(CFG_PATH, "utf8");
  } catch {
    console.error(`Nem találom a hozzáférési fájlt: ${CFG_PATH}`);
    process.exit(1);
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    console.error(`A hozzáférési fájl nem érvényes JSON (${CFG_PATH}). Hiba: ${e.message}`);
    process.exit(1);
  }
  // csak azt ellenőrizzük, hogy ki van-e töltve — az értéket nem írjuk ki
  for (const k of ["host", "user", "password"]) {
    if (!cfg[k] || String(cfg[k]).startsWith("IDE_")) {
      console.error(`Hiányzik vagy kitöltetlen: "${k}" a ${CFG_PATH} fájlban.`);
      process.exit(1);
    }
  }
  return cfg;
}

async function connect(cfg) {
  const client = new Client(30000);
  client.ftp.verbose = false; // hogy a jelszó ne kerülhessen a naplóba
  await client.access({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    secure: cfg.secure !== false,
    secureOptions: cfg.allowSelfSigned ? { rejectUnauthorized: false } : undefined,
  });
  return client;
}

const fmt = (e) =>
  `${e.isDirectory ? "d" : "-"} ${String(e.size).padStart(9)}  ${e.name}`;

const [cmd, ...args] = process.argv.slice(2);

const cfg = await loadConfig();
let client;
try {
  client = await connect(cfg);

  if (cmd === "ls") {
    const path = args[0] || cfg.remoteRoot || "/";
    console.log(`# ${path}`);
    for (const e of await client.list(path)) console.log(fmt(e));

  } else if (cmd === "find-root") {
    // megkeressük, hol van az index.php / index.html
    const candidates = ["/", "/web", "/public_html", "/www", "/httpdocs", "/htdocs"];
    for (const c of candidates) {
      try {
        const list = await client.list(c);
        const names = list.map((e) => e.name);
        const hit = names.some((n) => ["index.php", "index.html", "wp-config.php", "wp-content"].includes(n));
        console.log(`${hit ? "★" : " "} ${c.padEnd(14)} ${names.slice(0, 12).join(", ")}${names.length > 12 ? " …" : ""}`);
      } catch {
        console.log(`  ${c.padEnd(14)} (nem elérhető)`);
      }
    }

  } else if (cmd === "backup") {
    const path = args[0] || cfg.remoteRoot || "/";
    const dst = join(ROOT, "backup-ftp");
    await mkdir(dst, { recursive: true });
    console.log(`Letöltés: ${path}  ->  backup-ftp/`);
    client.trackProgress((i) => { if (i.name) process.stdout.write(`\r  ${i.name.slice(-60).padEnd(62)}`); });
    await client.downloadToDir(dst, path);
    client.trackProgress();
    console.log("\nkész");

  } else if (cmd === "upload") {
    const src = join(ROOT, "dist/rackhost");
    const path = cfg.remoteRoot || "/";
    console.log(`Feltöltés: dist/rackhost/  ->  ${path}`);
    client.trackProgress((i) => { if (i.name) process.stdout.write(`\r  ${i.name.slice(-60).padEnd(62)}`); });
    await client.uploadFromDir(src, path);
    client.trackProgress();
    console.log("\nkész");

  } else if (cmd === "rm") {
    if (!args.length) { console.error("Adj meg legalább egy útvonalat."); process.exit(1); }
    for (const p of args) {
      try {
        await client.remove(p);
        console.log(`fájl törölve: ${p}`);
      } catch {
        await client.removeDir(p);
        console.log(`mappa törölve: ${p}`);
      }
    }

  } else {
    console.log("Parancsok: ls [út] | find-root | backup [út] | upload | rm <út>...");
  }
} catch (e) {
  // a hibaüzenetből nem szivároghat ki a jelszó
  console.error("FTP hiba:", String(e.message || e).replace(cfg.password, "***"));
  process.exitCode = 1;
} finally {
  client?.close();
}
