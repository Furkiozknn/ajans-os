/**
 * Recovery Manager — hata turune bakip modu secer (U11).
 *
 * Blueprint §2.10, AP8 → ADR-000 kural 9. Uc karar bu modulun tamamini
 * belirler:
 *
 *   1. **Telafisi olmayan eylem kurtarmaya degil insan kapisina duser.**
 *      `telafi_var: false` geldiginde mod her kosulda `insan-kapisi`dir:
 *      hata turu, deneme sayisi ve deneme hakki bu karari degistiremez.
 *      AP8'in anlattigi hata, dunyada yapilmis yan etkiyi (gonderilmis
 *      e-posta, acilmis PR) bir "geri alma" kelimesiyle yok saymaktir; bu
 *      modul o kelimeyi kullanmaz ve o yan etkiyi kendi basina tekrar
 *      denemez. Cagiran `telafi_var`i adimin `side_effects_done` kaydindan
 *      turetir: yapilmis her yan etki icin tanimli bir telafi eylemi varsa
 *      `true`, biri bile yoksa `false`. Hicbir yan etki yapmamis bir adim
 *      icin telafi edilecek sey yoktur, deger `true`dir.
 *
 *   2. **Siniflandirilmayan hata denenmez.** `BILINMEYEN` guvenli tarafa
 *      duser ve `durdur` olur (blueprint §2.10 "guvenli taraf varsayilani").
 *      Kor retry (D7) tam olarak bunun tersini yapar.
 *
 *   3. **Beklemek her hatada anlamli degildir.** Ciktinin kendisi bozuksa
 *      (`SEMA_IHLALI`, `DOGRULAMA_KALDI`) beklemek maliyeti buyutur ve hicbir
 *      seyi duzeltmez — bekleme 0. Cevre kaynakli hatada (`ARAC_HATASI`,
 *      `ZAMAN_ASIMI`, `MODEL_HATASI`) ustel geri cekilme + jitter uygulanir.
 *      Ayrim D7'nin kaniti: 429 beklemek ister, `SyntaxError` istemez.
 *
 * Yerel minimum kilitlenmesi (D13) icin ucuncu bir kademe var: ayni adimi
 * ayni baglamla surekli `duzelt`meye calismak ayni hatayi tekrar uretir.
 * Deneme hakki dolmadan once bir kez `temiz-sayfa` denenir — baglam atilir,
 * adim bastan calisir. O da tutmazsa `durdur`.
 *
 * Kapsam disi: geri alma. Mimaride yok, burada da yok; bu modul yalnizca
 * mod secer, hicbir yan etkiyi kendisi geri sarmaz ve kardes modul cagirmaz
 * (ADR-002).
 */

/**
 * Hata turu → sinif. Sinif modu belirler, hata metni degil (task.schema.json
 * $defs.hata_turu aciklamasi: "Kurtarma modu bu alandan secilir").
 *
 *   duzeltilebilir : cikti bozuk, baglam korunup elestiri eklenerek denenir;
 *                    beklemek fayda etmez.
 *   gecici         : cevre kaynakli, ayni cagri sonra tutabilir; beklenir.
 *   insan          : karar insanindir, sistem kendi basina asamaz.
 *   denenmez       : tekrar denemek tanimi geregi anlamsiz.
 */
const SINIF = {
  SEMA_IHLALI: "duzeltilebilir",
  DOGRULAMA_KALDI: "duzeltilebilir",
  ARAC_HATASI: "gecici",
  ZAMAN_ASIMI: "gecici",
  MODEL_HATASI: "gecici",
  IZIN_REDDI: "insan",
  BUTCE_DUVARI: "denenmez",
  BAGIMLILIK_BASARISIZ: "denenmez",
  BILINMEYEN: "denenmez",
};

/** Sozlesmedeki dokuz hata turu; bunun disindaki deger cagiran tarafin hatasi. */
export const HATA_TURLERI = Object.freeze(Object.keys(SINIF));

function tamsayiDogrula(deger, ad, enAz) {
  if (typeof deger !== "number" || !Number.isInteger(deger) || deger < enAz) {
    throw new Error(`kurtarmaYoneticisi: ${ad} ${enAz} veya daha buyuk bir tamsayi olmali`);
  }
}

/**
 * Kurar. `duzelt_hakki` kac denemenin baglami koruyarak yapilacagi,
 * `temiz_sayfa_hakki` ondan sonra kac denemenin baglam atilarak yapilacagidir;
 * ikisinin toplami toplam deneme hakkidir, sonrasi `durdur`.
 *
 * `rastgele` jitter kaynagidir ve enjekte edilir: `bekleme_ms` bu kaynak
 * sabitlendiginde saf bir fonksiyondur, testte olculebilir.
 */
