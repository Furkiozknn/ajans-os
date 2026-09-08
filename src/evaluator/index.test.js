/**
 * Evaluator testleri (U9).
 *
 * Yol haritasinin iki bitti olcutu dogrudan olculur:
 *   - **ayni girdi 100 cagrida ayni sonuc** (determinizm; hem `gecerli_mi`
 *     hem `esigi_asti_mi`, hem de kanit sirasindan bagimsizlik);
 *   - **LLM metni `Kanit` yerine gecemiyor** (bilinmeyen tur, fazladan alan,
 *     yanlis tipli alan — ucu de istisna).
 *
 * Ayrica ADR-004'un uygulama notundaki test edilebilir olcut: bu modul
 * hicbir kardes modul (ozellikle Model Router) cagirmaz.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { degerlendirici, GECTI, KALDI, DEGERLENDIRILMEDI } from "./index.js";

const ev = degerlendirici();

const CIKIS_OK = { tur: "cikis_kodu", kod: 0 };
const CIKIS_HATA = { tur: "cikis_kodu", kod: 2 };
const SEMA_OK = { tur: "sema", sema: "task.schema.json", gecerli: true, hatalar: [] };
const SEMA_BOZUK = { tur: "sema", sema: "task.schema.json", gecerli: false, hatalar: ["a", "b"] };
const TEST_OK = { tur: "test", gecen: 70, kalan: 0 };
const TEST_KALAN = { tur: "test", gecen: 68, kalan: 2 };

test("mutlu yol: butun kanitlar olumluysa GECTI", () => {
  const r = ev.gecerli_mi([CIKIS_OK, SEMA_OK, TEST_OK]);
  assert.equal(r.sonuc, GECTI);
  assert.equal(r.gecti, true);
  assert.equal(r.kanitlar.length, 3);
});

test("tek olumsuz kanit butun sonucu KALDI yapar", () => {
  const r = ev.gecerli_mi([CIKIS_OK, SEMA_BOZUK, TEST_OK]);
  assert.equal(r.sonuc, KALDI);
  assert.equal(r.gecti, false);
  assert.match(r.aciklama, /2 hata/);
});

test("KALDI, DEGERLENDIRILMEDI'yi bastirir", () => {
  const r = ev.gecerli_mi([{ tur: "olcum", ad: "kapsam", deger: 0.4 }, TEST_KALAN]);
  assert.equal(r.sonuc, KALDI);
});

test("kanit yoksa GECTI de KALDI da degil: DEGERLENDIRILMEDI (D11)", () => {
  const r = ev.gecerli_mi([]);
  assert.equal(r.sonuc, DEGERLENDIRILMEDI);
  assert.equal(r.gecti, false);
  assert.deepEqual(r.kanitlar, []);
  assert.match(r.aciklama, /insan kapisina/);
});

test("kosmamis test takimi GECTI sayilmaz", () => {
  const r = ev.gecerli_mi([{ tur: "test", gecen: 0, kalan: 0 }]);
  assert.equal(r.sonuc, DEGERLENDIRILMEDI);
});

test("esiksiz olcum tek basina karar veremez", () => {
  const r = ev.gecerli_mi([CIKIS_OK, { tur: "olcum", ad: "gecikme_ms", deger: 120 }]);
  assert.equal(r.sonuc, DEGERLENDIRILMEDI);
  assert.equal(r.gecti, false);
});

// --- LLM metni kanit yerine gecemiyor -------------------------------------

test("LLM yargisi kanit degildir: bilinmeyen tur istisna atar", () => {
  assert.throws(
    () => ev.gecerli_mi([{ tur: "llm_yargisi", metin: "bence gayet iyi olmus" }]),
    /bir kanit turu degil/,
  );
});

test("duz metin kanit degildir", () => {
  assert.throws(() => ev.gecerli_mi(["hepsi calisiyor gorunuyor"]), /nesne olmali/);
});

test("gecerli bir kanita ilistirilen LLM alani da reddedilir", () => {
  assert.throws(
    () => ev.gecerli_mi([{ ...SEMA_OK, llm_yorumu: "sema tam olmus" }]),
    /tanimsiz "llm_yorumu" alani/,
  );
});

test("dogruluk-benzeri (truthy) metin `gecerli` alanina giremez", () => {
  assert.throws(
    () => ev.gecerli_mi([{ tur: "sema", sema: "x", gecerli: "evet", hatalar: [] }]),
    /sema\.gecerli alani mantik olmali/,
  );
});

test("kanitlar dizi olmali", () => {
  assert.throws(() => ev.gecerli_mi(SEMA_OK), /dizi olmali/);
});

// --- esigi_asti_mi --------------------------------------------------------

test("esik alt sinirdir: esige esit deger gecer", () => {
  assert.equal(ev.esigi_asti_mi({ ad: "kapsam", deger: 0.8 }, 0.8).sonuc, GECTI);
  assert.equal(ev.esigi_asti_mi({ ad: "kapsam", deger: 0.79 }, 0.8).sonuc, KALDI);
});

test("esik sonucu tek kanitla doner", () => {
  const r = ev.esigi_asti_mi({ ad: "kapsam", deger: 0.9 }, 0.8);
  assert.deepEqual(r.kanitlar, [{ tur: "olcum", ad: "kapsam", deger: 0.9 }]);
  assert.match(r.aciklama, /kapsam = 0\.9 >= esik 0\.8/);
});

test("virgullu metin deger ayristirilmaz, reddedilir (TUZAK #4)", () => {
  assert.throws(() => ev.esigi_asti_mi({ ad: "kapsam", deger: "0,5742" }, 0.5), /sayi olmali/);
  assert.throws(() => ev.esigi_asti_mi({ ad: "kapsam", deger: 0.9 }, "0,8"), /esik sonlu bir sayi/);
});

test("NaN sessizce KALDI'ya dusmez, istisna atar", () => {
  assert.throws(() => ev.esigi_asti_mi({ ad: "kapsam", deger: NaN }, 0.8), /sayi olmali/);
});

// --- determinizm ----------------------------------------------------------

test("ayni girdi 100 cagrida ayni sonuc", () => {
  const girdi = [CIKIS_OK, SEMA_BOZUK, TEST_OK, { tur: "olcum", ad: "gecikme_ms", deger: 120 }];
  const ilk = ev.gecerli_mi(girdi);
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(ev.gecerli_mi(girdi), ilk);
    assert.deepEqual(degerlendirici().gecerli_mi(girdi), ilk);
  }

  const esikIlk = ev.esigi_asti_mi({ ad: "kapsam", deger: 0.8 }, 0.8);
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(ev.esigi_asti_mi({ ad: "kapsam", deger: 0.8 }, 0.8), esikIlk);
  }
});

test("sonuc kanit sirasindan bagimsiz", () => {
  const a = ev.gecerli_mi([CIKIS_OK, SEMA_BOZUK, TEST_OK]);
  const b = ev.gecerli_mi([TEST_OK, SEMA_BOZUK, CIKIS_OK]);
  assert.equal(a.sonuc, b.sonuc);
  assert.equal(a.kanitlar.length, b.kanitlar.length);
});

test("`gecti` ile `sonuc` hicbir yolda ayrisamaz", () => {
  const hepsi = [
    ev.gecerli_mi([]),
    ev.gecerli_mi([CIKIS_OK]),
    ev.gecerli_mi([CIKIS_HATA]),
    ev.gecerli_mi([{ tur: "test", gecen: 0, kalan: 0 }]),
    ev.esigi_asti_mi({ ad: "x", deger: 1 }, 0),
    ev.esigi_asti_mi({ ad: "x", deger: 0 }, 1),
  ];
  for (const r of hepsi) assert.equal(r.gecti, r.sonuc === GECTI);
});

test("donen kanitlar cagirani etkilemiyor: girdi dizisi degismedi", () => {
  const girdi = [CIKIS_OK, TEST_OK];
  const r = ev.gecerli_mi(girdi);
  r.kanitlar.push(SEMA_BOZUK);
  assert.equal(girdi.length, 2);
});

// --- ADR-004 uygulama notu ------------------------------------------------

test("modul hicbir kardes modul cagirmiyor (Model Router dahil)", () => {
  const kaynak = readFileSync(fileURLToPath(new URL("./index.js", import.meta.url)), "utf8");
  const disariIthal = [...kaynak.matchAll(/(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((y) => y.startsWith("."));
  assert.deepEqual(disariIthal, [], `modul disari acildi: ${disariIthal.join(", ")}`);
  // Determinizmin kaynak duzeyinde karsiligi: saat ve rastgelelik yok.
  assert.doesNotMatch(kaynak, /Math\.random|Date\.now|new Date/);
});
