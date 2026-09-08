// Observability testi (U12). Olcut YOL-HARITASI.md U12: "yazma hatasinda
// `span_yaz` istisna atmiyor, kosu dusmuyor" + 04-UYGULAMA-YOL-HARITASI.md:
// "yazilan span span.schema.json'a uyar" ve uretilen iz okunabilir.
//
// Mimariden gelen kisit (mutlu yol degil): yazma hatasi benzetimi. Iz klasoru
// yerine ayni adda bir DOSYA birakilir; `mkdirSync` ENOTDIR ile duser. Cagiran
// bunu hic gormemeli — 06-GOZLEM D1'in tek olculebilir sonucu budur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { gozlemci } from "./index.js";

const kok = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function gecici() {
  return mkdtempSync(join(tmpdir(), "ajans-os-u12-"));
}

/** contracts/span.schema.json'un zorunlu alanlarini tasiyan en kucuk span. */
function ornekSpan(ekstra = {}) {
  return {
    contract_version: "1.0",
    span_id: "span-kok",
    trace_id: "kosu-u12-deneme",
    parent_span_id: null,
    run_id: "kosu-u12-deneme",
    operation: "run",
    name: "run u12-deneme",
    started_at: "2020-01-01T00:00:00Z", // gecmiste sabit: duration_ms her kosuda pozitif
    outcome: { status: "ok" },
    ...ekstra,
  };
}

test("yazma hatasinda span_yaz istisna atmiyor, kosu dusmuyor", () => {
  const kokDizin = gecici();
  // Iz klasorunun yerinde bir dosya var: mkdirSync ENOTDIR verir.
  const engel = join(kokDizin, "izler");
  writeFileSync(engel, "bu bir klasor degil\n", "utf8");

  const g = gozlemci({ dizin: engel });

  let kosuDustu = false;
  try {
    g.span_yaz(ornekSpan());
    const kapat = g.span_ac(ornekSpan({ span_id: "span-alt" }));
    kapat({ status: "hata", error_type: "IC_HATA", error_message: "deneme" });
  } catch {
    kosuDustu = true;
  }
  assert.equal(kosuDustu, false, "span yazimi kosuyu dusuremez (06-GOZLEM D1)");
});

test("bozuk span sessizce dusuruluyor, gecerli span yaziliyor", async () => {
  const g = gozlemci({ dizin: join(gecici(), "izler") });

  g.span_yaz(null);
  g.span_yaz("span degil");
  g.span_yaz(ornekSpan({ run_id: "GECERSIZ Kimlik" })); // kebab_id degil
  g.span_yaz(ornekSpan());

  const izler = await g.kosu_izleri("kosu-u12-deneme");
  assert.equal(izler.length, 1);
  assert.equal(izler[0].span_id, "span-kok");
});

test("span_ac acilis kaydini yazar, kapanis onu bastirir", async () => {
  const g = gozlemci({ dizin: join(gecici(), "izler") });

  const kapatilmayan = g.span_ac(ornekSpan({ span_id: "span-yarim" }));
  assert.equal(typeof kapatilmayan, "function");

  const kapat = g.span_ac(ornekSpan({ span_id: "span-tam" }));
  kapat({ status: "ok" });

  const izler = await g.kosu_izleri("kosu-u12-deneme");
  const bul = (id) => izler.find((s) => s.span_id === id);
  assert.equal(izler.length, 2, "ayni span_id iki kez sayilmaz");
  assert.equal(bul("span-yarim").outcome.status, "kesildi", "kapatilmayan span kesildi kalir");
  assert.equal(bul("span-tam").outcome.status, "ok");
  assert.equal(typeof bul("span-tam").ended_at, "string");
  assert.equal(typeof bul("span-tam").duration_ms, "number");
});

test("olculemeyen sure null, sifir degil (kural 11)", async () => {
  const g = gozlemci({ dizin: join(gecici(), "izler") });

  const kapat = g.span_ac(ornekSpan({ span_id: "span-suresiz", started_at: "olcusuz" }));
  kapat({ status: "ok" });

  const [span] = await g.kosu_izleri("kosu-u12-deneme");
  assert.equal(span.duration_ms, null);
});

test("bozuk satir izin geri kalanini okunamaz yapmiyor", async () => {
  const g = gozlemci({ dizin: join(gecici(), "izler") });

  g.span_yaz(ornekSpan({ span_id: "span-bir" }));
  // Yarim yazilmis satir benzetimi: dosyaya elle bozuk JSON eklenir.
  appendFileSync(g.iz_yolu("kosu-u12-deneme"), `{yarim${String.fromCharCode(10)}`, "utf8");
  g.span_yaz(ornekSpan({ span_id: "span-iki" }));

  const izler = await g.kosu_izleri("kosu-u12-deneme");
  assert.deepEqual(izler.map((s) => s.span_id).sort(), ["span-bir", "span-iki"]);
});

test("iz olmayan kosu bos dizi doner", async () => {
  const g = gozlemci({ dizin: join(gecici(), "izler") });
  assert.deepEqual(await g.kosu_izleri("hic-olmayan-kosu"), []);
});

test("uretilen span span.schema.json'a uyuyor (arac/sema-dogrula.js)", async () => {
  const dizin = join(gecici(), "izler");
  const g = gozlemci({ dizin });

  const kapat = g.span_ac(
    ornekSpan({
      span_id: "span-cikarim",
      parent_span_id: "span-kok",
      operation: "inference",
      name: "chat claude-opus-5",
      actor: { kind: "orchestrator", id: "orkestrator" },
      model: { provider: "anthropic", name: "claude-opus-5" },
      usage: { input_tokens: 120, output_tokens: 40 },
      cost: {
        usd: null,
        price_table: { version: "0.0.0", digest: `sha256:${"0".repeat(64)}` },
        unknown_reason: "fiyat-tablosunda-yok",
      },
      shadow: false,
      content_recording: "kapali",
    }),
  );
  kapat({ status: "ok" });

  const izler = await g.kosu_izleri("kosu-u12-deneme");
  assert.equal(izler.length, 1);

  // Sema dogrulayicisi tek JSON belgesi okur; span'i dosyaya cikarip veriyoruz.
  const tekil = join(dizin, "span.json");
  writeFileSync(tekil, `${JSON.stringify(izler[0], null, 2)}\n`, "utf8");
  execFileSync(process.execPath, ["arac/sema-dogrula.js", "--dosya", tekil, "--sema", "span.schema.json"], {
    cwd: kok,
    stdio: "pipe",
  });
});
