/**
 * Cost Manager testleri (U8).
 *
 * Mutlu yol disinda uc mimari kisit olculur:
 *   - tabloda olmayan model → `maliyet_usd: null` **ve** `bilinmeyen_cagri`
 *     artar (sifir maliyet sayilmaz — ADR-000 kural 11 / AP10);
 *   - ondalik ayirici: virgullu metin fiyat **reddedilir**, sessizce
 *     ayristirilmaz (BILINEN-TUZAKLAR #4);
 *   - fiyat kodda gomulu degildir: tablo yuklenmeden `usage_isle` calismaz.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { maliyetYoneticisi, VARSAYILAN_TABLO } from "./index.js";

/** Gecici tablo dosyasi yazar; testler depo icine cikti birakmaz. */
function tabloYaz(satirlar) {
  const dizin = mkdtempSync(join(tmpdir(), "ajans-os-fiyat-"));
  const yol = join(dizin, "fiyat-tablosu.json");
  writeFileSync(yol, JSON.stringify({ surum: 1, satirlar }), "utf8");
  return { yol, temizle: () => rmSync(dizin, { recursive: true, force: true }) };
}

const KUCUK = {
  model_id: "test-kucuk",
  input_usd_per_mtok: 0.25,
  output_usd_per_mtok: 1.25,
  gecerli_tarih: "2026-09-08",
};

async function kur(satirlar = [KUCUK], secenekler = {}) {
  const { yol, temizle } = tabloYaz(satirlar);
  const cm = maliyetYoneticisi({ tabloYolu: yol, tavan_usd: 6, ...secenekler });
  await cm.tablo_yukle();
  return { cm, temizle };
}

