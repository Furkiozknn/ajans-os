/**
 * U10 kabul testleri — Critic.
 *
 * Iki bitti olcutu dogrudan olculur:
 *   1. **Donus `string` degil, semaya uyan bir belgedir** — uretilen mesaj
 *      gecici bir dosyaya yazilip `arac/sema-dogrula.js --sema
 *      message.schema.json` ile denetlenir. Aracin gercekten baktigini
 *      kanitlamak icin ayni testte bozulmus bir belge de gecirilir ve
 *      REDDEDILMESI beklenir (yoksa "gecti" cikti bir sey kanitlamaz).
 *   2. **Elestirinin gecme kararina oyu yok** — karar yalnizca U9'dan gelir:
 *      GECTI/DEGERLENDIRILMEDI icin elestiri hic uretilmez, uretilen mesajda
 *      karar tasiyabilecek alan yoktur, tasiyici boyle bir alan eklemeye
 *      calisirsa istisna atar ve girdideki `degerlendirme` nesnesi
 *      degismeden kalir.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { elestirmen, EN_FAZLA_MADDE } from "./index.js";

const KOK = fileURLToPath(new URL("../..", import.meta.url));
const SAAT = () => "2026-09-08T15:02:00+03:00";

const KALDI = {
  sonuc: "KALDI",
  gecti: false,
  kanitlar: [{ tur: "cikis_kodu", kod: 1 }],
  aciklama: "KALDI: cikis kodu 1 (KALDI)",
};

const ADIM = {
  step_id: "belgeyi-yaz",
  attempt: 2,
  status: "failed",
  started_at: "2026-09-08T15:00:00+03:00",
};

const MADDE = {
  id: "kanitsiz-iddia",
  severity: "yuksek",
  location: "docs/mimari/02-ORKESTRASYON.md:88",
  what: "Konsensusun gereksiz oldugu iddiasi kaynak gosterilmeden yazilmis.",
  fix_hint: "I1 OZET.md §7'deki tespite bagla veya iddiayi kaldir.",
};

const madde = (i) => ({ ...MADDE, id: `madde-${i}` });

/** Verilen yaniti donduren sahte tasiyici; cagri girdisini de kaydeder. */
function sahte(yanit) {
  const cagrilar = [];
  const cagir = async (istem) => {
    cagrilar.push(istem);
    return typeof yanit === "function" ? yanit(istem) : yanit;
  };
  return { cagrilar, kritik: elestirmen({ cagir, saat: SAAT }) };
}

const girdi = () => ({
  run_id: "kosu-2026-09-08-1416",
  step_id: "belgeyi-yaz",
  degerlendirme: structuredClone(KALDI),
  adim_kaydi: structuredClone(ADIM),
});

