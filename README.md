# Dr.Glass — új weboldal

A [dr-glass.eu](https://dr-glass.eu/) (WordPress) oldal teljes újraépítése statikus,
függőség nélküli HTML/CSS/JS oldalként. Minden szöveg, ár és fotó a meglévő oldalról
származik — a magyar és a szlovák verzióból egyaránt.

---

## Fájlszerkezet

```
index.html                 egyoldalas (one-page) oldal, minden szekcióval
assets/css/style.css       teljes dizájnrendszer (design tokenek + komponensek)
assets/js/i18n.js          HU / SK szótár — ITT lehet szöveget és árat írni
assets/js/main.js          nyelvváltó, menü, előtte/utána csúszka, szűrő, űrlap
assets/img/                a régi oldalról letöltött fotók (.jpg = eredeti, .webp = használt)
assets/img/ba/             előtte/utána képpárok
assets/img/partners/       javítórendszerek logói
robots.txt, sitemap.xml    SEO
tools/optimize-images.mjs  JPG/PNG → WebP konvertáló szkript
```

## Melyik fotó melyik telephely

A régi oldalon a fájlnevek félrevezetők voltak, ezért át lettek nevezve:

| Fájl | Mi van rajta | Hol használjuk |
|---|---|---|
| `site-esztergom.*` | piros banner a telefonszámmal, mögötte az OMV kút | Kapcsolat – **Esztergom** kártya, OG-kép |
| `site-sturovo.*` | szlovák feliratos telephely (`OPRAVA ČELNÉHO SKLA`) | Kapcsolat – **Štúrovo** kártya |
| `site-sturovo-tent.*` | piros sátor nappal, szlovák felirat + 0950-es szám | CTA-sáv elmosott háttere |
| `tent-night.*` | ugyanaz a sátor este, kivilágítva | hero háttér |

## Helyi futtatás

```bash
npx -y serve -l 4321 .
```

Utána: <http://localhost:4321>

## Élő előnézet

**<https://demo.dr-glass.eu/>**

GitHub Pages szolgálja ki a `main` ág gyökeréből, saját aldoménen, HTTPS-sel.
Bárki megnyithatja, akinek elküldöd a linket — nem kell hozzá bejelentkezés.

A régi `velunamed.github.io/dr-glass-demo/` cím 301-gyel ide irányít át.

A `demo` egy CNAME rekord a dns24.hu-n, ami a `velunamed.github.io`-ra mutat.
A repó gyökerében lévő `CNAME` fájl tartja meg a beállítást — **ne töröld**.
Az éles `dr-glass.eu`-t (A rekord: 91.227.139.59) ez nem érinti.

Frissítés: elég pusholni, a Pages 1–2 percen belül újraépíti.

```bash
git add -A && git commit -m "..." && git push
```

Az `index.html` `canonical` hivatkozása a `dr-glass.eu`-ra mutat, így a keresők a
demót nem indexelik az éles oldal helyett.

## Egyfájlos előnézet (offline / csatolmányként)

```bash
node tools/build-standalone.mjs
```

Ez legyárt egy `dist/preview.html` fájlt, amiben **minden benne van**: a CSS, a JS
és az összes kép base64 data URI-ként. Nulla külső kérés (a Google Fonts kivételével),
így bárhová feltölthető vagy elküldhető egyetlen fájlként.

Az előnézethez a képek 1400 px szélességre és 78-as WebP-minőségre vannak
tömörítve — a `dist/` így ~2,5 MB, míg az éles `assets/` a teljes minőségű
képeket tartalmazza.

Van egy privát, claude.ai-n hosztolt változat is:
<https://claude.ai/code/artifact/b3ccdaae-a427-4a39-86e0-a8b1e42da5c8>

> A beágyazott előnézetben a `tel:` és `mailto:` linkek nem feltétlenül indulnak el
> (a nézegető keretrendszere blokkolhatja) — az éles domainen működni fognak.

## Élesítés a Rackhost tárhelyen

A domain, a DNS, az e-mail (`mx05.rackhost.hu`) és a HTTPS **marad, ahogy van** —
csak a tárhelyen cseréljük a WordPress-t a statikus fájlokra.

```bash
node tools/build-rackhost.mjs
node tools/make-zip.mjs dist/rackhost dist/dr-glass-rackhost.zip
```

Ez legyárt egy `dist/dr-glass-rackhost.zip` fájlt (41 fájl, ~2,7 MB), amiben pontosan
az van, ami az éles oldalhoz kell: `index.html`, `assets/`, `robots.txt`,
`sitemap.xml` és a `.htaccess`. A `.jpg` eredetik, a `tools/`, a `node_modules/`
és a GitHub Pages `CNAME` fájlja **nincs** benne.

A csomagot a domain webgyökerébe kell kicsomagolni, a WordPress fájlok helyére.
A `deploy/htaccess` intézi:

- az `index.html` legyen az alapértelmezett (a WP `index.php` helyett),
- a régi WordPress címek 301-es átirányítását az új szekció-horgonyokra
  (`/about/` → `/#rolunk`, `/sk/` → `/?lang=sk`, stb.),
- a tömörítést és a böngésző-gyorsítótárat.

> Ha a feltöltés után **500-as hibát** kapsz, nevezd át az `.htaccess`-t
> `htaccess.txt`-re: az oldal működni fog, csak az átirányítások maradnak el.

## Kiadás máshová

Az oldal statikus, nem kell szerveroldali futtatókörnyezet:

- **Vercel / Netlify / Cloudflare Pages:** húzd be a mappát, build parancs nem kell.
- **GitHub Pages:** már fut, lásd az „Élő előnézet" részt.

A `node_modules/`, `package.json`, `tools/`, `deploy/` és a `.jpg` eredetik **nem
kellenek** az éles kiadáshoz — csak a fejlesztéshez.

---

## Mi került bele a régi oldalról

| Régi oldal | Hova került |
|---|---|
| Kezdőlap – 3 szolgáltatás leírása | „Szolgáltatásaink" szekció |
| Rólunk – „2016 óta…" szöveg | „Kik vagyunk?" szekció (szó szerint) |
| Árlista (STANDARD / PRÉMIUM / FÉNYSZÓRÓ) | „Árlista" szekció (szó szerint, HU + SK) |
| Flotta 9.500 Ft / repedés 600 Ft/cm / ózon 6.000 Ft | Árlista alatti kiemelt dobozok |
| Kapcsolat – 2 telefonszám, e-mail, 2 cím | „Kapcsolat" szekció + lábléc |
| Facebook / Instagram / TikTok linkek | Lábléc |
| HU / SK nyelvváltás (TranslatePress) | Beépített HU/SK kapcsoló, `assets/js/i18n.js` |
| Munkáink (Facebook link) | Interaktív előtte/utána galéria + FB gomb |
| Ultra Bond / Delta Kits / Glass Mechanix / GRS / GlasWeld logók | „Javítórendszerek" sáv |

## Fényszóró felújítás szekció (`#felujitas`)

A műhelyben lévő krétatáblák alapján készült, külön szekcióként. Tartalma:

- Kiemelt figyelmeztetés: **felújításhoz (kemencés + oldószeres) kiszerelt fényszóró kell**,
  kivétel a polírozás, amit az autóra szerelt lámpán is elvégeztek.
- A két ragasztótípus magyarázata (puha/butil vs. kemény/Permaseal).
- Munkadíj-táblázat 1 db kiszerelt fényszóróra, HU-ban Ft-ban, SK-ban euróban.
- Két fotó az ipari kemencéről.

### Fotók

A fényszórós előtte/utána képek és a kemencés fotók a chaten érkeztek, és be vannak
téve. Ezek `data-optional` jelölést kaptak: **ha egy fájl hiányzik, a kártya magától
eltűnik** (nem lesz törött kép), és ha egy galéria-kategória kiürül, a hozzá tartozó
szűrőgomb is elrejtőzik.

**Fényszóró-polírozás előtte/utána — `assets/img/ba/`**

| Fájl | Mi van rajta |
|---|---|
| `mercedes-before.webp` / `mercedes-after.webp` | Mercedes, besárgult kerek fényszóró → kipolírozva |
| `landrover-before.webp` / `landrover-after.webp` | Land Rover, bepárásodott lencse → kitisztítva |
| `passat-before.webp` / `passat-after.webp` | fekete VW, besárgult fényszóró → kipolírozva |

Ezek **külön előtte/utána fájlok** (nem összeragasztott képpár) – a csúszka
`data-split="pair"` módban fut, 4:3-as vágással. A korábbi, összeragasztott
fényszórós képek (`ba/light-1…3.jpg` + `.webp`) a mappában maradtak, ha vissza
kellene őket tenni.

**Kemencés fotók — `assets/img/`**

| Fájl | Mi van rajta |
|---|---|
| `oven.webp` | a sárga ajtós ipari kemence |
| `oven-headlight.webp` | kiszerelt fényszóró a kemencében |

Álló fotók, ezért a `.fx-shot img` `object-position: center 42%` beállítással vágja
őket 4:3-ra, hogy a tárgy a képen maradjon.

Ha új fotót teszel be, futtasd le a WebP-konvertálást:

```bash
node tools/optimize-images.mjs
```

## Ami új

- **Interaktív előtte/utána csúszka** – a régi oldalon a képpárok statikus
  „összeragasztott" fotók voltak; itt egy húzható osztóvonal mutatja a különbséget.
  A CSS a képet félbevágva jeleníti meg, így nem kellett új képeket vágni.
- **Galéria szűrő** (Mind / Szélvédő / Fényszóró / Ózon).
- **GY.I.K. szekció** – 7 kérdés-válasz. Ez az egyetlen rész, ami nem a régi
  oldalról származik, hanem a szolgáltatás alapján íródott. **Kérlek olvasd át**,
  és javítsd, ha valamit másképp csináltok.
- **Folyamat („Hogyan zajlik") szekció** – 4 lépés.
- **Kapcsolati űrlap** – statikus oldalon nincs backend, ezért az űrlap a kitöltött
  adatokból egy előre megírt e-mailt nyit meg (`info@dr-glass.eu`).
  Ha inkább igazi űrlapküldést szeretnél, a `main.js` 7. blokkját kell egy
  Formspree / Web3Forms / Netlify Forms végpontra cserélni.
- **Mobil hívássáv** – a képernyő alján mindig ott a HU / SK hívás gomb.
- **SEO**: `LocalBusiness (AutoRepair)` strukturált adat mindkét telephellyel,
  OG-képek, hreflang, sitemap, robots.
- **Sebesség**: a fotók WebP-be konvertálva — 6,0 MB → 1,6 MB.

---

## Ellenőrizendő adatok

Ezeket **nem** a régi weboldal szövegéből, hanem a fotókon látható tábláitokról
olvastam ki — nézd át, mielőtt élesítjük:

1. **Kiszállás: csak több autó (flotta) esetén** – megerősítve, 2026-08-23.
   Egyetlen autóhoz nincs kiszállás, azt a telephelyen javítják. Ezért az oldalon
   a „kiszállás" mindenhol a flottához van kötve (`proc2.p`, `ab3.*`, `note1.p`, `a6`);
   a hero badge-ből teljesen ki lett szedve. A műhelyi banneren szereplő „MOBIL SZÉLVÉDŐ JAVÍTÁS" feliratot
   szándékosan nem használjuk általános ígéretként.
2. **Nyitvatartás: Hétfő–Szombat, 9:00–20:00.**
   Forrás: az OMV-nél lévő banner („09:00–20:00, IDŐPONT EGYEZTETÉS UTÁN") és a
   štúrovói sátor felirata („Hétfő–Szombat / Pondelok–Sobota").
   Ha ez már nem aktuális: `assets/js/i18n.js` → `hero.meta1`, `ct.hoursV`, `a5`,
   és az `index.html` végén a JSON-LD `openingHoursSpecification`.
3. **A HU és SK árak nincsenek átváltva egymásba** — mindkettő pontosan a saját
   nyelvi oldalatokról származik (pl. fényszóró: 16.000 Ft, ill. 40 €).
4. **Ütközik a fényszóró-polírozás ára.** A régi weboldalon **16.000 Ft / 40 €**
   szerepel (mélypolírozás + UV: 24.000 Ft / 60 €), a műhelyi táblán viszont
   **1 db 35 € · 2 db 60 €** (Ft-ban 14.000 / 24.000). Az oldalon egyelőre a
   **weboldalas ár** maradt, hogy ne legyen két ellentmondó szám. Szólj, melyik az
   érvényes, és egy perc alatt átírom (`pr3.amount`, `pr3.cur`, `pr3.f1`, `srv2.price`).
5. **A puha/butil szétszedés forintos alsó határa (10.000 Ft) számított érték.**
   A képernyőképen ez a szám le volt vágva; a 25 €-t a többi sornál használt
   400 Ft/€ árfolyammal váltottam át. Ha más a helyes ár: `fx.p1`.
6. **Cégadatok** (cégnév, adószám, székhely, ÁSZF, adatkezelési tájékoztató) a régi
   oldalon sem szerepeltek. Webshop nincs, de a kapcsolati űrlap miatt egy rövid
   adatkezelési tájékoztató ajánlott.

## Szöveg / ár módosítása

Minden szöveg egy helyen van: `assets/js/i18n.js`.
A `hu` és az `sk` blokkban ugyanazok a kulcsok szerepelnek — ha az egyikbe új kulcsot
teszel, tedd bele a másikba is. A HTML-ben a `data-i18n="kulcs"` attribútum köti össze
a kettőt.

Példa – a standard szélvédőjavítás alapárának módosítása:

```js
"pr1.amount": "14.000",   // hu blokk
"pr1.amount": "35",       // sk blokk
```

## Képek újrakonvertálása

Ha új fotót teszel az `assets/img/` mappába:

```bash
npm install
node tools/optimize-images.mjs
```