export function kurtarmaYoneticisi({
  duzelt_hakki = 2,
  temiz_sayfa_hakki = 1,
  taban_ms = 1000,
  tavan_ms = 30000,
  rastgele = Math.random,
} = {}) {
  tamsayiDogrula(duzelt_hakki, "duzelt_hakki", 1);
  tamsayiDogrula(temiz_sayfa_hakki, "temiz_sayfa_hakki", 0);
  tamsayiDogrula(taban_ms, "taban_ms", 1);
  tamsayiDogrula(tavan_ms, "tavan_ms", 1);
  if (tavan_ms < taban_ms) {
    throw new Error("kurtarmaYoneticisi: tavan_ms taban_ms'den kucuk olamaz");
  }
  if (typeof rastgele !== "function") {
    throw new Error("kurtarmaYoneticisi: rastgele bir fonksiyon olmali");
  }

  const toplam_hak = duzelt_hakki + temiz_sayfa_hakki;

  /**
   * Ustel geri cekilme + esit jitter. Ust sinir `tavan_ms`; alt sinir bir
   * onceki denemenin ust siniridir, yani dizi hicbir cekiliste azalmaz.
   */
  function bekleme_ms(deneme) {
    tamsayiDogrula(deneme, "deneme", 1);
    const us = Math.min(taban_ms * 2 ** (deneme - 1), tavan_ms);
    const yari = us / 2;
    const pay = rastgele();
    if (typeof pay !== "number" || !Number.isFinite(pay) || pay < 0 || pay > 1) {
      throw new Error("kurtarmaYoneticisi: rastgele() 0 ile 1 arasinda bir sayi dondurmeli");
    }
    return Math.round(yari + yari * pay);
  }

  return {
    bekleme_ms,

    mod_sec({ hata_turu, deneme, step_id, telafi_var } = {}) {
      if (!Object.hasOwn(SINIF, hata_turu)) {
        throw new Error(
          `kurtarmaYoneticisi: bilinmeyen hata_turu ${JSON.stringify(hata_turu)} — ` +
            `sozlesmedeki turlerden biri olmali (${HATA_TURLERI.join(", ")})`,
        );
      }
      tamsayiDogrula(deneme, "deneme", 1);
      if (typeof step_id !== "string" || step_id.length === 0) {
        throw new Error("kurtarmaYoneticisi: step_id bos olmayan bir metin olmali");
      }
      if (typeof telafi_var !== "boolean") {
        throw new Error(
          "kurtarmaYoneticisi: telafi_var acikca true ya da false olmali — " +
            "eksik bilgi 'telafi vardir' sayilmaz",
        );
      }

      // 1 — Telafisi olmayan eylem. Her seyin onunde; hicbir hata turu ve
      // hicbir deneme sayisi bu dali atlatamaz (ADR-000 kural 9).
      if (!telafi_var) {
        return {
          mod: "insan-kapisi",
          bekleme_ms: 0,
          gerekce:
            `${step_id}: yapilmis yan etkinin tanimli telafisi yok, ` +
            `${hata_turu} sonrasi tekrar denemek etkiyi ikinci kez uretebilir — karar insanin`,
        };
      }

      const sinif = SINIF[hata_turu];

      if (sinif === "insan") {
        return {
          mod: "insan-kapisi",
          bekleme_ms: 0,
          gerekce: `${step_id}: ${hata_turu} sistemin kendi basina asabilecegi bir sinir degil`,
        };
      }

      if (sinif === "denenmez") {
        return {
          mod: "durdur",
          bekleme_ms: 0,
          gerekce:
            hata_turu === "BILINMEYEN"
              ? `${step_id}: hata siniflandirilmadi, guvenli taraf tekrar denememektir`
              : `${step_id}: ${hata_turu} tekrar denemekle degismez`,
        };
      }

      if (deneme > toplam_hak) {
        return {
          mod: "durdur",
          bekleme_ms: 0,
          gerekce: `${step_id}: ${toplam_hak} deneme hakki doldu (${hata_turu})`,
        };
      }

      // Beklemek yalnizca cevre kaynakli hatada anlamli (D7).
      const bekleme = sinif === "gecici" ? bekleme_ms(deneme) : 0;

      if (deneme <= duzelt_hakki) {
        return {
          mod: "duzelt",
          bekleme_ms: bekleme,
          gerekce: `${step_id}: ${hata_turu} icin ${deneme}. deneme, baglam korunur ve elestiri eklenir`,
        };
      }

      return {
        mod: "temiz-sayfa",
        bekleme_ms: bekleme,
        gerekce:
          `${step_id}: ${duzelt_hakki} duzeltme denemesi ayni hatayi uretti, ` +
          `baglam atilip adim bastan calisir`,
      };
    },
  };
}
