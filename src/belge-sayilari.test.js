/**
 * README'deki sayilar diskle ayni mi? (modul, ADR, sema, kaynak satiri)
 *
 * NEDEN. Gunluk ekosistem denetimi (Furkiozknn/Furkiozknn #19) her gun ayni sinifi
 * buluyor: belge bir sayi soyluyor, kod baska bir sey. Sayi README'ye elle yazilir ama
 * buradan diskle karsilastirilir; ayrisirsa test hangi sayinin ne olmasi gerektigini
 * soyler. Test sayisi burada YOK: bir test kendi sayisini sayamaz; onu .github/workflows/
 * ci.yml'deki "Test sayisi README ve project-meta ile ayni mi" adimi kosudan dogrular.
 *
 * Kaynak satiri ~yuvarlak bir sayi; %2 icinde olmasi yeter (her satir eklenişinde
 * README'yi degistirmeye zorlamaz, ama sessiz kayma yakalanir).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(KOK, "src");

/** src/ altindaki test olmayan .js dosyalarinin satir sayisi (`wc -l` gibi: satir sonu sayisi). */
function kaynakSatiri(dizin) {
  let toplam = 0;
  for (const e of readdirSync(dizin, { withFileTypes: true })) {
    const yol = join(dizin, e.name);
    if (e.isDirectory()) toplam += kaynakSatiri(yol);
    else if (e.name.endsWith(".js") && !e.name.endsWith(".test.js")) {
      toplam += (readFileSync(yol, "utf8").match(/\n/g) || []).length;
    }
  }
  return toplam;
}

test("README'deki modul, ADR, sema ve kaynak satiri sayilari diskle ayni", () => {
  const readme = readFileSync(join(KOK, "README.md"), "utf8");
  const disk = {
    "modül": readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory()).length,
    ADR: readdirSync(join(KOK, "docs", "adr")).filter((f) => /^ADR-\d{3}-.+\.md$/.test(f)).length,
    "şema": readdirSync(join(KOK, "contracts")).filter((f) => f.endsWith(".schema.json")).length,
  };

  for (const [ad, sayi] of Object.entries(disk)) {
    // \b Türkçe harfte (ü, ş) sınır saymaz; sonraki karakterin harf olmamasına bakılır.
    const anilan = [...readme.matchAll(new RegExp(`(\\d+) ${ad}(?!\\p{L})`, "gu"))].map((m) => Number(m[1]));
    assert.ok(anilan.length > 0, `README "${sayi} ${ad}" demeli (hic gecmiyor)`);
    for (const n of anilan) assert.equal(n, sayi, `README "${n} ${ad}" diyor, diskte ${sayi} var`);
  }

  const satir = kaynakSatiri(SRC);
  const beyan = readme.match(/~([\d.]+) satır/);
  assert.ok(beyan, 'README "~N satır" demeli (kaynak satırı, test dosyaları hariç)');
  const yazilan = Number(beyan[1].replace(/\./g, ""));
  assert.ok(
    Math.abs(yazilan - satir) / satir <= 0.02,
    `README ~${yazilan} satır diyor, diskte ${satir} var (en çok %2 sapma kabul)`,
  );
});

test("README'nin komutlari ve yerel baglantilari gercekten var", () => {
  const readme = readFileSync(join(KOK, "README.md"), "utf8");
  const betikler = JSON.parse(readFileSync(join(KOK, "package.json"), "utf8")).scripts;

  const npmKomutlari = [...readme.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
  assert.ok(npmKomutlari.includes("kapi"), "README'nin tek komutu `npm run kapi` olmali");
  for (const ad of npmKomutlari) assert.ok(ad in betikler, `README "npm run ${ad}" diyor, package.json'da yok`);

  for (const m of readme.matchAll(/node (?:--test )?((?:arac|src|docs)\/[\w./-]+\.js)/g)) {
    assert.ok(existsSync(join(KOK, m[1])), `README "node ${m[1]}" diyor, dosya yok`);
  }

  // [metin](yol) ve href="yol" / src="yol": yerel olanlar diskte olmali (http ve #bolum atlanir).
  for (const m of readme.matchAll(/\]\(([^)\s]+)\)|(?:href|src)="([^"]+)"/g)) {
    const yol = (m[1] || m[2]).split("#")[0];
    if (!yol || /^(https?:|mailto:)/.test(yol)) continue;
    assert.ok(existsSync(join(KOK, decodeURIComponent(yol))), `README baglantisi diskte yok: ${yol}`);
  }
});
