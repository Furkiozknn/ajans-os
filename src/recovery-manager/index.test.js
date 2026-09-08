/**
 * Recovery Manager testleri (U11).
 *
 * Yol haritasindaki bitti olcutu iki cumle: (a) telafisi olmayan eylemden
 * sonra **daima** `insan-kapisi`, hicbir kosulda `duzelt` degil; (b)
 * `bekleme_ms` artan ve ust sinirli. Ikisi de burada olculuyor — (a) dokuz
 * hata turu x bes deneme kombinasyonunun tamami taranarak, cunku "daima"
 * bir ornekle degil, karsi ornegin yoklugu ile kanitlanir.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { kurtarmaYoneticisi, HATA_TURLERI } from "./index.js";

/** Jitter kaynagi sabitlenmis yonetici: bekleme degerleri belirlenimci olur. */
function kur(secenekler = {}) {
  return kurtarmaYoneticisi({ rastgele: () => 0.5, ...secenekler });
}

test("telafisi olmayan eylemden sonra her hata turu ve her denemede insan-kapisi", () => {
  const rm = kur();
  for (const hata_turu of HATA_TURLERI) {
    for (let deneme = 1; deneme <= 5; deneme += 1) {
      const karar = rm.mod_sec({ hata_turu, deneme, step_id: "yan-etkili-adim", telafi_var: false });
      assert.equal(karar.mod, "insan-kapisi", `${hata_turu} / deneme ${deneme}`);
      assert.equal(karar.bekleme_ms, 0);
      assert.match(karar.gerekce, /telafi/);
    }
  }
});

test("telafi yoksa 'duzelt' hicbir kosulda uretilmiyor", () => {
  const rm = kur({ duzelt_hakki: 9 });
  const modlar = new Set();
  for (const hata_turu of HATA_TURLERI) {
    for (let deneme = 1; deneme <= 9; deneme += 1) {
      modlar.add(rm.mod_sec({ hata_turu, deneme, step_id: "a", telafi_var: false }).mod);
    }
  }
  assert.deepEqual([...modlar], ["insan-kapisi"]);
});

test("dort mod da ulasilabilir", () => {
  const rm = kur();
  const ortak = { step_id: "a", telafi_var: true };
  assert.equal(rm.mod_sec({ ...ortak, hata_turu: "SEMA_IHLALI", deneme: 1 }).mod, "duzelt");
  assert.equal(rm.mod_sec({ ...ortak, hata_turu: "SEMA_IHLALI", deneme: 3 }).mod, "temiz-sayfa");
  assert.equal(rm.mod_sec({ ...ortak, hata_turu: "SEMA_IHLALI", deneme: 4 }).mod, "durdur");
  assert.equal(rm.mod_sec({ ...ortak, hata_turu: "IZIN_REDDI", deneme: 1 }).mod, "insan-kapisi");
});

test("siniflandirilmayan hata denenmez: BILINMEYEN ilk denemede bile durdur", () => {
  const karar = kur().mod_sec({
    hata_turu: "BILINMEYEN",
    deneme: 1,
    step_id: "a",
    telafi_var: true,
  });
  assert.equal(karar.mod, "durdur");
  assert.equal(karar.bekleme_ms, 0);
});

test("beklemek yalnizca cevre kaynakli hatada: cikti hatasinda bekleme 0", () => {
  const rm = kur();
  const ortak = { deneme: 2, step_id: "a", telafi_var: true };
  assert.equal(rm.mod_sec({ ...ortak, hata_turu: "SEMA_IHLALI" }).bekleme_ms, 0);
  assert.equal(rm.mod_sec({ ...ortak, hata_turu: "DOGRULAMA_KALDI" }).bekleme_ms, 0);
  assert.ok(rm.mod_sec({ ...ortak, hata_turu: "ZAMAN_ASIMI" }).bekleme_ms > 0);
  assert.ok(rm.mod_sec({ ...ortak, hata_turu: "ARAC_HATASI" }).bekleme_ms > 0);
});

test("bekleme_ms artan ve tavanla sinirli — jitter'in iki ucunda da", () => {
  for (const pay of [0, 0.5, 1]) {
    const rm = kurtarmaYoneticisi({ taban_ms: 1000, tavan_ms: 30000, rastgele: () => pay });
    let onceki = 0;
    for (let deneme = 1; deneme <= 12; deneme += 1) {
      const bekleme = rm.bekleme_ms(deneme);
      assert.ok(bekleme >= onceki, `deneme ${deneme}: ${bekleme} < ${onceki} (pay ${pay})`);
      assert.ok(bekleme <= 30000, `deneme ${deneme}: tavan asildi (${bekleme})`);
      onceki = bekleme;
    }
    assert.equal(onceki, Math.round(15000 + 15000 * pay), "tavanda sabitlenmeli");
  }
});

test("jitter gercekten uygulaniyor: iki uc ayni degeri vermiyor", () => {
  const az = kurtarmaYoneticisi({ rastgele: () => 0 }).bekleme_ms(3);
  const cok = kurtarmaYoneticisi({ rastgele: () => 1 }).bekleme_ms(3);
  assert.ok(cok > az, `jitter yok: ${az} == ${cok}`);
});

test("eksik veya bozuk girdi sessizce varsayilana dusmuyor", () => {
  const rm = kur();
  const ortak = { deneme: 1, step_id: "a", telafi_var: true };
  assert.throws(() => rm.mod_sec({ ...ortak, hata_turu: "429" }), /bilinmeyen hata_turu/);
  assert.throws(() => rm.mod_sec({ ...ortak, hata_turu: undefined }), /bilinmeyen hata_turu/);
  // Eksik telafi bilgisi "telafi vardir" sayilmaz; kapiyi acan taraf beyan eder.
  assert.throws(
    () => rm.mod_sec({ hata_turu: "ARAC_HATASI", deneme: 1, step_id: "a" }),
    /telafi_var/,
  );
  assert.throws(() => rm.mod_sec({ ...ortak, hata_turu: "ARAC_HATASI", deneme: 0 }), /deneme/);
  assert.throws(() => rm.mod_sec({ ...ortak, hata_turu: "ARAC_HATASI", step_id: "" }), /step_id/);
  assert.throws(() => kurtarmaYoneticisi({ tavan_ms: 10, taban_ms: 1000 }), /tavan_ms/);
});

test("mimaride geri alma yok: kodda ve modlarda o kelime gecmiyor", async () => {
  const { readFile } = await import("node:fs/promises");
  const kaynak = await readFile(new URL("./index.js", import.meta.url), "utf8");
  // BILINEN-TUZAKLAR #22: "bu dosyada X yok" bir iddiadir, aranmadan yazilmaz.
  assert.equal(/rollback/i.test(kaynak), false, "kaynakta yasakli kelime var");
});
