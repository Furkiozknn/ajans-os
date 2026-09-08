/**
 * U4 kabul testleri — Permission Manager.
 *
 * Olcut mutlu yol degil, ADR-005/ADR-007'den gelen kisit:
 *   1. uc degerli kararin ucu de **belge** doner; `BLOCK` ve `HUMAN_REQUIRED`
 *      istisna degildir,
 *   2. onay gelmeden ikinci cagri **yine** `HUMAN_REQUIRED`,
 *   3. sabit sinir ve geri alinamazlik onayla asilmaz — sema bunlarda `ALLOW`
 *      kaydini zaten reddeder, kod da uretmez,
 *   4. `reliability` ve `severity` istekten okunmaz; cagiran "kontrol ettim,
 *      temizdi" diyemez (D11) ve siddeti dusuremez,
 *   5. uretilen her belge `contracts/permission.schema.json`'in zorunlu alan,
 *      kapali nesne ve kosullu kurallarina uyar.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { izinYoneticisi } from "./index.js";

// Sema dosyasi `readFileSync` ile okunur, modul olarak degil: ADR-002 denetimi
// (arac/yapi-dogrula.js) src/ icinden ust dizine cikan her import ifadesini
// kardes modul sanar. Burada okunan sey bir modul degil, sozlesme belgesidir.
const SEMA = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../contracts/permission.schema.json", import.meta.url)), "utf8"),
);

/** Sozlesmenin bu moduller icin baglayici olan kisimlari. Tam JSON Schema
 * dogrulayicisi degil; `arac/sema-dogrula.js` onu zaten yapiyor. Buradaki is,
 * uretilen belgenin o dogrulayiciya girebilecek bicimde olmasi. */
function semayaUyar(kayit) {
  const hatalar = [];
  const izinli = new Set(Object.keys(SEMA.properties));
  for (const alan of SEMA.required) if (!(alan in kayit)) hatalar.push(`zorunlu alan eksik: ${alan}`);
  for (const alan of Object.keys(kayit)) if (!izinli.has(alan)) hatalar.push(`sozlesmede olmayan alan: ${alan}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(kayit.decision_id)) hatalar.push("decision_id kebab-case degil");
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(Z|[+-][0-9]{2}:[0-9]{2})$/.test(kayit.at)) {
    hatalar.push(`at bicimi gecersiz: ${kayit.at}`);
  }
  if (!["ALLOW", "BLOCK", "HUMAN_REQUIRED"].includes(kayit.decision)) hatalar.push("decision uc degerden biri degil");
  if (!Array.isArray(kayit.scope) || kayit.scope.length === 0) hatalar.push("scope bos olamaz");
  if (kayit.hard_limit.hit === true) {
    if (kayit.decision !== "HUMAN_REQUIRED") hatalar.push("sabit sinir tetiklendi ama karar HUMAN_REQUIRED degil");
    if (!kayit.hard_limit.rule) hatalar.push("sabit sinir tetiklendi ama kural yazilmamis");
  }
  if (kayit.irreversible === true && kayit.decision === "ALLOW") hatalar.push("geri alinamaz islem ALLOW olamaz");
  if (kayit.reliability === "kontrol-edilmedi" && kayit.decision === "ALLOW") hatalar.push("denetlenmemis ALLOW olamaz");
  if (kayit.decision === "ALLOW" && !kayit.binding) hatalar.push("ALLOW binding olmadan yazilamaz (ADR-007/1)");
  if (kayit.decision === "HUMAN_REQUIRED" && (!kayit.recorded_in || !kayit.gate_ref)) {
    hatalar.push("HUMAN_REQUIRED kaydi kapiya baglanmamis");
  }
  if (kayit.grant && kayit.grant.mode !== "tek-cagri" && !kayit.binding?.digest) {
    hatalar.push("yeniden kullanilabilir izin ozetsiz verilemez (ADR-007/3)");
  }
  return hatalar;
}

const OZET_A = `sha256:${"a".repeat(64)}`;
const OZET_B = `sha256:${"b".repeat(64)}`;

/** Kapi cagrilarini sayan sahte insan kapisi. Dosya sistemi yok. */
function sahteKapi() {
  const yazilanlar = [];
  const kapi = async (karar) => {
    yazilanlar.push(karar);
    const n = yazilanlar.length;
    return { recorded_in: `raporlar/ONAY-BEKLEYENLER.md#kayit-${n}`, gate_ref: `msg-${n}` };
  };
  kapi.yazilanlar = yazilanlar;
  return kapi;
}

