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
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, copyFileSync, statSync, existsSync } from "node:fs";
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

test("triggers description'a tirnak icinde gecer (sema 2.1, ADR-010)", async () => {
  const { kayit } = geciciKayit();
  for (const ad of ORNEKLER) {
    const sozlesme = ornekOku(ad);
    const uretilen = await kayit.turet(sozlesme.identity.id, "claude-code");
    const icerik = Object.values(uretilen)[0];
    const aciklama = icerik.match(/^description: (.*)$/m)?.[1];
    assert.ok(aciklama, `${ad}: description satiri yok`);
    assert.ok(sozlesme.triggers.length > 0, `${ad}: sozlesmede triggers yok`);
    for (const t of sozlesme.triggers) {
      assert.ok(aciklama.includes(`"${t}"`), `${ad}: tetik ifadesi tirnaksiz ya da eksik — ${t}`);
    }
    // Tirnaklar frontmatter'i bolmemeli: cift tirnakli metin tek tirnakli YAML olur.
    assert.match(aciklama, /^'.*'$/, `${ad}: cift tirnakli metin tek tirnakli YAML'a alinmamis`);
  }
});

/**
 * U15'in bitti olcutu: turetilen dosya komsu projenin dogrulayicisindan gecer.
 *
 * Bu test ajans-os'un kendi iddiasini degil, **baska birinin** kabul kapisini
 * olcer; K8 ("ev sahibi bicimi turetilir") ancak turetilen dosya o ev sahibinin
 * araclarinca kabul edilirse dogrudur. Komsu depo yoksa test atlanir — ajans-os
 * disariya bagimli degildir (ADR-002) — ama atlanma sessiz degil, isaretlidir.
 *
 * KOMSU NEREDE ARANIR. Varsayilan `../turkce-ajanlar`: iki depo yan yana
 * klonlanmissa (gelistirme makinesi) kendiliginden bulunur. CI'da checkout
 * calisma alaninin disina yazamaz, o yuzden yol `AJANS_OS_KOMSU` ile
 * verilebiliyor. Bu degisken olmadan davranis birebir eskisi gibi —
 * ADR-002 bozulmuyor, komsu yoksa test yine isaretli bicimde atlaniyor.
 */
const KOMSU_KOK = process.env.AJANS_OS_KOMSU || join(KOK, "..", "turkce-ajanlar");

test("turetilen dosya turkce-ajanlar/arac/dogrula.js'ten gecer (U15)", async (t) => {
  const dogrulayici = join(KOMSU_KOK, "arac", "dogrula.js");
  if (!existsSync(dogrulayici)) {
    t.skip(`komsu dogrulayici yok: ${dogrulayici}`);
    return;
  }

  const { kayit } = geciciKayit();
  const cikti = mkdtempSync(join(tmpdir(), "ajans-os-u15-"));
  const dosyalar = [];
  for (const ad of ORNEKLER) {
    const uretilen = await kayit.turet(ornekOku(ad).identity.id, "claude-code");
    for (const [yol, icerik] of Object.entries(uretilen)) {
      const hedef = join(cikti, yol.split("/").pop());
      writeFileSync(hedef, icerik, "utf8");
      dosyalar.push(hedef);
    }
  }

  // --kati: uyari da hata sayilir. Turetilen bir dosyada uyari birakmak,
  // "gecti ama biraz" demektir; turetici bunu hak etmiyorsa duzeltilir.
  // Dosya yollari mutlak, dogrulayici kendi kokunu __dirname'den cozuyor:
  // cwd sonucu etkilemiyor. Yine de komsunun ust dizinine ayarli kalsin ki
  // hata metinlerindeki goreli yollar gelistirme makinesindekiyle ayni cikssin.
  const sonuc = execFileSync(process.execPath, [dogrulayici, "--kati", ...dosyalar], {
    encoding: "utf8",
    cwd: join(KOMSU_KOK, ".."),
  });
  assert.match(sonuc, /0 hata, 0 uyari/, `komsu dogrulayici temiz demedi:\n${sonuc}`);
});