test("depodaki fiyat tablosu yuklenir ve satirlari dogrulanir", async () => {
  const cm = maliyetYoneticisi({ tabloYolu: VARSAYILAN_TABLO, tavan_usd: 6 });
  const satirlar = await cm.tablo_yukle();
  assert.ok(satirlar.length > 0);
  for (const s of satirlar) {
    assert.equal(typeof s.model_id, "string");
    assert.match(s.gecerli_tarih, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("bilinen model: maliyet milyon token basina fiyattan hesaplanir", async () => {
  const { cm, temizle } = await kur();
  try {
    const { maliyet_usd, durum } = cm.usage_isle("test-kucuk", {
      input_tokens: 1_000_000,
      output_tokens: 200_000,
    });
    assert.equal(maliyet_usd, 0.25 + 0.25); // 1 Mtok girdi + 0.2 Mtok cikti
    assert.equal(durum.harcanan_usd, 0.5);
    assert.equal(durum.bilinmeyen_cagri, 0);
  } finally {
    temizle();
  }
});

test("bilinmeyen model: maliyet null ve bilinmeyen_cagri artar, toplam artmaz", async () => {
  const { cm, temizle } = await kur();
  try {
    const { maliyet_usd, durum } = cm.usage_isle("tabloda-yok", { input_tokens: 500_000 });
    assert.equal(maliyet_usd, null); // sifir degil — "bedava" demek yalan olurdu
    assert.equal(durum.bilinmeyen_cagri, 1);
    assert.equal(durum.harcanan_usd, 0);
    assert.equal(cm.usage_isle("tabloda-yok-2", {}).durum.bilinmeyen_cagri, 2);
  } finally {
    temizle();
  }
});

test("fiyati null olan satir da bilinmeyendir, sifir maliyetli degil", async () => {
  const { cm, temizle } = await kur([
    { model_id: "fiyatsiz", input_usd_per_mtok: null, output_usd_per_mtok: null, gecerli_tarih: "2026-09-08" },
  ]);
  try {
    const sonuc = cm.usage_isle("fiyatsiz", { input_tokens: 1000 });
    assert.equal(sonuc.maliyet_usd, null);
    assert.equal(sonuc.durum.bilinmeyen_cagri, 1);
    assert.equal(sonuc.durum.harcanan_usd, 0);
  } finally {
    temizle();
  }
});

test("fiyatlanmayan sifir olmayan sayac tum cagriyi bilinmeyen yapar", async () => {
  const { cm, temizle } = await kur();
  try {
    // Satirda cache_read fiyati yok; kismi toplam donmek "tam" gibi gorunurdu.
    const sonuc = cm.usage_isle("test-kucuk", { input_tokens: 1000, cache_read_tokens: 5000 });
    assert.equal(sonuc.maliyet_usd, null);
    assert.equal(sonuc.durum.bilinmeyen_cagri, 1);
  } finally {
    temizle();
  }
});

test("sifir olan fiyatlanmayan sayac maliyeti bozmaz", async () => {
  const { cm, temizle } = await kur();
  try {
    const sonuc = cm.usage_isle("test-kucuk", { input_tokens: 1_000_000, cache_read_tokens: 0 });
    assert.equal(sonuc.maliyet_usd, 0.25);
  } finally {
    temizle();
  }
});

// --- BILINEN-TUZAKLAR #4: ondalik ayirici -----------------------------------

test("virgullu metin fiyat reddedilir; sessizce ayristirilmaz", async () => {
  const { yol, temizle } = tabloYaz([
    { model_id: "virgullu", input_usd_per_mtok: "1,25", output_usd_per_mtok: 1, gecerli_tarih: "2026-09-08" },
  ]);
  try {
    const cm = maliyetYoneticisi({ tabloYolu: yol, tavan_usd: 6 });
    await assert.rejects(() => cm.tablo_yukle(), /Ondalik ayirici nokta/);
  } finally {
    temizle();
  }
});

test("noktali ondalik JSON sayisi yerelden bagimsiz okunur", async () => {
  // Turkce yerelde "0.5742" metnini ayristiran kod 5742 uretir (#4). Tablo
  // JSON sayisi tasidigi icin boyle bir ayristirma hic olmaz.
  const { cm, temizle } = await kur([
    { model_id: "hassas", input_usd_per_mtok: 0.5742, output_usd_per_mtok: 0, gecerli_tarih: "2026-09-08" },
  ]);
  try {
    const { maliyet_usd } = cm.usage_isle("hassas", { input_tokens: 1_000_000 });
    assert.equal(maliyet_usd, 0.5742);
    assert.ok(maliyet_usd < 1, "yerel ayar yuzunden binlik ayirici okunmus olurdu");
  } finally {
    temizle();
  }
});

test("kaynakta yerel bicimlendirme yok (USD makine sayisidir)", async () => {
  const { readFile } = await import("node:fs/promises");
  const kaynak = await readFile(new URL("./index.js", import.meta.url), "utf8");
  // Aranan sey **cagri**dir; ustteki aciklama kelimeyi yasak koyarken aniyor
  // (BILINEN-TUZAKLAR #22: bir kelimeyi yasaklayan cumle onu icerir).
  assert.equal(/toLocaleString\s*\(/.test(kaynak), false);
  assert.equal(/parse(Float|Int)\s*\(/.test(kaynak), false);
});

// --- Esik, tavan, gomulu fiyat ----------------------------------------------

test("esik asilinca gecis_gerekli kalkar; modul kendisi durdurmaz", async () => {
  const { cm, temizle } = await kur([KUCUK], { tavan_usd: 1, gecis_esigi: 0.8 });
  try {
    assert.equal(cm.gecis_gerekli_mi(), false);
    cm.usage_isle("test-kucuk", { input_tokens: 2_000_000 }); // 0.50 USD
    assert.equal(cm.gecis_gerekli_mi(), false);
    const { durum } = cm.usage_isle("test-kucuk", { input_tokens: 1_600_000 }); // +0.40 → 0.90
    assert.equal(durum.gecis_gerekli, true);
    assert.ok(durum.doluluk >= 0.8);
    assert.equal(typeof cm.adim_tavani(), "number", "esik asilsa da modul kendini kapatmaz");
  } finally {
    temizle();
  }
});

test("adim_tavani kalanin payidir; kalan bitince null", async () => {
  const { cm, temizle } = await kur([KUCUK], { tavan_usd: 1, adim_orani: 0.25 });
  try {
    assert.equal(cm.adim_tavani(), 0.25);
    cm.usage_isle("test-kucuk", { input_tokens: 4_000_000 }); // 1.00 USD → kalan 0
    assert.equal(cm.adim_tavani(), null);
  } finally {
    temizle();
  }
});

test("tablo yuklenmeden usage_isle calismaz — kodda gomulu fiyat yok", () => {
  const cm = maliyetYoneticisi({ tavan_usd: 6 });
  assert.throws(() => cm.usage_isle("test-kucuk", { input_tokens: 1 }), /tablo_yukle/);
});

test("gecersiz tablo satiri sessizce atlanmaz", async () => {
  for (const [satir, kalip] of [
    [{ model_id: "", input_usd_per_mtok: 1, output_usd_per_mtok: 1, gecerli_tarih: "2026-09-08" }, /model_id/],
    [{ model_id: "x", input_usd_per_mtok: 1, output_usd_per_mtok: 1, gecerli_tarih: "08.09.2026" }, /gecerli_tarih/],
    [{ model_id: "x", input_usd_per_mtok: -1, output_usd_per_mtok: 1, gecerli_tarih: "2026-09-08" }, /input_usd_per_mtok/],
  ]) {
    const { yol, temizle } = tabloYaz([satir]);
    try {
      const cm = maliyetYoneticisi({ tabloYolu: yol, tavan_usd: 6 });
      await assert.rejects(() => cm.tablo_yukle(), kalip);
    } finally {
      temizle();
    }
  }
});

test("tavansiz kurulum reddedilir", () => {
  assert.throws(() => maliyetYoneticisi({}), /tavan_usd/);
  assert.throws(() => maliyetYoneticisi({ tavan_usd: 0 }), /tavan_usd/);
  assert.throws(() => maliyetYoneticisi({ tavan_usd: 6, gecis_esigi: 1.5 }), /gecis_esigi/);
});

test("negatif sayac reddedilir", async () => {
  const { cm, temizle } = await kur();
  try {
    assert.throws(() => cm.usage_isle("test-kucuk", { input_tokens: -5 }), /usage.input_tokens/);
  } finally {
    temizle();
  }
});
