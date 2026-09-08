/**
 * U2 kabul testleri — Agent Registry.
 *
 * Olcut mutlu yol degil, mimariden gelen kisit:
 *   1. iki ornek ajan yuklenir ve dogrulanir,
 *   2. eksik zorunlu alanli sozlesme REDDEDILIR (ve yukleme sessiz kalmaz),
 *   3. `turet` diske YAZMAZ — dizin anlik goruntusu once/sonra ayni,
 *   4. sema kurallari (kapi bir yapilandirma degeri degil, AP1) uygulamada da tutar,
 *   5. bu modulun dogrulayicisi ile `arac/sema-dogrula.js` ayni belgede ayni karari verir.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, copyFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ajanKaydi } from "./index.js";

const KOK = fileURLToPath(new URL("../..", import.meta.url));
const ORNEK_DIZIN = join(KOK, "contracts", "ornek");
const ORNEKLER = ["kod-gozden-gecirici.json", "kanit-denetcisi.json"];

/** Ornekleri gecici bir klasore kopyalar; testler depoyu kirletmez. */
function geciciKayit(ekDosyalar = {}) {
  const dizin = mkdtempSync(join(tmpdir(), "ajans-os-u2-"));
  for (const ad of ORNEKLER) copyFileSync(join(ORNEK_DIZIN, ad), join(dizin, ad));
  for (const [ad, icerik] of Object.entries(ekDosyalar)) {
    writeFileSync(join(dizin, ad), JSON.stringify(icerik, null, 2), "utf8");
  }
  return { dizin, kayit: ajanKaydi({ dizin }) };
}

const ornekOku = (ad) => JSON.parse(readFileSync(join(ORNEK_DIZIN, ad), "utf8"));

/** Dizinin anlik goruntusu: dosya adi + boyut + degistirilme zamani. */
function anlikGoruntu(dizin) {
  return readdirSync(dizin).sort().map((ad) => {
    const s = statSync(join(dizin, ad));
    return `${ad}:${s.size}:${s.mtimeMs}`;
  }).join("|");
}

test("iki ornek ajan yuklenir, dogrulanir ve suzulur", async () => {
  const { kayit } = geciciKayit();

  for (const ad of ORNEKLER) {
    assert.deepEqual(kayit.dogrula(ornekOku(ad)), { gecerli: true, hatalar: [] });
  }

  const hepsi = await kayit.listele();
  assert.equal(hepsi.length, 2);

  const gozden = await kayit.getir("kod-gozden-gecirici");
  assert.equal(gozden.identity.version, "1.0.0");
  assert.equal(await kayit.getir("olmayan-ajan"), null);

  // Durum kayittan degil sozlesmeden okunur (ADR-006, identity.status).
  assert.deepEqual((await kayit.listele({ status: "active" })).length, 2);
  assert.deepEqual((await kayit.listele({ status: "archived" })).length, 0);
  assert.deepEqual((await kayit.listele({ role: "evaluator" })).map((s) => s.identity.id), ["kanit-denetcisi"]);
  assert.deepEqual((await kayit.listele({ tags: ["kalite"] })).map((s) => s.identity.id), ["kod-gozden-gecirici"]);

  // Donen belge kopyadir: cagiran kayit defterini degistiremez.
  gozden.identity.version = "9.9.9";
  assert.equal((await kayit.getir("kod-gozden-gecirici")).identity.version, "1.0.0");
});

test("eksik zorunlu alanli sozlesme reddedilir ve yukleme sessiz kalmaz", async () => {
  const bozuk = ornekOku("kod-gozden-gecirici.json");
  bozuk.identity.id = "eksik-alanli";
  delete bozuk.memory_scope;

  const { kayit } = geciciKayit();
  const sonuc = kayit.dogrula(bozuk);
  assert.equal(sonuc.gecerli, false);
  assert.ok(sonuc.hatalar.some((h) => h.includes("memory_scope")), sonuc.hatalar.join("; "));

  // Gecersiz dosya iceren dizin sessizce iki ajan dondurmez: yukleme patlar.
  const { kayit: kirli } = geciciKayit({ "eksik-alanli.json": bozuk });
  await assert.rejects(() => kirli.listele(), /eksik-alanli\.json: sozlesme gecersiz.*memory_scope/s);
});

