/**
 * Minimális, függőség nélküli ZIP-készítő.
 * Azért kell, mert a gépen nincs `zip`, a Windows Compress-Archive pedig
 * fordított perjelet ír a bejegyzésnevekbe, amit sok kicsomagoló elront.
 *
 * Futtatás:  node tools/make-zip.mjs <forrásmappa> <cél.zip>
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const [srcDir, outFile] = process.argv.slice(2);
if (!srcDir || !outFile) {
  console.error("Használat: node tools/make-zip.mjs <forrásmappa> <cél.zip>");
  process.exit(1);
}

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, base)));
    else out.push({ abs: p, name: p.slice(base.length + 1).split(sep).join("/") });
  }
  return out;
}

function dosTime(d) {
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xffff;
  const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { time, date };
}

const files = (await walk(srcDir)).sort((a, b) => a.name.localeCompare(b.name));
const chunks = [];
const central = [];
let offset = 0;

for (const f of files) {
  const data = await readFile(f.abs);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const { time, date } = dosTime((await stat(f.abs)).mtime);
  const name = Buffer.from(f.name, "utf8");

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);   // aláírás
  local.writeUInt16LE(20, 4);           // szükséges verzió
  local.writeUInt16LE(0, 6);            // jelzők
  local.writeUInt16LE(8, 8);            // deflate
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);           // extra hossz

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);              // készítő verzió
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt16LE(time, 12);
  cd.writeUInt16LE(date, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(comp.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt32LE(offset, 42);         // helyi fejléc pozíciója

  chunks.push(local, name, comp);
  central.push(cd, name);
  offset += local.length + name.length + comp.length;
}

const cdBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cdBuf.length, 12);
eocd.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...chunks, cdBuf, eocd]);
await writeFile(outFile, zip);
console.log(`${outFile} — ${files.length} fájl, ${(zip.length / 1024 / 1024).toFixed(2)} MB`);
