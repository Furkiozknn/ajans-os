/**
 * Model Router — tek model siniri (U7).
 *
 * Blueprint §2.11 / ADR-000 K4: sinir **secim** ile **tasima** arasindan gecer.
 * Bu dosyada saglayiciya ozel tek bir ad, tek bir URL, tek bir istemci yoktur
 * ve olmayacaktir; bu bir iddia degil, `index.test.js` icinde olculen bir
 * kisittir ("saglayici adlari yalnizca yasak listesinde gecer" testi).
 *
 * Uc karar bu modulun tamamini belirler:
 *
 *   1. **Katalog veridir, koda gomulmez.** Hangi modelin hangi yetenegi
 *      tasidigi kurulusta disaridan gelir (kural 11'in secim tarafi). Kodda
 *      model listesi tutmak, listeyi guncellemek icin cekirdegi degistirmek
 *      demektir — AP4'un tam olarak uyardigi sessiz surukleme.
 *   2. **Secim deterministiktir ve sirali.** Kisitlari saglayan **ilk**
 *      katalog girdisi kazanir; sira operatorun tercihidir, calisma aninda
 *      hesaplanan bir puan degil. Ayni gereksinim her zaman ayni secimi verir.
 *   3. **Eslesme yoksa istisna atilir.** Kisitlari saglamayan bir modele
 *      sessizce dusmek (AP1) bu modulun onlemek icin var oldugu hatadir:
 *      cagiran "uzun-baglam" istedi, kisa baglamli model aldi ve bunu
 *      ancak yanit bozuldugunda ogrendi.
 *
 * Bilinmeyen maliyet sifir degildir (kural 11): `tavan_usd` verildiyse
 * `tahmini_usd`si olmayan girdi **elenir**. Butce siniri altinda calisirken
 * maliyeti bilinmeyen modeli secmek, tavani hic koymamakla ayni seydir.
 *
 * ADR-002: kardes modul import edilmez. Tavan Cost Manager'dan gelir ama
 * buraya **argüman olarak** gelir; bu modul kimseyi cagirmaz.
 * Kapsam disi: gercek saglayici tasiyicisi (U14 sonrasi), tekrar/geri cekilme
 * politikasi (tasima ayaridir, `tasima` sozlugunde tasinir).
 */

/** Katalog girdisinde zorunlu alanlar. */
function girdiDogrula(girdi, sira) {
  const nerede = `katalog[${sira}]`;
  if (girdi === null || typeof girdi !== "object") {
    throw new Error(`modelYonlendirici: ${nerede} bir nesne olmali`);
  }
  for (const alan of ["model_id", "saglayici"]) {
    if (typeof girdi[alan] !== "string" || girdi[alan].length === 0) {
      throw new Error(`modelYonlendirici: ${nerede}.${alan} bos olmayan bir metin olmali`);
    }
  }
  if (!Array.isArray(girdi.yetenekler) || girdi.yetenekler.some((y) => typeof y !== "string")) {
    throw new Error(`modelYonlendirici: ${nerede}.yetenekler metin dizisi olmali`);
  }
  if (typeof girdi.baglam_token !== "number" || !Number.isFinite(girdi.baglam_token) || girdi.baglam_token <= 0) {
    throw new Error(`modelYonlendirici: ${nerede}.baglam_token pozitif sonlu bir sayi olmali`);
  }
  // Bilinmeyen maliyet `null`dir, sifir degil: alan yoksa/null'sa girdi
  // maliyeti bilinmiyor sayilir; 0 yazmak "bedava" demektir ve yalandir.
  if (girdi.tahmini_usd !== undefined && girdi.tahmini_usd !== null) {
    if (typeof girdi.tahmini_usd !== "number" || !Number.isFinite(girdi.tahmini_usd) || girdi.tahmini_usd < 0) {
      throw new Error(`modelYonlendirici: ${nerede}.tahmini_usd negatif olmayan bir sayi ya da null olmali`);
    }
  }
  if (girdi.tasima !== undefined && (girdi.tasima === null || typeof girdi.tasima !== "object")) {
    throw new Error(`modelYonlendirici: ${nerede}.tasima bir nesne olmali`);
  }
}

/** Tasiyicinin dondurdugu belge bir guven sinirindan gecer; korunmadan alinmaz. */
function yanitDogrula(yanit, secim) {
  const nerede = `cagir(${secim.model_id})`;
  if (yanit === null || typeof yanit !== "object") {
    throw new Error(`${nerede}: tasiyici bir nesne dondurmedi`);
  }
  if (yanit.usage === null || typeof yanit.usage !== "object" || Array.isArray(yanit.usage)) {
    // usage olmadan cagri **olculemez**: Cost Manager'in ve Observability'nin
    // tek girdisi budur. Eksik usage'i bos sozlukle doldurmak sifir maliyet
    // raporlamaktir (AP10) — o yuzden doldurulmuyor, reddediliyor.
    throw new Error(`${nerede}: tasiyici 'usage' dondurmedi; olculemeyen cagri kabul edilmez`);
  }
  for (const [sayac, deger] of Object.entries(yanit.usage)) {
    if (typeof deger !== "number" || !Number.isFinite(deger)) {
      throw new Error(`${nerede}: usage.${sayac} sonlu bir sayi olmali (gelen: ${deger})`);
    }
  }
  if (yanit.cost !== undefined && (yanit.cost === null || typeof yanit.cost !== "object")) {
    throw new Error(`${nerede}: 'cost' bir sozluk olmali`);
  }
}

/**
 * @param {{ katalog: ReadonlyArray<object>, tasiyicilar?: ReadonlyArray<object> }} secenekler
 */