test("sema kurallari uygulamada da tutar: kapi bir yapilandirma degeri degil (AP1)", () => {
  const { kayit } = geciciKayit();

  // risk=high + scope=execute olan araca requires_human_approval:false yazilamaz.
  const kapisiz = ornekOku("kod-gozden-gecirici.json");
  kapisiz.tools.find((a) => a.name === "Bash").requires_human_approval = false;
  assert.equal(kayit.dogrula(kapisiz).gecerli, false);

  // filesystem.delete yalnizca false olabilir; kalici silme sozlesmeyle verilemez.
  const silen = ornekOku("kod-gozden-gecirici.json");
  silen.permissions.filesystem.delete = true;
  assert.equal(kayit.dogrula(silen).gecerli, false);

  // Yazan bellek katmani saklama suresi ister (AP9 -> kural 10).
  const suresiz = ornekOku("kod-gozden-gecirici.json");
  delete suresiz.memory_scope.retention;
  assert.equal(kayit.dogrula(suresiz).gecerli, false);

  // Sozlesme nesne degilse dogrulayici cokmez, hata dondurur.
  assert.equal(kayit.dogrula("sozlesme").gecerli, false);
  assert.equal(kayit.dogrula(null).gecerli, false);
});

test("turet diske yazmaz, icerik dondurur (K8)", async () => {
  const { dizin, kayit } = geciciKayit();
  await kayit.listele(); // yukleme okumasi anlik goruntuden once bitsin

  const oncesi = anlikGoruntu(dizin);
  const uretilen = await kayit.turet("kod-gozden-gecirici", "claude-code");
  assert.equal(anlikGoruntu(dizin), oncesi, "turet calisma dizinini degistirmis");

  const yollar = Object.keys(uretilen);
  assert.deepEqual(yollar, ["agents/kod-gozden-gecirici.md"]);
  // Donen yol diskte yok: yazma isi cagirana ait.
  assert.throws(() => statSync(join(KOK, yollar[0])), /ENOENT/);

  const icerik = uretilen[yollar[0]];
  const sozlesme = ornekOku("kod-gozden-gecirici.json");
  assert.match(icerik, /^---\nname: kod-gozden-gecirici\n/);
  // description elle yazilmaz: role.summary + capabilities metinlerinden turer.
  assert.ok(icerik.includes(sozlesme.role.summary), "role.summary turetilmemis");
  assert.ok(icerik.includes(sozlesme.capabilities[0].description), "capabilities turetilmemis");
  // K8'in kayip bilgi noktasi: yazma kapsami frontmatter'a degil sinir cumlesine gider.
  assert.ok(icerik.includes("Hicbir dosyaya yazmaz."), "yazma siniri metne gecmemis");
  assert.ok(!/^write:/m.test(icerik), "yazma kapsami frontmatter'a sizmis");
  for (const adim of sozlesme.workflow.steps) assert.ok(icerik.includes(adim.action), `adim eksik: ${adim.id}`);

  await assert.rejects(() => kayit.turet("kod-gozden-gecirici", "cursor"), /bilinmeyen ev sahibi/);
  await assert.rejects(() => kayit.turet("olmayan-ajan", "claude-code"), /ajan yok/);
});

test("arac/sema-dogrula.js ile ayni karar (iki dogrulayici surukleyemez)", () => {
  const { dizin, kayit } = geciciKayit();
  const bozuk = ornekOku("kanit-denetcisi.json");
  delete bozuk.failure_modes;

  const durumlar = [
    [ornekOku("kanit-denetcisi.json"), true],
    [ornekOku("kod-gozden-gecirici.json"), true],
    [bozuk, false],
  ];

  for (const [belge, beklenen] of durumlar) {
    const yol = join(dizin, "_denek.json");
    writeFileSync(yol, JSON.stringify(belge), "utf8");
    let aracGecti = true;
    try {
      execFileSync(process.execPath, [join(KOK, "arac", "sema-dogrula.js"), "--dosya", yol, "--sema", "agent.schema.json"], { stdio: "pipe" });
    } catch {
      aracGecti = false;
    }
    assert.equal(aracGecti, beklenen, "arac beklenenden farkli karar verdi");
    assert.equal(kayit.dogrula(belge).gecerli, aracGecti, "modul ile arac ayni belgede ayristi");
  }
});
