/** Végigpróbálja a lehetséges FTP-beállításokat, és megmondja, melyik működik. */
import { Client } from "basic-ftp";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const cfg = JSON.parse(await readFile(join(homedir(), ".drglass-ftp.json"), "utf8"));
const mask = (s) => String(s).replace(cfg.password, "***");

const variants = [
  { label: "FTPS (explicit, TLS ellenőrzéssel)", secure: true,  self: false },
  { label: "FTPS (explicit, TLS ellenőrzés nélkül)", secure: true,  self: true },
  { label: "sima FTP (titkosítatlan)",           secure: false, self: false },
];

for (const v of variants) {
  const c = new Client(12000);
  c.ftp.verbose = false;
  try {
    await c.access({
      host: cfg.host, user: cfg.user, password: cfg.password,
      secure: v.secure,
      secureOptions: v.self ? { rejectUnauthorized: false } : undefined,
    });
    const pwd = await c.pwd();
    const names = (await c.list("/")).map(e => (e.isDirectory ? e.name + "/" : e.name));
    console.log(`OK  ${v.label}`);
    console.log(`    belépési könyvtár: ${pwd}`);
    console.log(`    gyökér tartalma:   ${names.join("  ")}`);
    c.close();
    process.exit(0);
  } catch (e) {
    console.log(`--  ${v.label}  ->  ${mask(e.message || e).slice(0, 110)}`);
    c.close();
  }
}
console.log("\nEgyik sem jött össze.");
