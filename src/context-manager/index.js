/**
 * Context Manager — prompt butcesinin sahibi (U6).
 *
 * Blueprint §2.7. Formul LightRAG'den dogrudan alinir:
 *   kalan = toplam − (sistem sozlesmesi + gorev durumu + bilgi + sorgu + tampon)
 *
 * Iki kural bu modulun tamamini belirler:
 *
 *   1. **Esik %100'un altindadir.** Pencereyi son token'ina kadar doldurmak
 *      sessiz tasmadir (AP1: I2'de cognee kirpma yapmiyor, mem0 donen butun
 *      anilari yapistiriyor). Tavan `toplam * esik`tir; `esik` 0 ile 1
 *      arasinda olmak zorundadir, 1 kabul edilmez.
 *   2. **Kisilma sirasi onceden yazilir.** Calisma aninda "neyi atalim"
 *      karari verilmez; sira kurulusta verilir, donmustur ve `butcele`
 *      ona birebir uyar. Ayni girdi her zaman ayni kisilmayi verir.
 *
 * Kisilamaz iki parca vardir: `sistem_sozlesmesi` (ajanin sozlesmesi) ve
 * `tampon` (yaklasik sayimin guvenlik payi — Letta %30). Bu ikisi tek basina
 * tavani asiyorsa kisilacak bir sey yoktur: bu bir yapilandirma hatasidir ve
 * **istisna atilir**. Sessizce tasan prompt dondurmek bu modulun onlemek icin
 * var oldugu hatanin ta kendisidir.
 *
 * Kapsam disi: **ozetleme**. Kisilma atmaktir, ozetlemek degil (U6 kapsami).
 * ADR-002: kardes modul import edilmez; modul kimseyi cagirmaz, saf hesaptir.
 */

/** Kisilabilir parcalar. `sistem_sozlesmesi` ve `tampon` bu kumede degildir. */
const KISILABILIR = new Set(["bilgi", "gorev_durumu", "sorgu"]);

/** Formulun tum bilesenleri; hepsi zorunludur. */
const BILESENLER = [
  "toplam", "sistem_sozlesmesi", "gorev_durumu", "bilgi", "sorgu", "tampon",
];

/** Varsayilan sira: once dis bilgi, sonra gorev durumu, en son sorgu. */
const VARSAYILAN_SIRA = Object.freeze(["bilgi", "gorev_durumu", "sorgu"]);

function sayiDogrula(deger, ad) {
  // Number.isFinite NaN'i ve sonsuzu birlikte eler; sessizce NaN tasiyan bir
  // butce hesabi her karsilastirmayi false yapar ve tasmayi gorunmez kilar.
  if (typeof deger !== "number" || !Number.isFinite(deger) || deger < 0) {
    throw new Error(`butcele: '${ad}' negatif olmayan sonlu bir sayi olmali (gelen: ${deger})`);
  }
}

/**
 * @param {{ esik?: number, kisilma_sirasi?: ReadonlyArray<string> }} [secenekler]
 */
export function baglamYoneticisi({ esik = 0.9, kisilma_sirasi = VARSAYILAN_SIRA } = {}) {
  if (typeof esik !== "number" || !Number.isFinite(esik) || esik <= 0 || esik >= 1) {
    throw new Error(`baglamYoneticisi: 'esik' 0 ile 1 arasinda olmali (%100 dahil degil), gelen: ${esik}`);
  }
  if (!Array.isArray(kisilma_sirasi) || kisilma_sirasi.length === 0) {
    throw new Error("baglamYoneticisi: 'kisilma_sirasi' bos olmayan bir dizi olmali");
  }
  const gorulen = new Set();
  for (const parca of kisilma_sirasi) {
    if (!KISILABILIR.has(parca)) {
      throw new Error(`baglamYoneticisi: kisilamaz parca '${parca}' (kisilabilirler: ${[...KISILABILIR].join(", ")})`);
    }
    // Tekrar eden parca sirayi belirsiz kilar: ayni parca iki kez kisilirsa
    // "sira onceden yazilidir" iddiasi dogrulanabilir olmaktan cikar.
    if (gorulen.has(parca)) throw new Error(`baglamYoneticisi: '${parca}' kisilma sirasinda iki kez geciyor`);
    gorulen.add(parca);
  }

  // Sira kurulustan sonra degistirilemez (d.ts'teki `readonly`in calisma
  // anindaki karsiligi): cagiran diziyi elinde tutsa bile push/atama gecmez.
  const sira = Object.freeze([...kisilma_sirasi]);

  return {
    esik,
    kisilma_sirasi: sira,

    butcele(bilesenler) {
      if (bilesenler === null || typeof bilesenler !== "object") {
        throw new Error("butcele: 'bilesenler' bir nesne olmali");
      }
      for (const ad of BILESENLER) {
        if (!(ad in bilesenler)) throw new Error(`butcele: zorunlu bilesen eksik: '${ad}'`);
        sayiDogrula(bilesenler[ad], ad);
      }

      const sonuc = {};
      for (const ad of BILESENLER) sonuc[ad] = bilesenler[ad];

      const tavan = sonuc.toplam * esik;
      const kullanilan = () =>
        sonuc.sistem_sozlesmesi + sonuc.gorev_durumu + sonuc.bilgi + sonuc.sorgu + sonuc.tampon;

      const asildi_mi = kullanilan() > tavan;
      /** @type {Array<{parca: string, kisilan_token: number}>} */
      const kisilanlar = [];

      if (asildi_mi) {
        const kisilamaz = sonuc.sistem_sozlesmesi + sonuc.tampon;
        if (kisilamaz > tavan) {
          throw new Error(
            `butcele: kisilamaz parcalar tek basina tavani asiyor ` +
            `(sistem_sozlesmesi + tampon = ${kisilamaz}, tavan = ${tavan}). ` +
            `Kisilacak bir sey yok; bu bir yapilandirma hatasidir.`,
          );
        }
        let fazla = kullanilan() - tavan;
        for (const parca of sira) {
          if (fazla <= 0) break;
          const kisilan_token = Math.min(fazla, sonuc[parca]);
          if (kisilan_token > 0) {
            sonuc[parca] -= kisilan_token;
            fazla -= kisilan_token;
            kisilanlar.push({ parca, kisilan_token });
          }
        }
      }

      return {
        bilesenler: sonuc,          // kisilma sonrasi hali
        kalan: sonuc.toplam - kullanilan(),
        kisilanlar,
        asildi_mi,                  // esik kisilmadan **once** asildi mi
      };
    },
  };
}
