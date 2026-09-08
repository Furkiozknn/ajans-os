// Task Manager testi (U1). Olcut YOL-HARITASI.md U1: "surec olumu benzetiminden
// sonra tamamlandi_mi dogru cevap veriyor; kayit task.schema.json'a uyuyor."
//
// Surec olumu su sekilde benzetilir: bellekteki gorev nesnesi ATILIR ve kayit
// diskten yeniden okunur. Yalnizca diske inmis olan hayatta kalir — ADR-003'un
// iki yazmasinin tek anlami budur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { gorevYoneticisi } from "./index.js";

const kok = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ornekGorev() {
  const adim = (id, depends_on, ekstra = {}) => ({
    id,
    title: `Adim ${id}`,
    assign: { mode: "role", role: "specialist" },
    depends_on,
    evaluation: { method: "deterministic", checker: "node arac/yapi-dogrula.js" },
    retry: { max_attempts: 2, mode: "temiz-sayfa" },
    side_effects: false,
    on_failure: "dur",
    ...ekstra,
  });
  return {
    contract_version: "1.0",
    task: {
      id: "u1-deneme-gorevi",
      title: "U1 deneme gorevi",
      goal: "Task Manager durum makinesini ucu uca sinamak icin uc adimli kucuk bir graf.",
      source: "gorevler/bekleyen/u1-deneme.md",
      created_at: "2026-09-08T16:00:00+03:00",
      budget: { max_usd: 1, on_exceed: "stop", spent_usd: null },
    },
    graph: {
      steps: [
        adim("hazirlik", [], { writes: ["raporlar/hazirlik.md"] }),
        adim("uretim", ["hazirlik"], {
          writes: ["raporlar/uretim.md"],
          side_effects: true,
          compensation: { method: "Uretilen dosya _eski/ altina tasinir.", on_impossible: "human-gate" },
        }),
        adim("kapanis", ["uretim"], { writes: ["raporlar/kapanis.md"] }),
      ],
    },
    run: {
      run_id: "kosu-001",
      started_at: "2026-09-08T16:00:05+03:00",
      step_records: [],
    },
  };
}

function yeniYonetici() {
  return gorevYoneticisi({ dizin: mkdtempSync(join(tmpdir(), "ajans-os-u1-")) });
}

async function kurulum() {
  const tm = yeniYonetici();
  const gorev = await tm.olustur(ornekGorev());
  return { tm, gorev };
}

test("sonraki_adim bagimliligi karsilanmamis adimi vermez", async () => {
  const { tm, gorev } = await kurulum();
  assert.equal(tm.sonraki_adim(gorev).id, "hazirlik");

  await tm.basladi_yaz(gorev, "hazirlik");
  await tm.bitti_yaz(gorev, "hazirlik", { result_summary: "hazirlik tamam", evaluation_result: "GECTI" });
  assert.equal(tm.sonraki_adim(gorev).id, "uretim");
});

test("ADR-003: surec BASLADI ile BITTI arasinda olurse adim tamamlanmis sayilmaz", async () => {
  const { tm, gorev } = await kurulum();
  await tm.basladi_yaz(gorev, "hazirlik");

  // --- surec olumu: bellekteki nesne atilir, yalnizca disk kalir ---
  const diriltilen = await tm.yukle("u1-deneme-gorevi");
  assert.equal(tm.tamamlandi_mi(diriltilen, "hazirlik"), false);
  // Kesilen deneme surdurulur: ayni adim yeniden verilir, yeni deneme acilmaz.
  assert.equal(tm.sonraki_adim(diriltilen).id, "hazirlik");
  await tm.basladi_yaz(diriltilen, "hazirlik");
  assert.equal(diriltilen.run.step_records.filter((k) => k.step_id === "hazirlik").length, 1);

  await tm.bitti_yaz(diriltilen, "hazirlik", { result_summary: "ikinci kalkista bitti", evaluation_result: "GECTI" });

  // --- ikinci surec olumu: bu kez BITTI diske inmisti ---
  const ikinci = await tm.yukle("u1-deneme-gorevi");
  assert.equal(tm.tamamlandi_mi(ikinci, "hazirlik"), true);
  assert.notEqual(tm.sonraki_adim(ikinci).id, "hazirlik");
  await assert.rejects(() => tm.basladi_yaz(ikinci, "hazirlik"), /yeniden baslatilamaz/);
});

