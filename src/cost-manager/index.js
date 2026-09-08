/**
 * Cost Manager — butcenin sahibi (U8).
 *
 * Blueprint §2.12 / ADR-000 kural 11. Uc karar bu modulun tamamini belirler:
 *
 *   1. **Fiyat tablosu veridir, koda gomulmez.** Tablo bir JSON dosyasindan
 *      yuklenir (`veri/fiyat-tablosu.json`) ve guncelleme proseduru o dosyanin
 *      icinde yazilidir. Kodda gomulu tek bir fiyat yoktur; AP10'un onlemek
 *      icin var oldugu hata "listeyi guncellemek icin cekirdegi degistirmek"
 *      idi.
 *   2. **Bilinmeyen maliyet `null`dir, sifir degil.** Tabloda olmayan model,
 *      fiyati `null` olan satir ve fiyatlanmamis bir sayac — ucu de ayni
 *      sonucu verir: `maliyet_usd: null` ve `bilinmeyen_cagri` sayaci artar.
 *      Toplam bozulmaz ama **eksik oldugu gorunur**; sifir yazmak "bedava"
 *      demektir ve yalandir.
 *   3. **Esik asilinca planli faz gecisi.** Bu modul kimseyi durdurmaz, karar
 *      da vermez: yalnizca `gecis_gerekli` bayragini kaldirir. Ani olum
 *      (surecin bitmesi) degil, elindeki kismi ciktiyi yazip durma karari
 *      Orchestrator'undur. ADR-002: bu modul kardes modul cagirmaz.
 *
 * Sayi ayrıstırma tek yonlu bir kuraldir (BILINEN-TUZAKLAR #4): fiyat alani
 * **yalnizca JSON sayisi** kabul eder. `"1,25"` gibi bir metin degeri
 * ayristirmaya calismak Turkce yerelde 125'e ya da 1'e donusebilir; bu modul
 * boyle bir degeri ayristirmaz, **reddeder**. Cikti tarafinda da yerel
 * bicimlendirme (`toLocaleString`) kullanilmaz — USD degeri makine sayisidir.
 *
 * Kapsam disi: fatura, raporlama, maliyetin gozlemlenebilirlige yazilmasi
 * (U12'nin isi).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Tablo dosyasinin varsayilan yeri. Depo koku disindan da verilebilir. */
export const VARSAYILAN_TABLO = fileURLToPath(
  new URL("../../veri/fiyat-tablosu.json", import.meta.url),
);

/**
 * Hangi kullanim sayaci hangi fiyat alanindan fiyatlanir. Bir sayac burada
 * yoksa **fiyatlanamaz**: sifir sayilmaz, cagri bilinmeyen olur.
 */
const SAYAC_FIYAT_ALANI = {
  input_tokens: "input_usd_per_mtok",
  output_tokens: "output_usd_per_mtok",
  cache_read_tokens: "cache_read_usd_per_mtok",
  cache_write_tokens: "cache_write_usd_per_mtok",
};

const MTOK = 1_000_000;

/**
 * Fiyat alanini okur. Kabul edilen tek bicimler: sonlu negatif olmayan sayi
 * ve `null`. Metin (ondalik ayirici tuzagi), NaN, negatif — hepsi istisna.
 */
function fiyatOku(satir, alan, nerede) {
  const deger = satir[alan];
  if (deger === undefined || deger === null) return null;
  if (typeof deger === "string") {
    throw new Error(
      `maliyetYoneticisi: ${nerede}.${alan} metin ("${deger}") — fiyat JSON sayisi olmali. ` +
        `Ondalik ayirici nokta; virgullu metin ayristirilmaz, reddedilir.`,
    );
  }
  if (typeof deger !== "number" || !Number.isFinite(deger) || deger < 0) {
    throw new Error(`maliyetYoneticisi: ${nerede}.${alan} negatif olmayan sonlu bir sayi ya da null olmali`);
  }
  return deger;
}

/** Tablo satirini dogrular ve normalize eder. Gecersiz satir sessizce atlanmaz (AP3). */
function satirDogrula(satir, sira) {
  const nerede = `satirlar[${sira}]`;
  if (satir === null || typeof satir !== "object" || Array.isArray(satir)) {
    throw new Error(`maliyetYoneticisi: ${nerede} bir nesne olmali`);
  }
  if (typeof satir.model_id !== "string" || satir.model_id.length === 0) {
    throw new Error(`maliyetYoneticisi: ${nerede}.model_id bos olmayan bir metin olmali`);
  }
  if (typeof satir.gecerli_tarih !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(satir.gecerli_tarih)) {
    throw new Error(`maliyetYoneticisi: ${nerede}.gecerli_tarih YYYY-AA-GG biciminde olmali`);
  }
  const normal = { model_id: satir.model_id, gecerli_tarih: satir.gecerli_tarih };
  for (const alan of Object.values(SAYAC_FIYAT_ALANI)) {
    normal[alan] = fiyatOku(satir, alan, nerede);
  }
  return normal;
}

