/**
 * U14 — uctan uca kabul kosusu.
 *
 * Faz 5'in kapanis kanitidir: 13 modulun **gercek** uygulamalari elle baglanir,
 * tek bir gorev bastan sona kosar ve kosunun urettigi her belge deponun kendi
 * dogrulayicisindan (`arac/sema-dogrula.js`) gecirilir. Sahte olan tek sey
 * `ModelTasiyici`dir (yol haritasi §3: testler aga cikmaz, gercek LLM cagirmaz);
 * gorev yoneticisi, izin yoneticisi, gozlem ve digerleri gercek koddur.
 *
 * Uc olcut olculur:
 *   1. Kosu biter (`son === "bitti"`) ve adim kayitlari BITTI'dir.
 *   2. Uretilen her belge semasindan gecer: gorev kaydi (task.schema.json),
 *      her izin karari (permission.schema.json), her span (span.schema.json).
 *   3. Kosu ortasindan oldurulup `kosuyu_surdur` ile devam ettirildiginde yan
 *      etki **tekrarlanmaz** (D1 amnezisinin kapanis kanitl). "Oldurme" burada
 *      benzetim degil: birinci faz yalnizca `adimi_yurut` cagirir ve biter,
 *      ikinci faz gorevi **diskten** yeniden yukleyip yeni bir orkestrator ile
 *      surdurur — surec olseydi elde kalacak sey tam olarak budur.
 *
 * Yan etki gozlemi: sahte tasiyici her cagrisinda `yan-etki.log` dosyasina bir
 * satir yazar. Tekrarlanan bir adim ikinci satiri dusururdu; sayim bu yuzden
 * "tekrarlanmadi" iddiasinin olculebilir karsiligidir.
 *
 * Kapsam disi (yol haritasi U14): basarim olcumu, coklu gorev, es zamanlilik.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ajanKaydi } from "./agent-registry/index.js";
import { aracKaydi } from "./tool-registry/index.js";
import { baglamYoneticisi } from "./context-manager/index.js";
import { bellekYoneticisi } from "./memory-manager/index.js";
import { degerlendirici } from "./evaluator/index.js";
import { elestirmen } from "./critic/index.js";
import { gorevYoneticisi } from "./task-manager/index.js";
import { gozlemci } from "./observability/index.js";
import { izinYoneticisi } from "./permission-manager/index.js";
import { kurtarmaYoneticisi } from "./recovery-manager/index.js";
import { maliyetYoneticisi } from "./cost-manager/index.js";
import { modelYonlendirici } from "./model-router/index.js";
import { orkestrator } from "./orchestrator/index.js";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEMA_DOGRULA = join(KOK, "arac", "sema-dogrula.js");

const TASK_ID = "kabul-kosusu";
const RUN_ID = "kosu-kabul-0001";
const AJAN_ID = "kabul-yazari";

/**
 * Fiyat tablosunun kimligi (span.schema.json `cost.price_table`). Tabloyu
 * bilesim koku yukler, kimligini de o bilir; orkestrator dosyaya bakmaz.
 */
function fiyatKimligi() {
  const ham = readFileSync(join(KOK, "veri", "fiyat-tablosu.json"), "utf8");
  return {
    version: String(JSON.parse(ham).surum),
    digest: `sha256:${createHash("sha256").update(ham).digest("hex")}`,
  };
}

/** `arac/sema-dogrula.js --dosya`; cikis kodu 0 degilse test duser. */
function semadanGecir(dosya, sema) {
  return execFileSync(process.execPath, [SEMA_DOGRULA, "--dosya", dosya, "--sema", sema], {
    encoding: "utf8",
  });
}

/**
 * Kosunun ajani. Depodaki ornek sozlesme bir **inceleyicidir** ve yazma izni
 * yoktur (`permissions.filesystem.write: []`); kabul kosusu yazan bir adim
 * icerdigi icin sozlesme kopyalanip yalnizca kimligi ve yazma kapsami
 * degistirilir. Sozlesme yine `contracts/agent.schema.json`a gore dogrulanir —
 * ajan defteri gercek, dogrulama gercek.
 */
