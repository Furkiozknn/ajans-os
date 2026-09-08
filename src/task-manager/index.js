/**
 * Task Manager — gorevin kalici kaydi ve durum makinesi (U1).
 *
 * ADR-003: adim sinirinda **iki** yazma vardir. `basladi_yaz` yan etkiden ONCE,
 * `bitti_yaz` SONRA diske iner. Aradaki surec olumunde kayit "BASLADI" kalir;
 * `tamamlandi_mi` false doner ve adim yeniden calistirilabilir. Tek yazmaya
 * dusurmek yeniden baslatma amnezisini geri getirir.
 *
 * Sozlesme: contracts/task.schema.json. Bu dosya semayi tekrar etmez, ona uyar;
 * uyumu `src/task-manager/index.test.js` `arac/sema-dogrula.js` ile kanitlar.
 *
 * Disariya bagimlilik yok, kardes modul import edilmez (ADR-002).
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

/** Sema zaman deseni milisaniye kabul etmiyor: 2026-09-08T13:00:00Z. */
function simdi() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Bir adimin son kaydi. Hic kaydi yoksa null. */
function sonKayit(gorev, adim_id) {
  const kayitlar = gorev.run.step_records.filter((k) => k.step_id === adim_id);
  return kayitlar.length ? kayitlar[kayitlar.length - 1] : null;
}

function adimBul(gorev, adim_id) {
  const adim = gorev.graph.steps.find((a) => a.id === adim_id);
  if (!adim) throw new Error(`adim grafta yok: ${adim_id}`);
  return adim;
}

/**
 * Acik kayit = kapanmamis deneme. Kapali durumlar BITTI ve BASARISIZ; bekleme
 * durumlari (GIRDI_BEKLIYOR, ONAY_BEKLIYOR) aciktir — surec olebilir, akis
 * olayla canlanir.
 */
function acikKayit(gorev, adim_id) {
  const k = sonKayit(gorev, adim_id);
  return k && k.status !== "BITTI" && k.status !== "BASARISIZ" ? k : null;
}

