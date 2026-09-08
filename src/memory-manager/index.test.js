/**
 * U5 kabul testleri — Memory Manager.
 *
 * Olcut mutlu yol degil, 03-BELLEK.md'den gelen kisit:
 *   1. `ALLOW` olmayan kararla `yaz` **yazmaz** — depo cagri oncesiyle ayni
 *      kalir; baska bir islem icin verilmis `ALLOW` da yetki degildir,
 *   2. `project` / `global` katmanlari insan kapisindan gecmemis bir `ALLOW`
 *      ile yazilamaz (03-BELLEK §3, kalici sinif),
 *   3. gecersiz kilinan kayit `oku`'dan **donmez** ama silinmez de:
 *      `gecmis: true` ile hala orada (§4),
 *   4. kapsam belirtilmemis okuma bos kume dondurur, "hepsi" degil
 *      (AP6 → kural 7),
 *   5. katman cakismasinda dar olan once doner (§4),
 *   6. yeni kayit gecersiz dogamaz ve donen kayit deponun kopyasidir.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { bellekYoneticisi } from "./index.js";

/**
 * Permission Manager'in urettigi belgenin bu modul icin baglayici kismi.
 * Tam sema dogrulamasi U4'un testinde; buradaki is karar belgesini **girdi**
 * olarak kullanmak.
 */
function karar({ decision = "ALLOW", operation = "memory_write", supersedes } = {}) {
  const belge = {
    contract_version: "1.0.0",
    decision_id: `karar-${Math.random().toString(36).slice(2, 8)}`,
    run_id: "kosu-u5",
    at: "2026-09-08T16:00:00Z",
    requester: { id: "ajan-yazar", kind: "agent" },
    action: { tool: "memory", operation, summary: "bellege yazma" },
    scope: ["bellek/session"],
    irreversible: false,
    decision,
    reason: "test",
  };
  if (supersedes) belge.supersedes = supersedes;
  return belge;
}

const KAYIT = { katman: "session", icerik: "Kullanici PowerShell 5.1 kullaniyor." };

test("ALLOW olmayan kararla yaz yazmiyor — depo degismiyor", async () => {
  const bellek = bellekYoneticisi();

  for (const deger of ["BLOCK", "HUMAN_REQUIRED"]) {
    await assert.rejects(
      () => bellek.yaz(KAYIT, karar({ decision: deger })),
      new RegExp(`karar '${deger}'`),
    );
  }
  await assert.rejects(() => bellek.yaz(KAYIT, undefined), /izin karari belgesi zorunlu/);

  assert.deepEqual(await bellek.oku({ katmanlar: ["session"], gecmis: true }), []);
});

test("baska bir islem icin verilmis ALLOW bellege yazma yetkisi degil", async () => {
  const bellek = bellekYoneticisi();

  await assert.rejects(
    () => bellek.yaz(KAYIT, karar({ operation: "write" })),
    /bellege yazma yetkisi degil/,
  );
  assert.deepEqual(await bellek.oku({ katmanlar: ["session"], gecmis: true }), []);
});

test("project/global insan kapisindan gecmemis ALLOW ile yazilamaz", async () => {
  const bellek = bellekYoneticisi();

  for (const katman of ["project", "global"]) {
    await assert.rejects(
      () => bellek.yaz({ katman, icerik: "kalici olgu" }, karar()),
      /insan kapisina duser/,
    );
  }
  // Kapidan gecmis karar (`supersedes` = kapiya dusen eski kayit) yazar.
  const yazildi = await bellek.yaz(
    { katman: "project", icerik: "kalici olgu" },
    karar({ supersedes: "karar-kapi-0001" }),
  );
  assert.equal(yazildi.katman, "project");
  assert.equal((await bellek.oku({ katmanlar: ["project"] })).length, 1);
});

