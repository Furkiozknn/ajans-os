/**
 * U7 kabul testleri — Model Router.
 *
 * Olcut mutlu yol degil, blueprint §2.11'in (K4) iki kisiti:
 *   1. **Secim saglayici-agnostiktir** — bu bir yorum degil, asagida
 *      olculuyor: modulun kaynagi bilinen saglayici adlarindan hicbirini
 *      icermiyor. Adlarin bu agacta gectigi tek yer yasak listesinin
 *      kendisidir ve test o blogu kendi kaynagindan cikararak arar
 *      (BILINEN-TUZAKLAR #22: bir kelimeyi yasaklayan cumle o kelimeyi
 *      kacinilmaz olarak icerir; iddia edilmez, olculur).
 *   2. **Tasima ayri katmandir** — `sec` hicbir tasiyici kurulu degilken de
 *      calisir; `cagir` sahte tasiyiciyla `usage` dondurur ve `usage`siz
 *      yaniti reddeder.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { modelYonlendirici } from "./index.js";

// YASAK-LISTE-BASI
/** Bu agacta gecmemesi gereken adlar. Tek istisna: bu blogun kendisi. */
const SAGLAYICI_ADLARI = [
  "anthropic", "claude", "openai", "gpt-4", "gpt-5", "azure", "gemini",
  "google", "bedrock", "vertex", "mistral", "cohere", "ollama", "llama",
  "groq", "deepseek", "litellm", "openrouter",
];
// YASAK-LISTE-SONU

/** Sira operatorun tercihidir: ilk uyan kazanir. Adlar bilerek notrdur. */
const KATALOG = [
  { model_id: "hizli-kucuk", saglayici: "tasiyici-a", yetenekler: ["ucuz"], baglam_token: 32_000, tahmini_usd: 0.01 },
  { model_id: "genis-baglam", saglayici: "tasiyici-a", yetenekler: ["ucuz", "uzun-baglam"], baglam_token: 200_000, tahmini_usd: 0.4 },
  { model_id: "arac-ustasi", saglayici: "tasiyici-b", yetenekler: ["arac-cagirma", "uzun-baglam"], baglam_token: 200_000, tahmini_usd: null, tasima: { zaman_asimi_ms: 30_000 } },
];

/** Sahte tasiyici: sagladigi tek sey usage tasiyan bir yanittir. */
function sahteTasiyici(saglayici, { usage = { input_tokens: 12, output_tokens: 3 }, ...digerleri } = {}) {
  const cagrilar = [];
  return {
    saglayici,
    cagrilar,
    async cagir(secim, istem) {
      cagrilar.push({ secim, istem });
      return { icerik: "yanit", usage, cost: { total_usd: 0.002 }, model_id: secim.model_id, ...digerleri };
    },
  };
}

// ---------------------------------------------------------------- sec

test("secim saglayici-agnostiktir: kaynakta tek bir saglayici adi gecmez", () => {
  const kaynak = readFileSync(new URL("./index.js", import.meta.url), "utf8");
  const testKaynagi = readFileSync(new URL("./index.test.js", import.meta.url), "utf8")
    .replace(/\/\/ YASAK-LISTE-BASI[\s\S]*?\/\/ YASAK-LISTE-SONU/, "");

  // Blok gercekten cikarildi mi — cikmadiysa test kendini onaylardi.
  const ham = readFileSync(new URL("./index.test.js", import.meta.url), "utf8");
  assert.ok(testKaynagi.length < ham.length, "yasak liste blogu cikarilamadi");

  for (const ad of SAGLAYICI_ADLARI) {
    assert.equal(kaynak.toLowerCase().includes(ad), false, `index.js icinde saglayici adi: ${ad}`);
    assert.equal(testKaynagi.toLowerCase().includes(ad), false, `index.test.js icinde saglayici adi: ${ad}`);
  }
});

test("ayni gereksinim 100 cagrida ayni secimi verir", () => {
  const mr = modelYonlendirici({ katalog: KATALOG });
  const ilk = mr.sec({ yetenekler: ["uzun-baglam"] });
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(mr.sec({ yetenekler: ["uzun-baglam"] }), ilk);
  }
  // Sira operatorun tercihi: iki girdi de uyuyor, katalogdaki ilki kazandi.
  assert.equal(ilk.model_id, "genis-baglam");
});

test("baglam kisiti uymayan girdiyi eler", () => {
  const mr = modelYonlendirici({ katalog: KATALOG });
  const s = mr.sec({ yetenekler: ["ucuz"], en_az_baglam_token: 100_000 });
  assert.equal(s.model_id, "genis-baglam"); // hizli-kucuk 32k ile elendi
});

test("tavan verildiginde maliyeti bilinmeyen girdi elenir (kural 11)", () => {
  const mr = modelYonlendirici({ katalog: KATALOG });
  // arac-ustasi tek uyan yetenege sahip, ama tahmini_usd null: bilinmeyen
  // maliyet sifir degildir, tavan altinda secilemez.
  assert.throws(
    () => mr.sec({ yetenekler: ["arac-cagirma"], tavan_usd: 1 }),
    /maliyeti bilinmiyor/,
  );
  // Tavan yokken ayni gereksinim seciliyor — eleyen tavanin kendisiydi.
  assert.equal(mr.sec({ yetenekler: ["arac-cagirma"] }).model_id, "arac-ustasi");
});