function kur({ kapi = sahteKapi(), zamanlar } = {}) {
  let i = 0;
  const saat = zamanlar ? () => zamanlar[Math.min(i++, zamanlar.length - 1)] : undefined;
  return { kapi, yonetici: izinYoneticisi(saat ? { kapi, saat } : { kapi }) };
}

/** Kapsam ici, telafisi olan, ozeti bagli bir yazma istegi. */
function yazmaIstegi(fazladan = {}) {
  return {
    run_id: "kosu-2026-09-08-1455",
    step_id: "belge-yaz",
    requester: { kind: "agent", id: "kod-gozden-gecirici" },
    action: {
      tool: "Write",
      operation: "write",
      summary: "Mimari belgesini docs/mimari altina yaz",
      arguments_digest: OZET_A,
    },
    scope: ["D:/Repolar/ajans-os/docs/mimari/05-GUVENLIK.md"],
    irreversible: false,
    binding: { component: "claude-code:Write", version: "2.0", digest: OZET_B },
    izinli_kapsam: ["D:/Repolar/ajans-os/docs/"],
    ...fazladan,
  };
}

test("kapsam ici, ozeti bagli islem ALLOW doner ve belge sozlesmeye uyar", async () => {
  const { yonetici, kapi } = kur();
  const karar = await yonetici.karar(yazmaIstegi());

  assert.equal(karar.decision, "ALLOW");
  assert.equal(karar.reliability, "guclu");
  assert.deepEqual(semayaUyar(karar), []);
  assert.equal(kapi.yazilanlar.length, 0, "ALLOW icin insan kapisina yazilmamali");
});

test("HUMAN_REQUIRED bir belge doner, istisna atmaz; kapiya baglanir", async () => {
  const { yonetici, kapi } = kur();
  // Izinli kapsam verilmedi: "bakilmadi" ile "bakildi, temiz" ayri degerler.
  const istek = yazmaIstegi();
  delete istek.izinli_kapsam;

  const karar = await yonetici.karar(istek);

  assert.equal(karar.decision, "HUMAN_REQUIRED");
  assert.equal(karar.reliability, "zayif");
  assert.equal(karar.recorded_in, "raporlar/ONAY-BEKLEYENLER.md#kayit-1");
  assert.equal(karar.gate_ref, "msg-1");
  assert.equal(kapi.yazilanlar.length, 1);
  assert.deepEqual(semayaUyar(karar), []);
});

test("onay gelmeden ikinci cagri yine HUMAN_REQUIRED", async () => {
  const { yonetici, kapi } = kur();
  const istek = yazmaIstegi();
  delete istek.izinli_kapsam;

  const birinci = await yonetici.karar(istek);
  const ikinci = await yonetici.karar(istek);

  assert.equal(birinci.decision, "HUMAN_REQUIRED");
  assert.equal(ikinci.decision, "HUMAN_REQUIRED");
  assert.notEqual(birinci.decision_id, ikinci.decision_id, "her cagri kendi kaydini birakir");
  assert.equal(kapi.yazilanlar.length, 2, "her kapi kaydi ayri yazilir");
});