test("D11: DEGERLENDIRILMEDI kaydi approval_ref olmadan kapanamaz", async () => {
  const { tm, gorev } = await kurulum();
  await tm.basladi_yaz(gorev, "hazirlik");
  await assert.rejects(
    () => tm.bitti_yaz(gorev, "hazirlik", { result_summary: "degerlendirilmedi" }),
    /approval_ref/,
  );
  // Kayit hala acik: reddedilen kapanis diske hicbir sey yazmadi.
  assert.equal((await tm.yukle("u1-deneme-gorevi")).run.step_records[0].status, "BASLADI");
});

test("basarisiz adim deneme hakki bitene kadar yeniden verilir, sonra graf durur", async () => {
  const { tm, gorev } = await kurulum();
  for (const deneme of [1, 2]) {
    const adim = tm.sonraki_adim(gorev);
    assert.equal(adim.id, "hazirlik");
    const kayit = await tm.basladi_yaz(gorev, "hazirlik");
    assert.equal(kayit.attempt, deneme);
    await tm.basarisiz_yaz(gorev, "hazirlik", { error_type: "ARAC_HATASI", error_message: "cikis kodu 1" });
  }
  // max_attempts = 2: adim kapandi, kendisine bagimli adimlar da acilmaz.
  assert.equal(tm.sonraki_adim(gorev), null);
});

test("bekleme durumu adimi calistirilabilir olmaktan cikarir, onay izsiz yazilamaz", async () => {
  const { tm, gorev } = await kurulum();
  await tm.basladi_yaz(gorev, "hazirlik");
  await assert.rejects(() => tm.durum_degistir(gorev, "hazirlik", "ONAY_BEKLIYOR"), /approval_ref/);
  await assert.rejects(() => tm.durum_degistir(gorev, "hazirlik", "BITTI"), /bekleme durumlarina/);

  await tm.durum_degistir(gorev, "hazirlik", "ONAY_BEKLIYOR", "ONAY-BEKLEYENLER.md#u1-hazirlik");
  assert.equal(tm.sonraki_adim(gorev), null);
  assert.equal(tm.tamamlandi_mi(gorev, "hazirlik"), false);
});

test("uretilen kayit task.schema.json'a uyuyor (arac/sema-dogrula.js)", async () => {
  const { tm, gorev } = await kurulum();

  await tm.basladi_yaz(gorev, "hazirlik");
  await tm.bitti_yaz(gorev, "hazirlik", {
    result_summary: "hazirlik tamam",
    artifacts: ["raporlar/hazirlik.md"],
    evaluation_result: "GECTI",
    cost_usd: 0.12,
  });
  await tm.basladi_yaz(gorev, "uretim");
  await tm.durum_degistir(gorev, "uretim", "ONAY_BEKLIYOR", "ONAY-BEKLEYENLER.md#u1-uretim");
  await tm.bitti_yaz(gorev, "uretim", {
    result_summary: "onay sonrasi uretim bitti",
    side_effects_done: ["raporlar/uretim.md yazildi"],
    evaluation_result: "DEGERLENDIRILMEDI",
    approval_ref: "ONAY-BEKLEYENLER.md#u1-uretim",
    cost_usd: null,
  });
  await tm.basladi_yaz(gorev, "kapanis");
  await tm.basarisiz_yaz(gorev, "kapanis", { error_type: "DOGRULAMA_KALDI", error_message: "kapi kaldi" });

  execFileSync(
    process.execPath,
    ["arac/sema-dogrula.js", "--dosya", tm.kayit_yolu("u1-deneme-gorevi"), "--sema", "task.schema.json"],
    { cwd: kok, stdio: "pipe" },
  );
});
