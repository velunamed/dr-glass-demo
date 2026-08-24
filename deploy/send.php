<?php
/**
 * Dr.Glass – kapcsolati űrlap feldolgozó.
 *
 * A weboldal gyökerébe kerül send.php néven. JSON-t ad vissza, hogy az
 * oldal helyben tudja megjeleníteni az eredményt, újratöltés nélkül.
 *
 * Ha ez a fájl nincs a szerveren (pl. a GitHub Pages előnézetben), az
 * űrlap automatikusan visszaesik a levelezőprogram megnyitására.
 */

declare(strict_types=1);

const CIMZETT   = 'info@dr-glass.eu';
const FELADO    = 'info@dr-glass.eu';   // a saját domainünk – enélkül a levél spam lenne
const MAX_HOSSZ = 5000;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function valasz(int $kod, string $allapot, string $uzenet = ''): void {
    http_response_code($kod);
    echo json_encode(['status' => $allapot, 'message' => $uzenet], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Fejlécbe kerülő értékből kiszedi a sortörést – e-mail fejléc-injektálás ellen. */
function tisztit(string $s): string {
    return trim(str_replace(["\r", "\n", "\0", '%0a', '%0d'], ' ', $s));
}

function mezo(string $nev, int $maxHossz = 200): string {
    $ertek = isset($_POST[$nev]) && is_string($_POST[$nev]) ? $_POST[$nev] : '';
    return mb_substr(trim($ertek), 0, $maxHossz);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    valasz(405, 'error', 'Csak POST kérés fogadható.');
}

// Csapda mező: ember nem tölti ki, mert nem látja. Ha ki van töltve, robot.
if (mezo('website') !== '') {
    valasz(200, 'ok');   // a robot azt hiszi, sikerült
}

$nev      = mezo('name', 120);
$email    = mezo('email', 200);
$telefon  = mezo('phone', 60);
$szolg    = mezo('service', 120);
$uzenet   = mb_substr(trim((string)($_POST['message'] ?? '')), 0, MAX_HOSSZ);

if ($nev === '' || $email === '') {
    valasz(422, 'error', 'A név és az e-mail cím megadása kötelező.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    valasz(422, 'error', 'Az e-mail cím formátuma nem megfelelő.');
}

$nev     = tisztit($nev);
$email   = tisztit($email);
$telefon = tisztit($telefon);
$szolg   = tisztit($szolg);

$targy = '=?UTF-8?B?' . base64_encode('Ajánlatkérés a weboldalról – ' . $nev) . '?=';

$torzs = implode("\n", [
    'Név:            ' . $nev,
    'E-mail:         ' . $email,
    'Telefon:        ' . ($telefon !== '' ? $telefon : '—'),
    'Szolgáltatás:   ' . ($szolg !== '' ? $szolg : '—'),
    '',
    'Leírás:',
    $uzenet !== '' ? $uzenet : '—',
    '',
    str_repeat('-', 46),
    'Küldve: ' . date('Y-m-d H:i:s'),
    'IP:     ' . ($_SERVER['REMOTE_ADDR'] ?? '?'),
]);

$fejlecek = implode("\r\n", [
    'From: Dr.Glass weboldal <' . FELADO . '>',
    'Reply-To: ' . $nev . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'MIME-Version: 1.0',
    'X-Mailer: dr-glass.eu',
]);

$sikeres = @mail(CIMZETT, $targy, $torzs, $fejlecek, '-f' . FELADO);

if ($sikeres) {
    valasz(200, 'ok');
}
valasz(500, 'error', 'A levél küldése nem sikerült.');
