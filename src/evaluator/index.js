/**
 * Evaluator — gecme kararini tek basina verir (U9, ADR-004).
 *
 * Blueprint §2.8. Bu modulun tamamini uc kural belirler:
 *
 *   1. **Yalnizca deterministik kaynak.** Girdi tipi `Kanit`tir ve birlesim
 *      kapalidir: `cikis_kodu`, `sema`, `test`, `olcum`. Bu dortlunun disinda
 *      hicbir sey kanit degildir. Bir LLM'in "bence guzel olmus" metni
 *      `Kanit` **yerine gecemez**; sessizce yok sayilmaz da — istisna atar.
 *      Sessiz yok sayma AP3'tur (beyan edilen garantinin kodda karsiligi yok);
 *      istisna, karsiligin kendisidir.
 *   2. **Ayni girdi, ayni sonuc.** Bu modul saat, rastgelelik, dosya/ag
 *      okumasi, modul disi durum ve `async` kullanmaz — iki fonksiyon da saf.
 *      (Kural boyle yazilir, "kullanilmadi" diye degil: yasagi ifade eden
 *      cumle yasakli kelimeyi kacinilmaz olarak icerir — TUZAK #22.)
 *      Sonuc kanitlarin **sirasindan** da bagimsizdir: birlestirme kurali
 *      KALDI > DEGERLENDIRILMEDI > GECTI onceligiyle calisir.
 *   3. **Uc deger, iki degil.** Dogrulayicisi olmayan cikti `GECTI` degildir,
 *      `KALDI` da degildir: `DEGERLENDIRILMEDI`dir (D11 — "kontrol edilmedi"
 *      ile "temiz" ayni sey degil). Bu modul o sonucu **yazmakla** yetinir;
 *      insan kapisina dusurmek cagiranin isidir (ADR-002: kardes modul
 *      cagrilmaz). Task Manager `DEGERLENDIRILMEDI` kaydini `approval_ref`
 *      olmadan zaten kapatmiyor — zincir orada kapaniyor.
 *
 * Sayi kurali tek yonludur (BILINEN-TUZAKLAR #4): olcum degeri ve esik
 * **yalnizca sonlu JSON sayisi** kabul eder. `"0,5742"` gibi bir metin
 * ayristirilmaz, reddedilir; cikti tarafinda da `toLocaleString`
 * kullanilmaz.
 *
 * Kapsam disi: eleştiri uretmek (U10 Critic), kurtarma modu secmek (U11),
 * sonucu ilerleme kaydina yazmak (Task Manager).
 */

export const GECTI = "GECTI";
export const KALDI = "KALDI";
export const DEGERLENDIRILMEDI = "DEGERLENDIRILMEDI";

/** Onceligi buyuk olan kazanir; boylece sonuc kanit sirasindan bagimsizdir. */
const ONCELIK = { [GECTI]: 0, [DEGERLENDIRILMEDI]: 1, [KALDI]: 2 };

/**
 * Kapali birlesim: her `tur` icin izin verilen alanlar ve tipleri.
 * Burada olmayan bir `tur` ya da fazladan bir alan kanit degildir.
 */
const SEMA = {
  cikis_kodu: { kod: "tamsayi" },
  sema: { sema: "metin", gecerli: "mantik", hatalar: "metin_dizisi" },
  test: { gecen: "sayac", kalan: "sayac" },
  olcum: { ad: "metin", deger: "sayi" },
};

function tipUyuyor(tip, deger) {
  switch (tip) {
    case "metin":
      return typeof deger === "string";
    case "mantik":
      return typeof deger === "boolean";
    case "sayi":
      return typeof deger === "number" && Number.isFinite(deger);
    case "tamsayi":
      return Number.isInteger(deger);
    case "sayac":
      return Number.isInteger(deger) && deger >= 0;
    case "metin_dizisi":
      return Array.isArray(deger) && deger.every((e) => typeof e === "string");
    default:
      return false;
  }
}

/**
 * Kaniti kapali birlesime karsi denetler. Gecersiz her sey istisnadir:
 * bilinmeyen `tur`, eksik alan, yanlis tipli alan, fazladan alan.
 * Ozellikle fazladan alan: `{ tur: "sema", gecerli: true, llm_yorumu: "..." }`
 * gibi bir kayit LLM yargisini kanit kiligina sokmanin en kolay yoludur.
 */