test("tavani asan girdi elenir", () => {
  const mr = modelYonlendirici({ katalog: KATALOG });
  assert.equal(mr.sec({ yetenekler: ["ucuz"], tavan_usd: 0.05 }).model_id, "hizli-kucuk");
});

test("eslesme yoksa sessizce dusmez, istisna atar ve neden elendigini soyler", () => {
  const mr = modelYonlendirici({ katalog: KATALOG });
  assert.throws(() => mr.sec({ yetenekler: ["goruntu"] }), (h) => {
    assert.match(h.message, /karsilayan model yok/);
    assert.match(h.message, /eksik yetenek goruntu/);
    return true;
  });
});

test("sec hicbir tasiyici kurulu degilken calisir (secim ile tasima ayri)", () => {
  const mr = modelYonlendirici({ katalog: KATALOG }); // tasiyicilar verilmedi
  assert.equal(mr.sec({ yetenekler: [] }).model_id, "hizli-kucuk");
});

test("donen tasima kopyadir; cagiran onu degistirse katalog degismez", () => {
  const mr = modelYonlendirici({ katalog: KATALOG });
  const s = mr.sec({ yetenekler: ["arac-cagirma"] });
  s.tasima.zaman_asimi_ms = 1;
  assert.equal(mr.sec({ yetenekler: ["arac-cagirma"] }).tasima.zaman_asimi_ms, 30_000);
  assert.throws(() => { mr.katalog.push({}); }, TypeError);
});

// -------------------------------------------------------------- kurulus

test("gecersiz katalog girdisi sessizce atlanmaz", () => {
  assert.throws(() => modelYonlendirici({ katalog: [] }), /bos olmayan bir dizi/);
  assert.throws(
    () => modelYonlendirici({ katalog: [{ model_id: "a", saglayici: "t", yetenekler: ["x"] }] }),
    /baglam_token/,
  );
  assert.throws(
    () => modelYonlendirici({ katalog: [KATALOG[0], { ...KATALOG[0] }] }),
    /yinelenen model_id/,
  );
  assert.throws(
    () => modelYonlendirici({ katalog: KATALOG, tasiyicilar: [{ saglayici: "tasiyici-a" }] }),
    /'saglayici' ve 'cagir' tasimali/,
  );
});

// --------------------------------------------------------------- cagir

test("cagir sahte tasiyiciyla calisir ve donusunde usage bulunur", async () => {
  const t = sahteTasiyici("tasiyici-b");
  const mr = modelYonlendirici({ katalog: KATALOG, tasiyicilar: [t] });

  const secim = mr.sec({ yetenekler: ["arac-cagirma"] });
  const yanit = await mr.cagir(secim, { rol: "kullanici", metin: "merhaba" });

  assert.deepEqual(yanit.usage, { input_tokens: 12, output_tokens: 3 });
  assert.equal(yanit.model_id, "arac-ustasi");
  assert.deepEqual(yanit.cost, { total_usd: 0.002 });
  // Tasiyici secimi oldugu gibi gordu: cevirmeyi o yapar, cekirdek degil.
  assert.equal(t.cagrilar.length, 1);
  assert.equal(t.cagrilar[0].secim.model_id, "arac-ustasi");
});

test("usage'siz yanit reddedilir: olculemeyen cagri kabul edilmez", async () => {
  const mr = modelYonlendirici({
    katalog: KATALOG,
    tasiyicilar: [{ saglayici: "tasiyici-b", async cagir() { return { icerik: "x" }; } }],
  });
  const secim = mr.sec({ yetenekler: ["arac-cagirma"] });
  await assert.rejects(() => mr.cagir(secim, "istem"), /usage/);
});

test("usage sayaci sayi degilse reddedilir", async () => {
  const t = sahteTasiyici("tasiyici-b", { usage: { input_tokens: "cok" } });
  const mr = modelYonlendirici({ katalog: KATALOG, tasiyicilar: [t] });
  await assert.rejects(
    () => mr.cagir(mr.sec({ yetenekler: ["arac-cagirma"] }), "istem"),
    /usage.input_tokens/,
  );
});

test("tasiyicisi olmayan secim sessizce baska tasiyiciya dusmez", async () => {
  const mr = modelYonlendirici({ katalog: KATALOG, tasiyicilar: [sahteTasiyici("tasiyici-a")] });
  const secim = mr.sec({ yetenekler: ["arac-cagirma"] }); // tasiyici-b ister
  await assert.rejects(() => mr.cagir(secim, "istem"), /icin tasiyici yok/);
});

test("tasiyicinin hatasi yutulmaz, cekirdek kendiliginden yeniden denemez", async () => {
  let cagri = 0;
  const mr = modelYonlendirici({
    katalog: KATALOG,
    tasiyicilar: [{ saglayici: "tasiyici-a", async cagir() { cagri++; throw new Error("kesinti"); } }],
  });
  await assert.rejects(() => mr.cagir(mr.sec({ yetenekler: ["ucuz"] }), "istem"), /kesinti/);
  assert.equal(cagri, 1);
});