export function modelYonlendirici({ katalog, tasiyicilar = [] } = {}) {
  if (!Array.isArray(katalog) || katalog.length === 0) {
    throw new Error("modelYonlendirici: 'katalog' bos olmayan bir dizi olmali (katalog veridir, koda gomulmez)");
  }
  const gorulen = new Set();
  const kayit = katalog.map((girdi, sira) => {
    girdiDogrula(girdi, sira);
    if (gorulen.has(girdi.model_id)) {
      // Yinelenen kimlik sirayi belirsiz kilar: hangi girdi kazandi sorusunun
      // tek cevabi olmazsa "ayni gereksinim ayni secim" iddiasi cokerdi.
      throw new Error(`modelYonlendirici: katalogda yinelenen model_id: '${girdi.model_id}'`);
    }
    gorulen.add(girdi.model_id);
    return Object.freeze({
      model_id: girdi.model_id,
      saglayici: girdi.saglayici,
      yetenekler: Object.freeze([...girdi.yetenekler]),
      baglam_token: girdi.baglam_token,
      tahmini_usd: girdi.tahmini_usd ?? null,
      tasima: Object.freeze({ ...(girdi.tasima ?? {}) }),
    });
  });

  /** Saglayici adi → tasiyici. Bos olabilir: `sec` tasiyicisiz de calisir (K4). */
  const tasiyiciEslemesi = new Map();
  for (const [sira, t] of tasiyicilar.entries()) {
    if (t === null || typeof t !== "object" || typeof t.saglayici !== "string" || typeof t.cagir !== "function") {
      throw new Error(`modelYonlendirici: tasiyicilar[${sira}] 'saglayici' ve 'cagir' tasimali`);
    }
    if (tasiyiciEslemesi.has(t.saglayici)) {
      throw new Error(`modelYonlendirici: '${t.saglayici}' icin iki tasiyici verildi`);
    }
    tasiyiciEslemesi.set(t.saglayici, t);
  }

  return {
    katalog: Object.freeze(kayit),

    sec(gereksinim) {
      if (gereksinim === null || typeof gereksinim !== "object") {
        throw new Error("sec: 'gereksinim' bir nesne olmali");
      }
      const { yetenekler, en_az_baglam_token, tavan_usd } = gereksinim;
      if (!Array.isArray(yetenekler) || yetenekler.some((y) => typeof y !== "string")) {
        throw new Error("sec: 'yetenekler' metin dizisi olmali (bos dizi kisit koymaz)");
      }
      if (en_az_baglam_token !== undefined && (typeof en_az_baglam_token !== "number" || !Number.isFinite(en_az_baglam_token))) {
        throw new Error(`sec: 'en_az_baglam_token' sonlu bir sayi olmali (gelen: ${en_az_baglam_token})`);
      }
      if (tavan_usd !== undefined && tavan_usd !== null && (typeof tavan_usd !== "number" || !Number.isFinite(tavan_usd))) {
        throw new Error(`sec: 'tavan_usd' sonlu bir sayi ya da null olmali (gelen: ${tavan_usd})`);
      }

      const elenme = [];
      for (const girdi of kayit) {
        const eksik = yetenekler.filter((y) => !girdi.yetenekler.includes(y));
        if (eksik.length > 0) {
          elenme.push(`${girdi.model_id}: eksik yetenek ${eksik.join(", ")}`);
          continue;
        }
        if (en_az_baglam_token !== undefined && girdi.baglam_token < en_az_baglam_token) {
          elenme.push(`${girdi.model_id}: baglam ${girdi.baglam_token} < ${en_az_baglam_token}`);
          continue;
        }
        if (tavan_usd !== undefined && tavan_usd !== null) {
          if (girdi.tahmini_usd === null) {
            elenme.push(`${girdi.model_id}: maliyeti bilinmiyor, tavan altinda secilemez`);
            continue;
          }
          if (girdi.tahmini_usd > tavan_usd) {
            elenme.push(`${girdi.model_id}: ${girdi.tahmini_usd} > tavan ${tavan_usd}`);
            continue;
          }
        }
        // Kisitlari saglayan ilk girdi kazanir; sira operatorun tercihidir.
        return {
          model_id: girdi.model_id,
          saglayici: girdi.saglayici,
          tasima: { ...girdi.tasima },
        };
      }

      throw new Error(
        `sec: gereksinimi karsilayan model yok. Elenenler — ${elenme.join("; ")}`,
      );
    },

    async cagir(secim, istem) {
      if (secim === null || typeof secim !== "object" || typeof secim.saglayici !== "string" || typeof secim.model_id !== "string") {
        throw new Error("cagir: 'secim' bir ModelSecimi olmali (model_id + saglayici)");
      }
      const tasiyici = tasiyiciEslemesi.get(secim.saglayici);
      if (tasiyici === undefined) {
        throw new Error(
          `cagir: '${secim.saglayici}' icin tasiyici yok (kurulu: ${[...tasiyiciEslemesi.keys()].join(", ") || "hicbiri"})`,
        );
      }

      // Tasiyicinin hatasi buradan gecer, yutulmaz: tekrar/geri cekilme bir
      // tasima ayaridir ve `secim.tasima` sozlugunde tasinir — cekirdek
      // kendiliginden yeniden denemez.
      const yanit = await tasiyici.cagir(secim, istem);
      yanitDogrula(yanit, secim);

      return {
        icerik: yanit.icerik,
        usage: { ...yanit.usage },
        cost: { ...(yanit.cost ?? {}) },
        model_id: yanit.model_id ?? secim.model_id,
      };
    },
  };
}