test("insan onayi sonrasi ayni cagri ALLOW olur, tavan dolunca yine kapiya duser", async () => {
  const { yonetici } = kur({
    zamanlar: [
      "2026-09-08T15:00:00+03:00", "2026-09-08T15:01:00+03:00",
      "2026-09-08T15:02:00+03:00", "2026-09-08T15:03:00+03:00", "2026-09-08T15:04:00+03:00",
    ],
  });
  const istek = yazmaIstegi();
  delete istek.izinli_kapsam;

  const kapida = await yonetici.karar(istek);
  const onay = await yonetici.onayi_isle(kapida.decision_id, "ALLOW", {
    mode: "oturum",
    expires_at: "2026-09-08T16:00:00+03:00",
    max_calls: 2,
  });
  assert.equal(onay.decision, "ALLOW");
  assert.equal(onay.supersedes, kapida.decision_id);
  assert.deepEqual(semayaUyar(onay), []);

  const birinci = await yonetici.karar(istek);
  assert.equal(birinci.decision, "ALLOW");
  assert.equal(birinci.supersedes, onay.decision_id);
  assert.ok(birinci.checks.some((c) => c.id === "insan-onayi" && c.result === "gecti"));
  assert.deepEqual(semayaUyar(birinci), []);

  const ikinci = await yonetici.karar(istek);
  assert.equal(ikinci.decision, "ALLOW");

  // max_calls: 2 tukendi.
  const ucuncu = await yonetici.karar(istek);
  assert.equal(ucuncu.decision, "HUMAN_REQUIRED", "tavan dolunca izin yeniden kullanilmaz");
});

test("suresi gecmis izin yeniden kullanilmaz", async () => {
  const { yonetici } = kur({
    zamanlar: [
      "2026-09-08T15:00:00+03:00", "2026-09-08T15:01:00+03:00", "2026-09-08T17:00:00+03:00",
    ],
  });
  const istek = yazmaIstegi();
  delete istek.izinli_kapsam;

  const kapida = await yonetici.karar(istek);
  await yonetici.onayi_isle(kapida.decision_id, "ALLOW", {
    mode: "sureli",
    expires_at: "2026-09-08T16:00:00+03:00",
    max_calls: 20,
  });

  const sonra = await yonetici.karar(istek);
  assert.equal(sonra.decision, "HUMAN_REQUIRED");
});

test("sabit sinir onayla asilmaz: silme onaydan sonra da ALLOW kaydi uretmez", async () => {
  const { yonetici } = kur();
  const istek = yazmaIstegi({
    action: { tool: "Bash", operation: "delete", summary: "Eski raporlari kalici sil" },
  });

  const kapida = await yonetici.karar(istek);
  assert.equal(kapida.decision, "HUMAN_REQUIRED");
  assert.deepEqual(kapida.hard_limit, { hit: true, rule: "kalici-silme" });
  assert.equal(kapida.severity, "yuksek");
  assert.deepEqual(semayaUyar(kapida), []);

  const onaydan = await yonetici.onayi_isle(kapida.decision_id, "ALLOW", { mode: "tek-cagri" });
  assert.equal(onaydan.decision, "HUMAN_REQUIRED", "sabit sinir kaydi ALLOW olamaz (ADR-005/1)");
  assert.deepEqual(semayaUyar(onaydan), []);

  // Ve onaydan sonra bile yeniden kullanilabilir izin dogmaz.
  const sonraki = await yonetici.karar(istek);
  assert.equal(sonraki.decision, "HUMAN_REQUIRED");
});

test("disari acilan islem sabit sinira girer", async () => {
  const { yonetici } = kur();
  const karar = await yonetici.karar(yazmaIstegi({
    action: { tool: "Bash", operation: "publish", summary: "git push origin master" },
    irreversible: true,
  }));
  assert.equal(karar.decision, "HUMAN_REQUIRED");
  assert.equal(karar.hard_limit.rule, "disari-yayin-gonderim");
});

test("geri alinamaz islem ALLOW olamaz, onaydan sonra da olmaz", async () => {
  const { yonetici } = kur();
  const istek = yazmaIstegi({ irreversible: true });

  const kapida = await yonetici.karar(istek);
  assert.equal(kapida.decision, "HUMAN_REQUIRED");
  assert.equal(kapida.hard_limit.hit, false, "geri alinamazlik sabit sinirdan ayri bir eksendir");

  const onaydan = await yonetici.onayi_isle(kapida.decision_id, "ALLOW");
  assert.equal(onaydan.decision, "HUMAN_REQUIRED");
  assert.deepEqual(semayaUyar(onaydan), []);
});