export function gorevYoneticisi({ dizin }) {
  if (!dizin) throw new Error("gorevYoneticisi: `dizin` zorunlu");

  const yol = (task_id) => join(dizin, `${task_id}.json`);

  /** Atomik yazma: gecici dosya + rename. Yarim JSON diske dusmez. */
  function diskeYaz(gorev) {
    const hedef = yol(gorev.task.id);
    mkdirSync(dirname(hedef), { recursive: true });
    const gecici = `${hedef}.tmp`;
    writeFileSync(gecici, `${JSON.stringify(gorev, null, 2)}\n`, "utf8");
    renameSync(gecici, hedef);
  }

  function kayitEkle(gorev, kayit) {
    gorev.run.step_records.push(kayit);
    diskeYaz(gorev);
    return kayit;
  }

  return {
    /** Kaydin disk yolu — dogrulayiciyi kayda dogrultmak icin. */
    kayit_yolu: yol,

    async yukle(task_id) {
      const hedef = yol(task_id);
      return existsSync(hedef) ? JSON.parse(readFileSync(hedef, "utf8")) : null;
    },

    /** Yeni gorev kaydini ilk kez diske indirir. */
    async olustur(gorev) {
      if (existsSync(yol(gorev.task.id))) throw new Error(`gorev kaydi zaten var: ${gorev.task.id}`);
      diskeYaz(gorev);
      return gorev;
    },

    sonraki_adim(gorev) {
      for (const adim of gorev.graph.steps) {
        const k = sonKayit(gorev, adim.id);
        if (k && k.status === "BITTI") continue;
        // Bekleyen adim calistirilmaz: girdi/onay disaridan gelir.
        if (k && (k.status === "GIRDI_BEKLIYOR" || k.status === "ONAY_BEKLIYOR")) continue;
        // Deneme hakki bitmisse adim kapanmistir.
        if (k && k.status === "BASARISIZ" && k.attempt >= adim.retry.max_attempts) continue;
        // Bagimliliklarin hepsi BITTI olmali; biri kapanmadiysa sira ona gelmemistir.
        const hazir = adim.depends_on.every((b) => {
          const bk = sonKayit(gorev, b);
          return bk && bk.status === "BITTI";
        });
        if (hazir) return adim;
      }
      return null;
    },

    async basladi_yaz(gorev, adim_id) {
      const adim = adimBul(gorev, adim_id);
      const k = sonKayit(gorev, adim_id);
      // 02 §5/K1: kapanmis adim ikinci kez baslatilmaz — yan etkinin sessiz tekrari budur.
      if (k && k.status === "BITTI") throw new Error(`adim zaten BITTI, yeniden baslatilamaz: ${adim_id}`);
      const acik = acikKayit(gorev, adim_id);
      if (acik) {
        // Kesilen deneme sürdürülüyor: yeni deneme acilmaz, ayni satir BASLADI'ya doner.
        acik.status = "BASLADI";
        diskeYaz(gorev);
        return acik;
      }
      const deneme = k ? k.attempt + 1 : 1;
      if (deneme > adim.retry.max_attempts) {
        throw new Error(`adim ${adim_id}: deneme hakki bitti (${adim.retry.max_attempts})`);
      }
      return kayitEkle(gorev, {
        step_id: adim_id,
        attempt: deneme,
        status: "BASLADI",
        started_at: simdi(),
        side_effects_done: [],
      });
    },

    async bitti_yaz(gorev, adim_id, sonuc) {
      const kayit = acikKayit(gorev, adim_id);
      if (!kayit) throw new Error(`acik kayit yok, once basladi_yaz cagrilmali: ${adim_id}`);
      const degerlendirme = sonuc.evaluation_result || "DEGERLENDIRILMEDI";
      // D11: "kontrol edilmedi" temiz sayilmaz; insan kapisina dusen kaydin izi olur.
      if (degerlendirme === "DEGERLENDIRILMEDI" && !sonuc.approval_ref) {
        throw new Error(`adim ${adim_id}: DEGERLENDIRILMEDI kaydi approval_ref olmadan kapatilamaz (D11)`);
      }
      kayit.status = "BITTI";
      kayit.ended_at = simdi();
      kayit.result_summary = sonuc.result_summary;
      kayit.evaluation_result = degerlendirme;
      if (sonuc.artifacts) kayit.artifacts = sonuc.artifacts;
      if (sonuc.side_effects_done) kayit.side_effects_done = sonuc.side_effects_done;
      if (sonuc.approval_ref) kayit.approval_ref = sonuc.approval_ref;
      if ("cost_usd" in sonuc) kayit.cost_usd = sonuc.cost_usd;
      diskeYaz(gorev);
      return kayit;
    },

    async basarisiz_yaz(gorev, adim_id, hata) {
      const kayit = acikKayit(gorev, adim_id);
      if (!kayit) throw new Error(`acik kayit yok, once basladi_yaz cagrilmali: ${adim_id}`);
      kayit.status = "BASARISIZ";
      kayit.ended_at = simdi();
      kayit.error_type = hata.error_type;
      if (hata.error_message) kayit.error_message = hata.error_message;
      diskeYaz(gorev);
      return kayit;
    },

    async durum_degistir(gorev, adim_id, durum, not) {
      if (durum !== "GIRDI_BEKLIYOR" && durum !== "ONAY_BEKLIYOR") {
        throw new Error(`durum_degistir yalnizca bekleme durumlarina gecirir, '${durum}' degil`);
      }
      const kayit = acikKayit(gorev, adim_id);
      if (!kayit) throw new Error(`acik kayit yok, once basladi_yaz cagrilmali: ${adim_id}`);
      // Sema: ONAY_BEKLIYOR approval_ref ister — onay bir durumdur ve izi vardir (kural 2).
      if (durum === "ONAY_BEKLIYOR" && !not) {
        throw new Error(`adim ${adim_id}: ONAY_BEKLIYOR approval_ref olmadan yazilamaz`);
      }
      kayit.status = durum;
      if (durum === "ONAY_BEKLIYOR") kayit.approval_ref = not;
      diskeYaz(gorev);
      return kayit;
    },

    tamamlandi_mi(gorev, adim_id) {
      const k = sonKayit(gorev, adim_id);
      return Boolean(k && k.status === "BITTI");
    },
  };
}