/** Belgeyi `arac/sema-dogrula.js` ile denetler; gecerli mi doner. */
function aracGecti(belge, sema = "message.schema.json") {
  const yol = join(mkdtempSync(join(tmpdir(), "ajans-os-u10-")), "_denek.json");
  writeFileSync(yol, JSON.stringify(belge), "utf8");
  try {
    execFileSync(process.execPath, [join(KOK, "arac", "sema-dogrula.js"), "--dosya", yol, "--sema", sema], {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

test("donus string degil, message.schema.json'a uyan bir belgedir", async () => {
  const { kritik } = sahte({ items: [MADDE], raw_ref: "loglar/2026-09-08-1416/critic-raw.jsonl" });
  const mesaj = await kritik.elestir(girdi());

  assert.notEqual(typeof mesaj, "string");
  assert.equal(mesaj.kind, "critique");
  assert.equal(mesaj.step_id, "belgeyi-yaz");
  assert.equal(mesaj.at, SAAT());
  assert.deepEqual(mesaj.to, { kind: "orchestrator", id: "orkestrator" });
  assert.equal(mesaj.payload.truncated, false);
  assert.deepEqual(mesaj.payload.items, [MADDE]);

  assert.ok(aracGecti(mesaj), "arac uretilen mesaji reddetti");

  // Aracin gercekten baktiginin kaniti: bozulmus belge REDDEDILMELI.
  const bozuk = structuredClone(mesaj);
  delete bozuk.payload.items;
  assert.equal(aracGecti(bozuk), false, "arac items'siz critique mesajini gecirdi");
});

test("elestiri yalnizca KALDI icin uretilir — karar U9'dan gelir", async () => {
  for (const sonuc of ["GECTI", "DEGERLENDIRILMEDI", "gecti", undefined]) {
    const { kritik, cagrilar } = sahte({ items: [MADDE] });
    const g = girdi();
    g.degerlendirme.sonuc = sonuc;
    g.degerlendirme.gecti = sonuc === "GECTI";
    await assert.rejects(() => kritik.elestir(g), /yalnizca KALDI/, `${sonuc} icin elestiri uretildi`);
    assert.equal(cagrilar.length, 0, `${sonuc}: model bosuna cagrildi`);
  }
});

test("mesajda karar tasiyabilecek alan yok; degerlendirme nesnesi degismiyor", async () => {
  const { kritik, cagrilar } = sahte({ items: [MADDE] });
  const g = girdi();
  const oncesi = structuredClone(g);
  const mesaj = await kritik.elestir(g);

  assert.deepEqual(g, oncesi, "elestir girdiyi degistirdi");
  assert.deepEqual(Object.keys(mesaj.payload).sort(), ["items", "truncated"]);
  // Karar tarafina acilabilecek her kelime mesajin tamaminda aranir.
  const metin = JSON.stringify(mesaj);
  for (const kelime of ["GECTI", "KALDI", "gecti", "decision", "sonuc", "ALLOW", "BLOCK", "pass"]) {
    assert.ok(!metin.includes(kelime), `mesajda karar sizintisi: ${kelime}`);
  }
  // Karar tasiyiciya **verilmis** olarak gider, sorulmaz.
  assert.equal(cagrilar[0].karar, "KALDI");
});

test("tasiyici karar alani eklerse istisna — sessizce atlanmaz (AP3)", async () => {
  for (const fazla of [{ gecti: true }, { severity_override: "gecti" }, { decision: "ALLOW" }]) {
    const { kritik } = sahte({ items: [{ ...MADDE, ...fazla }] });
    await assert.rejects(() => kritik.elestir(girdi()), /tanimsiz/, JSON.stringify(fazla));
  }
});

test("gecersiz madde duzeltilmez, reddedilir", async () => {
  const durumlar = [
    [{ ...MADDE, id: "Kanitsiz Iddia" }, /id kebab-id/],
    [{ ...MADDE, severity: "kritik" }, /severity/],
    [{ ...MADDE, what: "kk" }, /what/],
    [{ ...MADDE, fix_hint: undefined }, /fix_hint/],
    ["serbest metin elestiri", /madde bir nesne/],
  ];
  for (const [bozuk, kalip] of durumlar) {
    const { kritik } = sahte({ items: [bozuk] });
    await assert.rejects(() => kritik.elestir(girdi()), kalip, JSON.stringify(bozuk));
  }

  const { kritik } = sahte({ items: [] });
  await assert.rejects(() => kritik.elestir(girdi()), /en az bir madde/);

  const ikiz = sahte({ items: [madde(1), madde(1)] });
  await assert.rejects(() => ikiz.kritik.elestir(girdi()), /benzersiz/);

  const metin = sahte("elestiri: daha dikkatli ol");
  await assert.rejects(() => metin.kritik.elestir(girdi()), /items/);
});

test("ust sinir semadan gelir: 20'den fazla madde kesilir ve bildirilir", async () => {
  const cok = Array.from({ length: EN_FAZLA_MADDE + 5 }, (_, i) => madde(i + 1));
  const { kritik } = sahte({ items: cok, raw_ref: "loglar/ham.jsonl" });
  const mesaj = await kritik.elestir(girdi());

  assert.equal(mesaj.payload.items.length, EN_FAZLA_MADDE);
  assert.equal(mesaj.payload.truncated, true);
  assert.equal(mesaj.payload.raw_ref, "loglar/ham.jsonl", "kesilen icerik icin ham kayit isareti yok");
  assert.ok(aracGecti(mesaj), "kesilmis mesaj semaya uymuyor");
});

test("kurulum ve girdi denetimi", async () => {
  assert.throws(() => elestirmen({}), /cagir/);
  assert.throws(() => elestirmen({ cagir: async () => ({}), kimlik: "Critic" }), /kimlik/);

  const { kritik } = sahte({ items: [MADDE] });
  await assert.rejects(() => kritik.elestir({ ...girdi(), run_id: "Kosu 1" }), /run_id/);
  await assert.rejects(() => kritik.elestir({ ...girdi(), step_id: 7 }), /step_id/);
  await assert.rejects(() => kritik.elestir({ ...girdi(), adim_kaydi: null }), /adim_kaydi/);
});
