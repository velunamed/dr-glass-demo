/**
 * Egyszer használatos küldő PHP-t gyárt az üdvözlő levélhez.
 *
 * A HTML és a sima szöveges változat bele van ágyazva, tehát egyetlen fájlt
 * kell feltölteni. Tokennel védett, és sikeres küldés után törli magát —
 * így nem marad a szerveren olyan végpont, amivel bárki levelet küldhetne.
 *
 * Futtatás:  node tools/build-mailer.mjs
 * Eredmény:  dist/mailer/send-welcome.php  (a token a kimeneten jelenik meg)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist/mailer");
await mkdir(OUT, { recursive: true });

const html = await readFile(join(ROOT, "deploy/welcome-email.html"), "utf8");
let txt = await readFile(join(ROOT, "deploy/welcome-email.txt"), "utf8");

// a .txt első sora a tárgy — az nem a levéltörzs része
const targySor = txt.match(/^Tárgy:\s*(.+)$/m);
const targy = targySor ? targySor[1].trim() : "Elkészült az új dr-glass.eu";
txt = txt.replace(/^Tárgy:.*\r?\n\r?\n?/, "");

const token = randomBytes(24).toString("hex");

// nowdoc határolók: olyan sztringek, amik biztosan nem szerepelnek a tartalomban
const H = "DRGLASS_HTML_" + randomBytes(4).toString("hex");
const T = "DRGLASS_TEXT_" + randomBytes(4).toString("hex");
for (const [d, s] of [[H, html], [T, txt]]) {
  if (s.includes(d)) throw new Error("határoló ütközés: " + d);
}

const php = `<?php
/**
 * Egyszer használatos küldő. Sikeres küldés után törli magát.
 * Hívás:  POST send-welcome.php   mezővel: token=<token>
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

const TOKEN   = ${JSON.stringify(token)};
const CIMZETT = 'info@dr-glass.eu';
const FELADO  = 'info@dr-glass.eu';
const TARGY   = ${JSON.stringify(targy)};

function valasz(int $kod, array $adat): void {
    http_response_code($kod);
    echo json_encode($adat, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    valasz(405, ['status' => 'error', 'message' => 'Csak POST.']);
}
if (!hash_equals(TOKEN, (string)($_POST['token'] ?? ''))) {
    valasz(403, ['status' => 'error', 'message' => 'Érvénytelen token.']);
}

$html = <<<'${H}'
${html}
${H};

$szoveg = <<<'${T}'
${txt}
${T};

$hatar = '=_' . bin2hex(random_bytes(12));

$fejlecek = implode("\\r\\n", [
    'From: Dr.Glass <' . FELADO . '>',
    'Reply-To: ' . FELADO,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' . $hatar . '"',
    'X-Mailer: dr-glass.eu',
]);

$torzs =
    "--$hatar\\r\\n" .
    "Content-Type: text/plain; charset=UTF-8\\r\\n" .
    "Content-Transfer-Encoding: 8bit\\r\\n\\r\\n" .
    $szoveg . "\\r\\n" .
    "--$hatar\\r\\n" .
    "Content-Type: text/html; charset=UTF-8\\r\\n" .
    "Content-Transfer-Encoding: 8bit\\r\\n\\r\\n" .
    $html . "\\r\\n" .
    "--$hatar--\\r\\n";

$targyKodolt = '=?UTF-8?B?' . base64_encode(TARGY) . '?=';

$ok = @mail(CIMZETT, $targyKodolt, $torzs, $fejlecek, '-f' . FELADO);

if ($ok) {
    $torolve = @unlink(__FILE__);   // egyszer használatos: magát törli
    valasz(200, [
        'status'    => 'ok',
        'cimzett'   => CIMZETT,
        'targy'     => TARGY,
        'onTorles'  => $torolve ? 'sikeres' : 'NEM sikerult - kezzel torold!',
    ]);
}
valasz(500, ['status' => 'error', 'message' => 'A levél küldése nem sikerült.']);
`;

await writeFile(join(OUT, "send-welcome.php"), php, "utf8");
console.log("dist/mailer/send-welcome.php elkészült");
console.log("tárgy:  " + targy);
console.log("token:  " + token);
