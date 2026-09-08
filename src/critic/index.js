/**
 * Critic — bir LLM'dir ve **oyu gecme kararina girmez** (U10, blueprint §2.9).
 *
 * Bu modulu uc kural belirler:
 *
 *   1. **Cikti serbest metin degil.** `elestir` bir `string` dondurmez;
 *      `contracts/message.schema.json`'a uyan, `kind: "critique"` olan bir
 *      mesaj dondurur. Sema `payload.items`i zorunlu tutar (D8: elestiri bir
 *      sonraki cagrinin yapilandirilmis girdi alanidir) ve ust siniri 20'de
 *      sabitler (AP11). Bu sinir yapilandirmadan yukseltilemez.
 *   2. **Karar tarafina hicbir kanal yok.** Uretilen mesajda gecti/kaldi
 *      tasiyabilecek tek bir alan bile yoktur: `payload` yalnizca `items`,
 *      `truncated` ve istege bagli `raw_ref` icerir. Tasiyicinin dondurdugu
 *      fazladan alanlar (`sonuc`, `gecti`, `decision`...) sessizce
 *      atlanmaz — istisna atarlar. Sessiz yok sayma AP3'tur.
 *      `elestir` girdideki `degerlendirme` nesnesine de dokunmaz.
 *   3. **Elestiri ancak KALDI'dan sonra istenir.** `GECTI` bir adima elestiri
 *      yazilamaz (yazilabilseydi elestiri gecmis bir karari geri cevirmenin
 *      yolu olurdu); `DEGERLENDIRILMEDI` de elestiriye gitmez, insan
 *      kapisina gider (ADR-004). Ikisi de istisnadir.
 *
 * Ham cikti kaybolmaz (kural 12): ust sinir yuzunden kesilen maddeler
 * `truncated: true` ile bildirilir, ham kayit Observability izinde durur ve
 * mesaj yalnizca `raw_ref` ile ona isaret eder.
 *
 * ADR-002: bu modul kardes modul cagirmaz. Modelin kendisi disaridan verilen
 * `cagir` ile gelir — Model Router'i burada `import` etmek tek karar
 * noktasini bozardi; bagimlilik U13'te elle baglanir.
 *
 * Kapsam disi: elestiri kalitesini olcmek, istemi (prompt) secmek, mesaji
 * bir yere yazmak/gondermek.
 */

/** message.schema.json payload.items.maxItems — sema sabiti, ayar degil. */
export const EN_FAZLA_MADDE = 20;

const SIDDETLER = new Set(["dusuk", "orta", "yuksek"]);
const KEBAP = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Bir maddede izin verilen alanlar; disindaki her alan reddedilir. */
const MADDE_ALANLARI = new Set(["id", "severity", "location", "what", "fix_hint"]);

function simdi() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function kebapMi(deger) {
  return typeof deger === "string" && deger.length >= 2 && deger.length <= 64 && KEBAP.test(deger);
}

function metinMi(deger, enAz, enFazla) {
  return typeof deger === "string" && deger.length >= enAz && deger.length <= enFazla;
}

/**
 * Tasiyicidan gelen tek maddeyi sema alt kumesine karsi denetler. Gecersiz
 * madde duzeltilmez: bir LLM'in uydurdugu alani "herhalde boyle demek
 * istedi" diye yorumlamak, sozlesmeyi tasiyicinin insafina birakmak olur.
 */
function maddeyiDenetle(madde, nerede) {
  if (madde === null || typeof madde !== "object" || Array.isArray(madde)) {
    throw new TypeError(`${nerede}: madde bir nesne olmali, ${typeof madde} verildi`);
  }
  if (!kebapMi(madde.id)) throw new TypeError(`${nerede}.id kebab-id olmali`);
  if (!SIDDETLER.has(madde.severity)) {
    throw new TypeError(`${nerede}.severity ${[...SIDDETLER].join("|")} olmali`);
  }
  if (!metinMi(madde.what, 3, 600)) throw new TypeError(`${nerede}.what 3-600 karakter metin olmali`);
  if (!metinMi(madde.fix_hint, 3, 600)) {
    throw new TypeError(`${nerede}.fix_hint 3-600 karakter metin olmali`);
  }
  if (madde.location !== undefined && !metinMi(madde.location, 0, 300)) {
    throw new TypeError(`${nerede}.location en fazla 300 karakter metin olmali`);
  }
  for (const alan of Object.keys(madde)) {
    if (!MADDE_ALANLARI.has(alan)) {
      throw new TypeError(
        `${nerede}: tanimsiz "${alan}" alani. Elestiri maddesi kapali bir bicimdir; ` +
          `karar tasiyabilecek alan eklenemez (blueprint §2.9)`,
      );
    }
  }
  // Sadece izin verilen alanlar kopyalanir: gelen nesnenin prototipi ya da
  // sayilamayan alanlari mesaja sizmaz.
  const temiz = { id: madde.id, severity: madde.severity, what: madde.what, fix_hint: madde.fix_hint };
  if (madde.location !== undefined) temiz.location = madde.location;
  return temiz;
}

