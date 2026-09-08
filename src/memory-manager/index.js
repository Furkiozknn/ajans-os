/**
 * Memory Manager — katmanli bellek (U5).
 *
 * Blueprint §2.6 / docs/mimari/03-BELLEK.md. Uc kisit bu dosyada kod olarak
 * durur, yorumda degil:
 *
 *   1. **Yazma bir izin islemidir** (AP9 → kural 10). `yaz` ve `gecersiz_kil`
 *      bir `IzinKarari` **belgesi** alir; karar `ALLOW` degilse hicbir sey
 *      yazilmaz. Belgenin `action.operation` alani da `memory_write` olmak
 *      zorundadir: baska bir islem icin verilmis `ALLOW`, bellege yazma
 *      yetkisi degildir.
 *   2. **Kalici katman insan kapisindan gecer** (03-BELLEK §3). `project` ve
 *      `global` katmanlarina yazma, kapiya dusmus ve insan tarafindan
 *      cozulmus bir karar ister. Bunun belgedeki izi `supersedes`'tir:
 *      Permission Manager onayi isledigi kararda eski (`HUMAN_REQUIRED`)
 *      kaydi bu alanla gosterir. Dogrudan uretilmis bir `ALLOW`'da bu alan
 *      yoktur, dolayisiyla kapi atlanamaz.
 *   3. **Hicbir kayit uzerine yazilmaz** (D5). Guncelleme = yeni kayit +
 *      eskisinin gecersiz kilinmasi. Gecersiz kilinan kayit yerinde kalir
 *      ama varsayilan okumaya girmez (03-BELLEK §4).
 *
 * Kapsam disi: vektor arama / gomme (yol haritasi U5), saklama suresi isi ve
 * fiziksel silme (03-BELLEK §5), PII tespiti (sema duzeyinde, ADR-006).
 *
 * ADR-002: kardes modul import edilmez. Karar belgesi disaridan gelir, bu
 * modul Permission Manager'i cagirmaz. ADR-009: dosya sistemine dokunmaz.
 */

/** tipler.d.ts BellekKatmani — agent.schema.json $defs.memory_layer. */
const KATMANLAR = ["task", "session", "project", "global", "knowledge"];

/**
 * Okuma onceligi (03-BELLEK §4): "katman cakismasinda dar olan kazanir".
 * Dizinin sirasi kuralin kendisidir; sonuc bu sirayla doner.
 */
const OKUMA_SIRASI = KATMANLAR;

/** Yalnizca insan onayiyla yazilabilen katmanlar (03-BELLEK §3, kalici sinif). */
const INSAN_KAPISI_KATMANLARI = new Set(["project", "global"]);

/** contracts/*.json $defs.zaman — milisaniye yok. */
function simdi() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function metinMi(d) {
  return typeof d === "string" && d !== "";
}

/**
 * Metin suzgeci icin kucultme. **Yerel verilmez**: `toLocaleLowerCase("tr")`
 * "ISTANBUL"u "ıstanbul" yapar, sorgudaki "istanbul" ise "istanbul" kalir ve
 * ayni kelime eslesmez. Yerelden bagimsiz kucultme iki tarafi da `i`'ye
 * indirir. Bilincli sinir: noktali `İ` ile noktasiz `I` hala ayri harftir;
 * bunu cozmek metin normalizasyonu ister, U5 kapsaminda degil (kapsam disi:
 * vektor arama / gomme).
 */
function kucult(metin) {
  return metin.toLowerCase();
}

/**
 * Karar belgesini denetler. Kabul edilmeyen her durumda **istisna atar** ve
 * cagiran yazilmis bir kayit alamaz: "ALLOW degilse yazmaz" kurali burada
 * tek noktada durur, her cagri yolunda ayri ayri degil (kural 3).
 */
function izniDogrula(izin, katman, islem) {
  if (!izin || typeof izin !== "object") {
    throw new Error(`${islem}: izin karari belgesi zorunlu (AP9 → kural 10)`);
  }
  if (izin.decision !== "ALLOW") {
    throw new Error(
      `${islem}: karar '${izin.decision}' — yalnizca ALLOW yazar (karar ${izin.decision_id})`,
    );
  }
  if (!izin.action || izin.action.operation !== "memory_write") {
    throw new Error(
      `${islem}: karar '${izin.action?.operation}' islemi icin verilmis, bellege yazma yetkisi degil`,
    );
  }
  if (INSAN_KAPISI_KATMANLARI.has(katman) && !metinMi(izin.supersedes)) {
    throw new Error(
      `${islem}: '${katman}' katmani her zaman insan kapisina duser; ` +
        "kapidan gecmemis bir ALLOW ile yazilamaz (03-BELLEK §3)",
    );
  }
}