function ajanSozlesmesiYaz(dizin) {
  const kaynak = JSON.parse(
    readFileSync(join(KOK, "contracts", "ornek", "kod-gozden-gecirici.json"), "utf8"),
  );
  kaynak.identity.id = AJAN_ID;
  kaynak.identity.name = "Kabul kosusu yazari";
  kaynak.role.kind = "specialist";
  kaynak.permissions.filesystem.write = ["kabul/"];
  writeFileSync(join(dizin, `${AJAN_ID}.json`), JSON.stringify(kaynak, null, 2));
}

/** Iki adimlik gorev: biri arac cagiran (izin kapisi), biri saf model adimi. */
function gorevSozlesmesi() {
  const adim = (id, title, ekler) => ({
    id,
    title,
    assign: { mode: "agent", agent_id: AJAN_ID },
    depends_on: [],
    evaluation: { method: "deterministic", checker: "node arac/sema-dogrula.js --test" },
    retry: { max_attempts: 2, mode: "duzelt", backoff: "yok", max_critique_items: 4 },
    side_effects: true,
    compensation: {
      method: "Yazilan dosya kabul/_eski/ altina tasinir; kosu gecici klasorde durdugu icin depoya dokunmaz.",
      on_impossible: "human-gate",
    },
    on_failure: "dur",
    ...ekler,
  });

  return {
    contract_version: "1.0",
    task: {
      id: TASK_ID,
      title: "Uctan uca kabul kosusu",
      goal: "Gercek modullerle tek gorevlik bir kosu yurut; uretilen her belgeyi semasindan gecir.",
      source: "docs/04-UYGULAMA-YOL-HARITASI.md#u14",
      created_at: "2026-09-08T18:53:00+03:00",
      budget: { max_usd: 6, on_exceed: "stop", spent_usd: null },
      labels: ["faz-5", "kabul"],
    },
    graph: {
      steps: [
        adim("rapor-yaz", "Kabul raporu dosyaya yazilir", { writes: ["kabul/rapor.md"] }),
        adim("ozet-yaz", "Kosunun ozeti cikarilir", {
          depends_on: ["rapor-yaz"],
          writes: ["kabul/ozet.md"],
        }),
      ],
    },
    run: { run_id: RUN_ID, started_at: "2026-09-08T18:53:10+03:00", step_records: [] },
  };
}

/**
 * Sahte `ModelTasiyici` — kosudaki tek sahte. Iki isi var: adima gore icerik
 * uretmek ve **yan etkiyi gorunur kilmak** (her cagri log dosyasina bir satir).
 * Kanitlar `Kanit` tipindedir; LLM metni degerlendiriciye giremez (ADR-004).
 */
function sahteTasiyici(yanEtkiLog) {
  return {
    saglayici: "sahte",
    async cagir(secim, istem) {
      const adim_id = istem.adim.id;
      appendFileSync(yanEtkiLog, `${adim_id}\n`);
      const icerik =
        adim_id === "rapor-yaz"
          ? {
              arac_cagrisi: {
                ad: "dosya-yaz",
                argumanlar: { yol: "kabul/rapor.md", icerik: "kabul kosusu raporu" },
              },
              kanitlar: [{ tur: "cikis_kodu", kod: 0 }],
            }
          : { kanitlar: [{ tur: "test", gecen: 2, kalan: 0 }] };
      return {
        model_id: secim.model_id,
        icerik,
        usage: { input_tokens: 1200, output_tokens: 300 },
        cost: {},
      };
    },
  };
}