function mesajKimligi(step_id, deneme) {
  return `elestiri-${step_id}-${deneme}`.slice(0, 64).replace(/-+$/, "");
}

/**
 * Kurar.
 *
 * @param {{
 *   cagir: (girdi: unknown) => Promise<{ items: unknown[], raw_ref?: string }>,
 *   saat?: () => string,
 *   kimlik?: string,
 * }} secenekler
 *   `cagir` modele giden tek kapidir (ADR-002; U13'te Model Router baglanir).
 *   `saat` testte sabitlenebilsin diye disaridan verilebilir.
 *   `kimlik` mesajin `from.id` alani — varsayilan `critic`.
 */
export function elestirmen({ cagir, saat = simdi, kimlik = "critic" }) {
  if (typeof cagir !== "function") throw new TypeError("elestirmen: cagir bir fonksiyon olmali");
  if (!kebapMi(kimlik)) throw new TypeError("elestirmen: kimlik kebab-id olmali");

  return {
    async elestir(girdi) {
      if (girdi === null || typeof girdi !== "object") {
        throw new TypeError("elestir: girdi bir nesne olmali");
      }
      const { run_id, step_id, degerlendirme, adim_kaydi } = girdi;
      if (!kebapMi(run_id)) throw new TypeError("elestir: run_id kebab-id olmali");
      if (!kebapMi(step_id)) throw new TypeError("elestir: step_id kebab-id olmali");
      if (degerlendirme === null || typeof degerlendirme !== "object") {
        throw new TypeError("elestir: degerlendirme bir nesne olmali");
      }
      if (degerlendirme.sonuc !== "KALDI") {
        throw new Error(
          `elestir: elestiri yalnizca KALDI karari icin istenir, "${String(degerlendirme.sonuc)}" verildi. ` +
            `Elestirinin gecme kararina oyu yoktur; gecmis bir karari geri cevirmenin yolu degildir (blueprint §2.9)`,
        );
      }
      if (adim_kaydi === null || typeof adim_kaydi !== "object") {
        throw new TypeError("elestir: adim_kaydi bir nesne olmali");
      }

      const yanit = await cagir({
        run_id,
        step_id,
        // Karar **verilmis** olarak gider, sorulmaz: tasiyici yalnizca
        // "neden kaldi, sonraki denemede ne yapilmali" yazar.
        karar: degerlendirme.sonuc,
        kanitlar: degerlendirme.kanitlar ?? [],
        aciklama: degerlendirme.aciklama,
        adim_kaydi,
      });

      if (yanit === null || typeof yanit !== "object" || !Array.isArray(yanit.items)) {
        throw new TypeError("elestir: tasiyici { items: [...] } dondurmeli");
      }
      if (yanit.items.length === 0) {
        throw new Error("elestir: elestiri en az bir madde icermeli (sema minItems: 1)");
      }

      const kesildi = yanit.items.length > EN_FAZLA_MADDE;
      const items = yanit.items
        .slice(0, EN_FAZLA_MADDE)
        .map((m, i) => maddeyiDenetle(m, `items[${i}]`));

      const kimlikler = new Set(items.map((m) => m.id));
      if (kimlikler.size !== items.length) {
        throw new Error("elestir: madde kimlikleri benzersiz olmali; ayni id iki maddeye isaret edemez");
      }

      const payload = { items, truncated: kesildi };
      if (yanit.raw_ref !== undefined) {
        if (!metinMi(yanit.raw_ref, 1, Infinity)) throw new TypeError("elestir: raw_ref bos olmayan metin olmali");
        payload.raw_ref = yanit.raw_ref;
      }

      return {
        contract_version: "1.0",
        message_id: mesajKimligi(step_id, adim_kaydi.attempt ?? 1),
        run_id,
        step_id,
        at: saat(),
        from: { kind: "component", id: kimlik },
        to: { kind: "orchestrator", id: "orkestrator" },
        kind: "critique",
        payload,
      };
    },
  };
}