function kaydiDogrula(kayit) {
  if (!kayit || typeof kayit !== "object") throw new Error("yaz: kayit bir nesne olmali");
  if (!KATMANLAR.includes(kayit.katman)) {
    throw new Error(`yaz: gecersiz katman '${kayit.katman}'`);
  }
  if (!metinMi(kayit.icerik)) throw new Error("yaz: 'icerik' zorunlu");
  // Yeni bir kayit gecersiz dogamaz: gecersizlestirme ayri bir islemdir ve
  // kendi izin kararini ister (D5).
  if ("gecersiz_kilindi" in kayit || "yerine_gecen" in kayit) {
    throw new Error("yaz: yeni kayit gecersiz dogamaz; 'gecersiz_kil' kullan");
  }
}

/**
 * Katmanli bellek. Depo bellek icidir; kalicilik cagiranin isidir (ADR-002:
 * bu modul dosya sistemine dokunmaz).
 */
export function bellekYoneticisi() {
  /** id → kayit. Silme yok; gecersiz kilinan kayit burada kalir. */
  const kayitlar = new Map();
  /** Ayni saniyede yazilan kayitlarin sirasi zaman damgasindan cikarilamaz. */
  let sira = 0;

  function yeniId(katman) {
    return `bellek-${katman}-${String(kayitlar.size + 1).padStart(4, "0")}`;
  }

  return {
    async oku(sorgu) {
      // Kural 7 (AP6): kapsam belirtilmemisse sonuc **bos kumedir**, "hepsi"
      // degil. Bu yuzden katman listesi zorunlu ve bos liste bos sonuc verir.
      const katmanlar = Array.isArray(sorgu?.katmanlar) ? sorgu.katmanlar : [];
      if (katmanlar.length === 0) return [];
      for (const k of katmanlar) {
        if (!KATMANLAR.includes(k)) throw new Error(`oku: gecersiz katman '${k}'`);
      }

      const istenen = new Set(katmanlar);
      const gecmis = sorgu?.gecmis === true;
      const metin = metinMi(sorgu?.metin) ? kucult(sorgu.metin) : null;

      let sonuc = [...kayitlar.values()].filter((s) => {
        if (!istenen.has(s.kayit.katman)) return false;
        // Varsayilan yalnizca gecerli kayittir (03-BELLEK §4).
        if (!gecmis && s.kayit.gecersiz_kilindi) return false;
        if (metin && !kucult(s.kayit.icerik).includes(metin)) return false;
        return true;
      });

      // Dar katman once; katman icinde en yeni once (yazma sirasi).
      sonuc.sort((a, b) => {
        const fark = OKUMA_SIRASI.indexOf(a.kayit.katman) - OKUMA_SIRASI.indexOf(b.kayit.katman);
        return fark !== 0 ? fark : b.sira - a.sira;
      });

      if (Number.isInteger(sorgu?.limit)) {
        if (sorgu.limit < 0) throw new Error("oku: 'limit' negatif olamaz");
        sonuc = sonuc.slice(0, sorgu.limit);
      }
      return sonuc.map((s) => structuredClone(s.kayit));
    },

    async yaz(kayit, izin) {
      kaydiDogrula(kayit);
      izniDogrula(izin, kayit.katman, "yaz");

      const yeni = {
        ...structuredClone(kayit),
        id: yeniId(kayit.katman),
        yazildi: simdi(),
      };
      kayitlar.set(yeni.id, { kayit: yeni, sira: sira++ });
      return structuredClone(yeni);
    },

    async gecersiz_kil(id, yerine_gecen, izin) {
      const hedef = kayitlar.get(id);
      if (!hedef) throw new Error(`gecersiz_kil: kayit yok: ${id}`);
      if (id === yerine_gecen) throw new Error("gecersiz_kil: kayit kendini gecersiz kilamaz");
      // Gecersizlestirme bir **guncellemedir**: yerine gecen kayit gercekten
      // yazilmis olmalidir, yoksa bellek bosluga isaret eder (D5).
      if (!kayitlar.has(yerine_gecen)) {
        throw new Error(`gecersiz_kil: yerine gecen kayit yok: ${yerine_gecen}`);
      }
      if (hedef.kayit.gecersiz_kilindi) {
        throw new Error(`gecersiz_kil: kayit zaten gecersiz: ${id}`);
      }
      izniDogrula(izin, hedef.kayit.katman, "gecersiz_kil");

      hedef.kayit.gecersiz_kilindi = simdi();
      hedef.kayit.yerine_gecen = yerine_gecen;
      return structuredClone(hedef.kayit);
    },
  };
}