function sayacOku(usage, ad) {
  const deger = usage[ad];
  if (deger === undefined || deger === null) return 0;
  if (typeof deger !== "number" || !Number.isFinite(deger) || deger < 0) {
    throw new Error(`maliyetYoneticisi: usage.${ad} negatif olmayan sonlu bir sayi olmali`);
  }
  return deger;
}

/**
 * Kurar. `tavan_usd` zorunludur — tavansiz bir butce yoneticisi butceyi
 * yonetmez. `gecis_esigi` doluluk oranidir (0–1); asildiginda `gecis_gerekli`
 * kalkar. `adim_orani` bir adima verilebilecek kalan butce payidir.
 */
export function maliyetYoneticisi({
  tabloYolu = VARSAYILAN_TABLO,
  tavan_usd,
  gecis_esigi = 0.8,
  adim_orani = 0.25,
} = {}) {
  if (typeof tavan_usd !== "number" || !Number.isFinite(tavan_usd) || tavan_usd <= 0) {
    throw new Error("maliyetYoneticisi: tavan_usd pozitif sonlu bir sayi olmali");
  }
  for (const [ad, deger] of [
    ["gecis_esigi", gecis_esigi],
    ["adim_orani", adim_orani],
  ]) {
    if (typeof deger !== "number" || !Number.isFinite(deger) || deger <= 0 || deger > 1) {
      throw new Error(`maliyetYoneticisi: ${ad} 0 ile 1 arasinda olmali`);
    }
  }

  /** @type {Map<string, object> | null} */
  let tablo = null;
  let harcanan_usd = 0;
  let bilinmeyen_cagri = 0;

  function durum() {
    return {
      harcanan_usd,
      bilinmeyen_cagri,
      tavan_usd,
      doluluk: harcanan_usd / tavan_usd,
      gecis_gerekli: harcanan_usd / tavan_usd >= gecis_esigi,
    };
  }

  return {
    async tablo_yukle() {
      const belge = JSON.parse(await readFile(tabloYolu, "utf8"));
      if (!Array.isArray(belge.satirlar)) {
        throw new Error(`maliyetYoneticisi: ${tabloYolu} icinde "satirlar" dizisi yok`);
      }
      const satirlar = belge.satirlar.map(satirDogrula);
      tablo = new Map(satirlar.map((s) => [s.model_id, s]));
      if (tablo.size !== satirlar.length) {
        throw new Error("maliyetYoneticisi: fiyat tablosunda yinelenen model_id var");
      }
      return satirlar;
    },

    usage_isle(model_id, usage) {
      if (tablo === null) {
        throw new Error("maliyetYoneticisi: once tablo_yukle() cagrilmali — kodda gomulu fiyat yok");
      }
      if (usage === null || typeof usage !== "object" || Array.isArray(usage)) {
        throw new Error("maliyetYoneticisi: usage bir nesne olmali");
      }
      const satir = tablo.get(model_id);
      if (satir === undefined) {
        bilinmeyen_cagri += 1;
        return { maliyet_usd: null, durum: durum() };
      }

      let toplam = 0;
      for (const sayac of Object.keys(usage)) {
        const adet = sayacOku(usage, sayac);
        if (adet === 0) continue;
        const alan = SAYAC_FIYAT_ALANI[sayac];
        const fiyat = alan === undefined ? null : satir[alan];
        if (fiyat === null) {
          // Fiyatlanmayan sifir olmayan bir sayac tum cagriyi bilinmeyen yapar:
          // kismi toplam, tam toplam gibi gorunur ve sessizce eksik raporlar.
          bilinmeyen_cagri += 1;
          return { maliyet_usd: null, durum: durum() };
        }
        toplam += (adet / MTOK) * fiyat;
      }
      harcanan_usd += toplam;
      return { maliyet_usd: toplam, durum: durum() };
    },

    gecis_gerekli_mi() {
      return durum().gecis_gerekli;
    },

    adim_tavani() {
      const kalan = tavan_usd - harcanan_usd;
      if (kalan <= 0) return null;
      // ponytail: sabit oran; kalan adim sayisina gore paylastirma gerekirse
      // adim_orani yerine bir plan uzunlugu argumani alinir.
      return kalan * adim_orani;
    },

    durum,
  };
}