function denetle(kanit, nerede) {
  if (kanit === null || typeof kanit !== "object" || Array.isArray(kanit)) {
    throw new TypeError(`${nerede}: kanit bir nesne olmali, ${typeof kanit} verildi`);
  }
  const sema = SEMA[kanit.tur];
  if (!sema) {
    throw new TypeError(
      `${nerede}: "${String(kanit.tur)}" bir kanit turu degil. ` +
        `Izin verilenler: ${Object.keys(SEMA).join(", ")} (ADR-004: LLM ciktisi kanit degildir)`,
    );
  }
  for (const [alan, tip] of Object.entries(sema)) {
    if (!tipUyuyor(tip, kanit[alan])) {
      throw new TypeError(`${nerede}: ${kanit.tur}.${alan} alani ${tip} olmali`);
    }
  }
  for (const alan of Object.keys(kanit)) {
    if (alan !== "tur" && !(alan in sema)) {
      throw new TypeError(
        `${nerede}: ${kanit.tur} kanitinda tanimsiz "${alan}" alani var; ` +
          `kanit birlesimi kapalidir (ADR-004)`,
      );
    }
  }
}

/** Tek bir kanitin karari ve insan okunur ozeti. Saf. */
function karar(kanit) {
  switch (kanit.tur) {
    case "cikis_kodu":
      return kanit.kod === 0
        ? [GECTI, "cikis kodu 0"]
        : [KALDI, `cikis kodu ${kanit.kod}`];
    case "sema":
      return kanit.gecerli
        ? [GECTI, `sema ${kanit.sema} gecerli`]
        : [KALDI, `sema ${kanit.sema}: ${kanit.hatalar.length} hata`];
    case "test":
      if (kanit.kalan > 0) return [KALDI, `test ${kanit.gecen}/${kanit.kalan} kalan`];
      // Sifir test "gecti" degildir: kosmamis bir takim hicbir sey kanitlamaz.
      if (kanit.gecen === 0) return [DEGERLENDIRILMEDI, "test kosmadi"];
      return [GECTI, `test ${kanit.gecen}/0`];
    default: // olcum — esiksiz bir sayi tek basina karar veremez.
      return [DEGERLENDIRILMEDI, `olcum ${kanit.ad}=${String(kanit.deger)} esiksiz`];
  }
}

/** Sonucu tek yerde uretir; `gecti` her zaman `sonuc === GECTI`dir. */
function sonucUret(sonuc, kanitlar, aciklama) {
  return { sonuc, gecti: sonuc === GECTI, kanitlar, aciklama };
}

/**
 * Kurar. Secenek yok: bu modulun ayari olsaydi ayni girdi iki kurulumda iki
 * farkli sonuc verebilirdi — kararin tek satirlik testi tam olarak bu.
 */
export function degerlendirici() {
  return {
    gecerli_mi(kanitlar) {
      if (!Array.isArray(kanitlar)) {
        throw new TypeError("gecerli_mi: kanitlar bir dizi olmali");
      }
      kanitlar.forEach((k, i) => denetle(k, `kanit[${i}]`));

      if (kanitlar.length === 0) {
        return sonucUret(
          DEGERLENDIRILMEDI,
          [],
          "kanit yok: deterministik dogrulayici bulunamadi, insan kapisina dusuyor (ADR-004)",
        );
      }

      let sonuc = GECTI;
      const parcalar = [];
      for (const kanit of kanitlar) {
        const [k, ozet] = karar(kanit);
        if (ONCELIK[k] > ONCELIK[sonuc]) sonuc = k;
        parcalar.push(`${ozet} (${k})`);
      }
      return sonucUret(sonuc, kanitlar.slice(), `${sonuc}: ${parcalar.join("; ")}`);
    },

    esigi_asti_mi(olcum, esik) {
      denetle({ tur: "olcum", ...olcum }, "olcum");
      if (!tipUyuyor("sayi", esik)) {
        throw new TypeError("esigi_asti_mi: esik sonlu bir sayi olmali (metin ayristirilmaz)");
      }
      // Esik alt sinirdir: esige esit deger gecer.
      const gecti = olcum.deger >= esik;
      const kanit = { tur: "olcum", ad: olcum.ad, deger: olcum.deger };
      return sonucUret(
        gecti ? GECTI : KALDI,
        [kanit],
        `${gecti ? GECTI : KALDI}: ${olcum.ad} = ${String(olcum.deger)} ` +
          `${gecti ? ">=" : "<"} esik ${String(esik)}`,
      );
    },
  };
}
