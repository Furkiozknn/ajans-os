/**
 * U3 kabul testleri — Tool Registry.
 *
 * Olcut mutlu yol degil, mimariden gelen kisit:
 *   1. izin sinifi **kayittan** okunur, arac adindan turetilmez
 *      (adi `read_*` olan ama kayitta `write` yazan arac `write` doner),
 *   2. gecersiz arguman reddedilir, gecerli olan gecer (MCP inputSchema),
 *   3. gecersiz kayit sessizce atlanmaz — kurulum istisna atar,
 *   4. kayit disina cikan degisiklik icerideki kaydi bozmaz.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { aracKaydi } from "./index.js";

/** MCP'den gelmis gibi bir arac tanimi. Yeni sozlesme yok, JSON Schema var. */
const DOSYA_YAZ = {
  tanim: {
    name: "read_or_write_file", // ad yaniltici: "read" ile basliyor
    description: "Bir dosyaya yazar.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["yol", "icerik"],
      properties: {
        yol: { type: "string", minLength: 1 },
        icerik: { type: "string" },
        kip: { type: "string", enum: ["yaz", "ekle"] },
      },
    },
  },
  operation: "write", // kaynak burasi
  irreversible: false,
  kaynak: "mcp:filesystem",
};

const ARA = {
  tanim: {
    name: "search",
    inputSchema: {
      type: "object",
      required: ["sorgu"],
      properties: { sorgu: { type: "string" }, adet: { type: "integer", minimum: 1, maximum: 50 } },
    },
  },
  operation: "network",
  irreversible: false,
  kaynak: "mcp:web",
};

const kur = (ek = {}) => aracKaydi({ kayitlar: [DOSYA_YAZ, ARA], ...ek });

test("izin sinifi kayittan okunur, arac adindan turetilmez", async () => {
  const k = await kur().getir("read_or_write_file");
  // Ad `read` ile basliyor; kayitta `write` yaziyor. Kayit kazanir.
  assert.equal(k.operation, "write");
  assert.equal(k.kaynak, "mcp:filesystem");

  // Ayni sekilde ters yon: adi "search" olan arac ad desenine gore "read"
  // sayilirdi; kayitta `network` yaziyor.
  assert.equal((await kur().getir("search")).operation, "network");
});

test("bilinmeyen arac null doner, listele hepsini verir", async () => {
  assert.equal(await kur().getir("yok_boyle_bir_arac"), null);
  assert.deepEqual((await kur().listele()).map((k) => k.tanim.name), ["read_or_write_file", "search"]);
});

test("listele(agent_id) sozlesmedeki araclari cozer, cozemedigini sessizce dusurmez", async () => {
  const kayit = kur({ ajan_araclari: { yazar: ["search"], kirik: ["hayalet_arac"] } });
  assert.deepEqual((await kayit.listele("yazar")).map((k) => k.tanim.name), ["search"]);
  await assert.rejects(() => kayit.listele("kirik"), /hayalet_arac/);
  await assert.rejects(() => kayit.listele("tanimsiz-ajan"), /arac eslemi yok/);
});

test("argumanlar MCP semasina gore dogrulanir", () => {
  const kayit = kur();
  assert.deepEqual(
    kayit.argumanlari_dogrula("read_or_write_file", { yol: "a.txt", icerik: "x" }),
    { gecerli: true, hatalar: [] },
  );

  const eksik = kayit.argumanlari_dogrula("read_or_write_file", { yol: "a.txt" });
  assert.equal(eksik.gecerli, false);
  assert.match(eksik.hatalar.join(" "), /icerik/);

  const yanlisTip = kayit.argumanlari_dogrula("read_or_write_file", { yol: 1, icerik: "x" });
  assert.equal(yanlisTip.gecerli, false);

  const fazlaAlan = kayit.argumanlari_dogrula("read_or_write_file", { yol: "a", icerik: "x", ekstra: 1 });
  assert.equal(fazlaAlan.gecerli, false);

  const kotuEnum = kayit.argumanlari_dogrula("read_or_write_file", { yol: "a", icerik: "x", kip: "sil" });
  assert.equal(kotuEnum.gecerli, false);

  assert.equal(kayit.argumanlari_dogrula("search", { sorgu: "x", adet: 100 }).gecerli, false);
  assert.equal(kayit.argumanlari_dogrula("search", { sorgu: "x", adet: 2 }).gecerli, true);

  // Kayitli olmayan arac: istisna degil, gerekce iceren red.
  const yok = kayit.argumanlari_dogrula("yok", {});
  assert.equal(yok.gecerli, false);
  assert.match(yok.hatalar[0], /kayitli degil/);
});

test("gecersiz kayit sessizce atlanmaz", () => {
  const bozuk = (uzerine) => () => aracKaydi({ kayitlar: [{ ...DOSYA_YAZ, ...uzerine }] });
  assert.throws(bozuk({ operation: "yazma" }), /gecersiz izin sinifi/);
  assert.throws(bozuk({ irreversible: "evet" }), /irreversible/);
  assert.throws(bozuk({ kaynak: "" }), /kaynak/);
  assert.throws(bozuk({ tanim: { name: "x" } }), /inputSchema/);
  assert.throws(() => aracKaydi({ kayitlar: [DOSYA_YAZ, DOSYA_YAZ] }), /zaten kayitli/);

  // Semada bilinmeyen anahtar kelime: sessizce gecmek "dogrulamadim" demektir.
  const tuhaf = aracKaydi({
    kayitlar: [{ ...ARA, tanim: { name: "s", inputSchema: { type: "object", allOf: [] } } }],
  });
  assert.throws(() => tuhaf.argumanlari_dogrula("s", {}), /desteklenmeyen sema anahtari/);
});

test("disari verilen kayit degistirilse de kayit bozulmaz", async () => {
  const kayit = kur();
  const k = await kayit.getir("read_or_write_file");
  k.operation = "read";
  assert.equal((await kayit.getir("read_or_write_file")).operation, "write");
});