test("insan BLOCK derse karar BLOCK olur ve eski kaydi gecersiz kilar", async () => {
  const { yonetici } = kur();
  const istek = yazmaIstegi();
  delete istek.izinli_kapsam;

  const kapida = await yonetici.karar(istek);
  const red = await yonetici.onayi_isle(kapida.decision_id, "BLOCK");

  assert.equal(red.decision, "BLOCK");
  assert.equal(red.supersedes, kapida.decision_id);
  assert.deepEqual(semayaUyar(red), []);
  await assert.rejects(() => yonetici.onayi_isle(kapida.decision_id, "ALLOW"), /zaten sonuclandirildi/);
});

test("kapsam disi hedef BLOCK doner, kapiya yazilmaz", async () => {
  const { yonetici, kapi } = kur();
  const karar = await yonetici.karar(yazmaIstegi({
    scope: ["D:/Repolar/turkce-ajanlar/README.md"],
  }));

  assert.equal(karar.decision, "BLOCK");
  assert.ok(karar.checks.some((c) => c.id === "kapsam-eslesme" && c.result === "kaldi"));
  assert.equal(kapi.yazilanlar.length, 0);
  assert.deepEqual(semayaUyar(karar), []);
});

test("guvenilirlik istekten okunmaz, denetleyicilerden turer", async () => {
  const { yonetici } = kur();
  const istek = yazmaIstegi({ reliability: "guclu", checks: [] });
  delete istek.izinli_kapsam;

  const karar = await yonetici.karar(istek);

  assert.equal(karar.reliability, "zayif", "cagiran 'kontrol ettim, temizdi' diyemez (D11)");
  assert.equal(karar.decision, "HUMAN_REQUIRED");
});

test("siddet yukseltilebilir, dusurulemez", async () => {
  const { yonetici } = kur();
  const dusuk = await yonetici.karar(yazmaIstegi({ severity: "dusuk" }));
  assert.equal(dusuk.severity, "orta", "write en az 'orta' siddettedir");

  const yuksek = await yonetici.karar(yazmaIstegi({ severity: "yuksek" }));
  assert.equal(yuksek.severity, "yuksek");
});

test("golge denetleyici tek basina karari degistirmez", async () => {
  const { yonetici } = kur();
  const karar = await yonetici.karar(yazmaIstegi({
    checks: [{ id: "prompt-enjeksiyon-sezgisi", result: "kaldi", detail: "Golge modda.", shadow: true }],
  }));

  assert.equal(karar.decision, "ALLOW", "olculmemis detektor yetki almaz (kural 6)");
  assert.equal(karar.reliability, "guclu");
  assert.ok(karar.checks.some((c) => c.shadow === true), "golge sinyal yine de kayda gecer");
});

test("bozuk istek karar degil istisna uretir", async () => {
  const { yonetici } = kur();
  // ADR-005/3: kapsam belirtilmemisse sonuc bos kumedir, "hepsi" degil.
  await assert.rejects(() => yonetici.karar(yazmaIstegi({ scope: [] })), /scope/);
  await assert.rejects(() => yonetici.karar(yazmaIstegi({ action: { tool: "X", operation: "sudo", summary: "abc" } })), /izin sinifi/);
  await assert.rejects(() => yonetici.karar(yazmaIstegi({ sabit_sinir: "her-seye-evet" })), /sabit sinir/);
});

test("kapisiz izin yoneticisi kurulamaz", () => {
  assert.throws(() => izinYoneticisi({}), /kapi/);
});

test("yeniden kullanilabilir izin ozetsiz ve tavansiz verilemez", async () => {
  const { yonetici } = kur();
  const istek = yazmaIstegi();
  delete istek.izinli_kapsam;
  const kapida = await yonetici.karar(istek);

  await assert.rejects(
    () => yonetici.onayi_isle(kapida.decision_id, "ALLOW", { mode: "sureli" }),
    /expires_at/,
  );
});

test("kayit disina cikan degisiklik icerideki karari bozmaz", async () => {
  const { yonetici } = kur();
  const istek = yazmaIstegi();
  delete istek.izinli_kapsam;

  const karar = await yonetici.karar(istek);
  karar.decision = "ALLOW";
  karar.scope.push("C:/");

  const ikinci = await yonetici.karar(istek);
  assert.equal(ikinci.decision, "HUMAN_REQUIRED");
  assert.deepEqual(ikinci.scope, istek.scope);
});