/** Gercek 12 modul + sahte tasiyici; orkestratorun bagimlilik demeti. */
async function kur(tmp) {
  const ajanlar = join(tmp, "ajanlar");
  const gorevler = join(tmp, "gorevler");
  const izler = join(tmp, "izler");
  const izinler = join(tmp, "izin");
  for (const d of [ajanlar, gorevler, izler, izinler]) mkdirSync(d, { recursive: true });
  ajanSozlesmesiYaz(ajanlar);

  const yanEtkiLog = join(tmp, "yan-etki.log");
  writeFileSync(yanEtkiLog, "");
  const kapiDosyasi = join(tmp, "ONAY-BEKLEYENLER.md");

  const gercekIzin = izinYoneticisi({
    async kapi(karar) {
      appendFileSync(kapiDosyasi, `- ${karar.decision_id}: ${karar.reason}\n`);
      return { recorded_in: kapiDosyasi, gate_ref: `kapi:${karar.decision_id}` };
    },
  });

  // Izin yoneticisi diske dokunmaz (ADR-002). Kararlar belge olarak
  // denetlenebilsin diye kabul kosusu onlari kendisi kaydeder — sahteleme
  // degil, kayit katmani.
  const izin_yoneticisi = {
    ...gercekIzin,
    async karar(istek) {
      const karar = await gercekIzin.karar(istek);
      writeFileSync(join(izinler, `${karar.decision_id}.json`), JSON.stringify(karar, null, 2));
      return karar;
    },
  };

  const gozlem = gozlemci({ dizin: izler });
  const bagimliliklar = {
    gorev_yoneticisi: gorevYoneticisi({ dizin: gorevler }),
    ajan_defteri: ajanKaydi({ dizin: ajanlar }),
    arac_defteri: aracKaydi({
      kayitlar: [
        {
          tanim: {
            name: "dosya-yaz",
            description: "Verilen yola metin yazar.",
            inputSchema: {
              type: "object",
              required: ["yol", "icerik"],
              properties: { yol: { type: "string" }, icerik: { type: "string" } },
              additionalProperties: false,
            },
          },
          operation: "write",
          irreversible: false,
          kaynak: "yerlesik",
        },
      ],
    }),
    izin_yoneticisi,
    bellek_yoneticisi: bellekYoneticisi(),
    baglam_yoneticisi: baglamYoneticisi(),
    degerlendirici: degerlendirici(),
    elestirmen: elestirmen({
      cagir: async () => ({ items: [] }),
    }),
    kurtarma_yoneticisi: kurtarmaYoneticisi({ rastgele: () => 0 }),
    model_yonlendirici: modelYonlendirici({
      katalog: [
        {
          model_id: "ornek-kucuk",
          saglayici: "sahte",
          yetenekler: ["arac-cagirma", "ucuz"],
          baglam_token: 200000,
        },
      ],
      tasiyicilar: [sahteTasiyici(yanEtkiLog)],
    }),
    maliyet_yoneticisi: maliyetYoneticisi({ tavan_usd: 6 }),
    gozlem,
  };
  // Fiyat tablosu koda gomulu degil (kural 11); bilesim koku onu yukler.
  await bagimliliklar.maliyet_yoneticisi.tablo_yukle();

  return { bagimliliklar, gozlem, izinler, izler, yanEtkiLog, gorevler };
}