test("gecersiz kilinan kayit okumadan dusuyor ama silinmiyor", async () => {
  const bellek = bellekYoneticisi();

  const eski = await bellek.yaz({ katman: "session", icerik: "Ali vegan." }, karar());
  const yeni = await bellek.yaz({ katman: "session", icerik: "Ali et yiyor." }, karar());
  await bellek.gecersiz_kil(eski.id, yeni.id, karar());

  const gecerli = await bellek.oku({ katmanlar: ["session"] });
  assert.deepEqual(
    gecerli.map((k) => k.id),
    [yeni.id],
    "gecersiz kilinan kayit varsayilan okumada donmemeli",
  );

  // Silme degil: kayit yerinde, gecersizlik izi uzerinde.
  const hepsi = await bellek.oku({ katmanlar: ["session"], gecmis: true });
  const kalan = hepsi.find((k) => k.id === eski.id);
  assert.equal(kalan.icerik, "Ali vegan.");
  assert.equal(kalan.yerine_gecen, yeni.id);
  assert.match(kalan.gecersiz_kilindi, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

  // Ayni kayit ikinci kez gecersiz kilinamaz; olmayan kayda da baglanamaz.
  await assert.rejects(() => bellek.gecersiz_kil(eski.id, yeni.id, karar()), /zaten gecersiz/);
  await assert.rejects(() => bellek.gecersiz_kil(yeni.id, "bellek-yok-0009", karar()), /yerine gecen kayit yok/);
  await assert.rejects(() => bellek.gecersiz_kil(yeni.id, yeni.id, karar()), /kendini gecersiz kilamaz/);
});

test("gecersiz_kil de ALLOW ister — reddedilen karar kaydi bozmuyor", async () => {
  const bellek = bellekYoneticisi();
  const a = await bellek.yaz({ katman: "task", icerik: "birinci" }, karar());
  const b = await bellek.yaz({ katman: "task", icerik: "ikinci" }, karar());

  await assert.rejects(
    () => bellek.gecersiz_kil(a.id, b.id, karar({ decision: "BLOCK" })),
    /karar 'BLOCK'/,
  );
  assert.equal((await bellek.oku({ katmanlar: ["task"] })).length, 2);
});

test("kapsam belirtilmemis okuma bos kume dondurur", async () => {
  const bellek = bellekYoneticisi();
  await bellek.yaz(KAYIT, karar());

  assert.deepEqual(await bellek.oku({ katmanlar: [] }), []);
  assert.deepEqual(await bellek.oku({}), []);
  assert.deepEqual(await bellek.oku(undefined), []);
  await assert.rejects(() => bellek.oku({ katmanlar: ["takim"] }), /gecersiz katman/);
});

test("katman cakismasinda dar olan once doner", async () => {
  const bellek = bellekYoneticisi();
  await bellek.yaz({ katman: "knowledge", icerik: "spec kopyasi" }, karar());
  await bellek.yaz({ katman: "session", icerik: "oturum ozeti" }, karar());
  await bellek.yaz({ katman: "task", icerik: "adim ciktisi" }, karar());

  const sonuc = await bellek.oku({ katmanlar: ["knowledge", "session", "task"] });
  assert.deepEqual(
    sonuc.map((k) => k.katman),
    ["task", "session", "knowledge"],
  );
  assert.equal((await bellek.oku({ katmanlar: ["task", "session"], limit: 1 }))[0].katman, "task");
});

test("metin suzgeci buyuk/kucuk harf ayirt etmiyor", async () => {
  const bellek = bellekYoneticisi();
  await bellek.yaz({ katman: "task", icerik: "ISTANBUL raporu hazir" }, karar());

  // Yerel verilseydi icerik "ıstanbul"a inerdi ve bu sorgu eslesmezdi.
  assert.equal((await bellek.oku({ katmanlar: ["task"], metin: "istanbul" })).length, 1);
  assert.equal((await bellek.oku({ katmanlar: ["task"], metin: "RAPORU" })).length, 1);
  assert.equal((await bellek.oku({ katmanlar: ["task"], metin: "ankara" })).length, 0);
});

test("yeni kayit gecersiz dogamaz, donen kayit deponun kopyasidir", async () => {
  const bellek = bellekYoneticisi();

  await assert.rejects(
    () => bellek.yaz({ ...KAYIT, gecersiz_kilindi: "2026-01-01T00:00:00Z" }, karar()),
    /gecersiz dogamaz/,
  );
  await assert.rejects(
    () => bellek.yaz({ ...KAYIT, yerine_gecen: "bellek-session-0002" }, karar()),
    /gecersiz dogamaz/,
  );
  await assert.rejects(() => bellek.yaz({ katman: "session" }, karar()), /'icerik' zorunlu/);
  await assert.rejects(() => bellek.yaz({ katman: "yok", icerik: "x" }, karar()), /gecersiz katman/);

  const yazildi = await bellek.yaz(KAYIT, karar());
  yazildi.icerik = "disaridan degistirildi";
  const okunan = await bellek.oku({ katmanlar: ["session"] });
  assert.equal(okunan[0].icerik, KAYIT.icerik);
  assert.match(okunan[0].id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.match(okunan[0].yazildi, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});
