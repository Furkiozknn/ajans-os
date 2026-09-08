/**
 * U6 kabul testleri — Context Manager.
 *
 * Olcut mutlu yol degil, blueprint §2.7'nin iki kisiti:
 *   1. atilan parcalarin **sirasi** onceden yazili `kisilma_sirasi` ile
 *      birebir — ve sira calisma aninda degistirilemez,
 *   2. esik %100'un altindadir; kisilamaz parcalar tavani asiyorsa modul
 *      sessizce tasan bir butce dondurmez, istisna atar.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { baglamYoneticisi } from "./index.js";

/** Tavan = 1000 * 0.9 = 900; kullanilan 1300 → 400 token fazla. */
const ASIRI = {
  toplam: 1000,
  sistem_sozlesmesi: 200,
  gorev_durumu: 300,
  bilgi: 500,
  sorgu: 200,
  tampon: 100,
};

test("esik altinda kalan butce kisilmaz", () => {
  const cm = baglamYoneticisi();
  const s = cm.butcele({
    toplam: 1000, sistem_sozlesmesi: 100, gorev_durumu: 100,
    bilgi: 100, sorgu: 50, tampon: 100,
  });
  assert.equal(s.asildi_mi, false);
  assert.deepEqual(s.kisilanlar, []);
  assert.equal(s.kalan, 1000 - 450);
});

test("asildiginda kisilan parcalarin sirasi kisilma_sirasi ile birebir", () => {
  const cm = baglamYoneticisi();
  const s = cm.butcele(ASIRI);

  assert.equal(s.asildi_mi, true);
  // 400 fazla: once `bilgi` (500'un 400'u), sonrakilere sira gelmez.
  assert.deepEqual(s.kisilanlar, [{ parca: "bilgi", kisilan_token: 400 }]);
  assert.deepEqual(
    s.kisilanlar.map((k) => k.parca),
    cm.kisilma_sirasi.filter((p) => s.kisilanlar.some((k) => k.parca === p)),
  );
  assert.equal(s.bilesenler.bilgi, 100);
  assert.equal(s.bilesenler.gorev_durumu, 300); // sirasi gelmedi, dokunulmadi
  assert.equal(s.kalan, 100); // kullanilan tam tavana indi: 1000 - 900
});

test("fazla tek parcayi asarsa sonraki parcalara **sirayla** tasar", () => {
  const cm = baglamYoneticisi();
  // Tavan 900, kullanilan 1600 → 700 fazla. bilgi(300) + gorev_durumu(400).
  const s = cm.butcele({
    toplam: 1000, sistem_sozlesmesi: 200, gorev_durumu: 700,
    bilgi: 300, sorgu: 300, tampon: 100,
  });
  assert.deepEqual(s.kisilanlar, [
    { parca: "bilgi", kisilan_token: 300 },
    { parca: "gorev_durumu", kisilan_token: 400 },
  ]);
  assert.equal(s.bilesenler.sorgu, 300); // sirada sonuncuydu, sira gelmedi
});

test("kisilma sirasi kurulusta verilir; verilen sira aynen uygulanir", () => {
  const cm = baglamYoneticisi({ kisilma_sirasi: ["sorgu", "bilgi"] });
  const s = cm.butcele(ASIRI); // 400 fazla
  assert.deepEqual(s.kisilanlar, [
    { parca: "sorgu", kisilan_token: 200 },
    { parca: "bilgi", kisilan_token: 200 },
  ]);
});

test("kisilma sirasi calisma aninda degistirilemez", () => {
  const verilen = ["bilgi", "sorgu"];
  const cm = baglamYoneticisi({ kisilma_sirasi: verilen });

  assert.throws(() => cm.kisilma_sirasi.push("gorev_durumu"), TypeError);
  assert.throws(() => { cm.kisilma_sirasi[0] = "sorgu"; }, TypeError);

  // Cagiran kendi dizisini degistirse bile modulun sirasi ayni kalir.
  verilen[0] = "gorev_durumu";
  assert.deepEqual([...cm.kisilma_sirasi], ["bilgi", "sorgu"]);
});

test("ayni girdi 100 cagride ayni sonucu verir", () => {
  const cm = baglamYoneticisi();
  const ilk = JSON.stringify(cm.butcele(ASIRI));
  for (let i = 0; i < 100; i++) {
    assert.equal(JSON.stringify(cm.butcele(ASIRI)), ilk);
  }
});

test("butcele girdiyi degistirmez", () => {
  const cm = baglamYoneticisi();
  const girdi = { ...ASIRI };
  cm.butcele(girdi);
  assert.deepEqual(girdi, ASIRI);
});

test("kisilamaz parcalar tavani asiyorsa sessizce tasmaz, istisna atar", () => {
  const cm = baglamYoneticisi();
  assert.throws(
    () => cm.butcele({
      toplam: 1000, sistem_sozlesmesi: 800, gorev_durumu: 0,
      bilgi: 0, sorgu: 100, tampon: 200, // 800 + 200 = 1000 > tavan 900
    }),
    /kisilamaz parcalar tek basina tavani asiyor/,
  );
});

test("esik %100 veya ustu kabul edilmez", () => {
  for (const esik of [1, 1.2, 0, -0.5, "0.9", NaN]) {
    assert.throws(() => baglamYoneticisi({ esik }), /esik/);
  }
});

test("gecersiz kisilma sirasi reddedilir", () => {
  assert.throws(() => baglamYoneticisi({ kisilma_sirasi: [] }), /bos olmayan/);
  assert.throws(() => baglamYoneticisi({ kisilma_sirasi: ["tampon"] }), /kisilamaz parca/);
  assert.throws(() => baglamYoneticisi({ kisilma_sirasi: ["sistem_sozlesmesi"] }), /kisilamaz parca/);
  assert.throws(() => baglamYoneticisi({ kisilma_sirasi: ["bilgi", "bilgi"] }), /iki kez/);
});

test("eksik veya gecersiz bilesen reddedilir", () => {
  const cm = baglamYoneticisi();
  const { tampon, ...eksik } = ASIRI;
  assert.throws(() => cm.butcele(eksik), /zorunlu bilesen eksik: 'tampon'/);
  assert.throws(() => cm.butcele({ ...ASIRI, bilgi: -1 }), /'bilgi'/);
  assert.throws(() => cm.butcele({ ...ASIRI, sorgu: NaN }), /'sorgu'/);
  assert.throws(() => cm.butcele({ ...ASIRI, toplam: "1000" }), /'toplam'/);
  assert.throws(() => cm.butcele(null), /bir nesne olmali/);
});