test("U14: uctan uca kabul kosusu — oldurulup surdurulunce yan etki tekrarlanmiyor", async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "ajans-os-kabul-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  const { bagimliliklar, gozlem, izinler, yanEtkiLog } = await kur(tmp);
  const gorevYon = bagimliliklar.gorev_yoneticisi;

  // --- Faz 1: kosu baslar ve ilk adimdan sonra "olduruluyor" ----------------
  const gorev = await gorevYon.olustur(gorevSozlesmesi());
  const ilk = await orkestrator(bagimliliklar, { fiyat_tablosu: fiyatKimligi() }).adimi_yurut(gorev, "rapor-yaz");
  assert.equal(ilk.status, "BITTI", `ilk adim bitmeliydi: ${JSON.stringify(ilk)}`);
  assert.equal(ilk.evaluation_result, "GECTI");
  assert.ok(ilk.approval_ref, "arac cagiran adim izin kararina bagli olmali");

  // --- Faz 2: yeni surec — gorev diskten yuklenir, kosu surdurulur ----------
  const diskten = await gorevYon.yukle(TASK_ID);
  assert.ok(diskten, "gorev kaydi diskte olmali");
  assert.equal(diskten.run.step_records.length, 1, "kayit yalnizca ilk adimi tasimali");

  const sonuc = await orkestrator(bagimliliklar, { fiyat_tablosu: fiyatKimligi() }).kosuyu_surdur(diskten, RUN_ID);
  assert.equal(sonuc.son, "bitti", `kosu bitmeliydi: ${JSON.stringify(sonuc.adim_kayitlari)}`);
  assert.deepEqual(
    sonuc.adim_kayitlari.map((k) => `${k.step_id}:${k.status}`),
    ["ozet-yaz:BITTI"],
    "surdurulen kosu yalnizca kalan adimi calistirmali",
  );

  // Olcut 3: yan etki tekrarlanmadi — her adim tam olarak bir kez.
  const yanEtkiler = readFileSync(yanEtkiLog, "utf8").trim().split("\n").filter(Boolean);
  assert.deepEqual(yanEtkiler, ["rapor-yaz", "ozet-yaz"], "adim yan etkisi tekrarlanmis");
  assert.ok(gorevYon.tamamlandi_mi(diskten, "rapor-yaz"));
  assert.ok(gorevYon.tamamlandi_mi(diskten, "ozet-yaz"));

  // --- Olcut 2: uretilen her belge semasindan geciyor -----------------------
  semadanGecir(gorevYon.kayit_yolu(TASK_ID), "task.schema.json");

  const izinBelgeleri = readdirSync(izinler).filter((f) => f.endsWith(".json"));
  assert.ok(izinBelgeleri.length >= 1, "en az bir izin karari uretilmeliydi");
  for (const belge of izinBelgeleri) semadanGecir(join(izinler, belge), "permission.schema.json");

  const spanlar = await gozlem.kosu_izleri(RUN_ID);
  // Iki adimin span'lari: 1. adim run+invoke_agent+inference+execute_tool+
  // permission_check+evaluate, 2. adim run+invoke_agent+inference+evaluate.
  assert.equal(spanlar.length, 10, `iz bastan sona okunmali, ${spanlar.length} span var`);
  assert.equal(new Set(spanlar.map((s) => s.span_id)).size, 10, "span kimlikleri cakismamali");
  const spanDosyasi = join(tmp, "span.json");
  for (const span of spanlar) {
    writeFileSync(spanDosyasi, JSON.stringify(span, null, 2));
    semadanGecir(spanDosyasi, "span.schema.json");
  }
  // Iz gercekten iki adimi da kapsiyor mu?
  assert.deepEqual(
    [...new Set(spanlar.map((s) => s.step_id))].sort(),
    ["ozet-yaz", "rapor-yaz"],
    "iz her iki adimi da tasimali",
  );

  // Butun izin kararlari ALLOW mu? (U14 bulgusu: izinli_kapsam + binding
  // verilmeden hepsi HUMAN_REQUIRED'a dusuyordu.)
  for (const belge of izinBelgeleri) {
    const karar = JSON.parse(readFileSync(join(izinler, belge), "utf8"));
    assert.equal(karar.decision, "ALLOW", `${belge}: ${karar.reason}`);
  }
});

test("U14: ajan sozlesmesi yazma kapsami dar olursa arac cagrisi BLOCK olur", async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "ajans-os-kabul-dar-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  const { bagimliliklar } = await kur(tmp);
  // Sozlesmedeki tek yazma kapsami adimla ortusmuyor: kapsam denetimi "kaldi"
  // der ve karar BLOCK olur. Kapsamin kararda gercekten rol oynadigini bu
  // gosterir — ALLOW'un sebebi "kimse bakmadi" degil.
  const ajanlar = join(tmp, "ajanlar");
  const yol = join(ajanlar, `${AJAN_ID}.json`);
  const sozlesme = JSON.parse(readFileSync(yol, "utf8"));
  sozlesme.permissions.filesystem.write = ["baska-yer/"];
  writeFileSync(yol, JSON.stringify(sozlesme, null, 2));

  const gorev = await bagimliliklar.gorev_yoneticisi.olustur(gorevSozlesmesi());
  const kayit = await orkestrator(bagimliliklar, { fiyat_tablosu: fiyatKimligi() }).adimi_yurut(gorev, "rapor-yaz");
  // Izin reddi telafisi olmayan bir yan etkiye denk geldigi icin kurtarma
  // yoneticisi insan kapisini secer: adim BASARISIZ degil ONAY_BEKLIYOR olur.
  assert.equal(kayit.status, "ONAY_BEKLIYOR");
  assert.equal(kayit.kurtarma_modu, "insan-kapisi");
});

test("U14: ozet — sha256 ozeti sozlesmenin BU haline baglaniyor", () => {
  // ADR-007/2: surum numarasi degismeden icerik degisebilir; bag digest'tedir.
  const a = { identity: { id: AJAN_ID, version: "1.0.0" } };
  const b = { identity: { id: AJAN_ID, version: "1.0.0" }, mission: "degisti" };
  const oz = (v) => `sha256:${createHash("sha256").update(JSON.stringify(v)).digest("hex")}`;
  assert.notEqual(oz(a), oz(b));
  assert.match(oz(a), /^sha256:[0-9a-f]{64}$/);
});
