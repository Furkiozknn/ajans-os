/**
 * Orchestrator — adim dongusunun sahibi (U13).
 *
 * Blueprint §3.1/§3.2 + ADR-002. Bu dosyanin tamamini uc karar belirliyor:
 *
 *   1. **Cagri yonu tek yonlu.** 12 bileseni yalnizca burasi cagirir; hicbir
 *      kardes modul digerini import etmez. `OrchestratorBagimliliklari` bu
 *      kuralin tip karsiligidir, bagimliliklar elle baglanir — enjeksiyon
 *      catisi yok (08 §6). Ihlali `arac/yapi-dogrula.js` yakalar.
 *
 *   2. **Sira sabittir.** `adimi_yurut` blueprint §3.2'nin 1–10 sirasini
 *      birebir izler; sira bir yorum degil, test edilen bir olgudur
 *      (`index.test.js` "cagri sirasi" testi tum cagrilari kaydeder).
 *      Sirayi degistirmek blueprint'i degistirmeyi gerektirir.
 *
 *   3. **Kosu durabilir.** `HUMAN_REQUIRED` bir hata degil, planli bir
 *      duraktir: adim `ONAY_BEKLIYOR`a yazilir ve dongu **devam etmez**
 *      (§3.2/7 "surec olebilir"). Ayni sey degerlendirilmemis adim icin de
 *      gecerlidir (D11): "kontrol edilmedi" temiz sayilmaz.
 *
 * Politika bu dosyada yasamaz. Retry hakki adimin `retry` alanindan, kurtarma
 * modu `recovery-manager`dan, izin karari `permission-manager`dan gelir; burasi
 * yalnizca sirayi yurutur ve kararlara uyar.
 *
 * Kapsam disi (yol haritasi U13): paralel adim yurutme, planlayici ve **aracin
 * kendisinin calistirilmasi** — 12 bagimliligin hicbiri bir arac yurutucusu
 * degil, §3.2/7 arac semasi + izin karariyla biter. Gercek calistirma U14'un
 * tasiyici isi.
 */

/** `OrchestratorBagimliliklari` alanlari; eksigi kurulusta yakalanir. */
const GEREKLI_BAGIMLILIKLAR = [
  "gorev_yoneticisi",
  "ajan_defteri",
  "arac_defteri",
  "izin_yoneticisi",
  "bellek_yoneticisi",
  "baglam_yoneticisi",
  "degerlendirici",
  "elestirmen",
  "kurtarma_yoneticisi",
  "model_yonlendirici",
  "maliyet_yoneticisi",
  "gozlem",
];

/** Ajanin okuyacagi bellek katmanlari; sozlesme sessizse gorev/oturum/proje. */
const VARSAYILAN_KATMANLAR = ["task", "session", "project"];

const VARSAYILAN_BAGLAM_TOKEN = 200000;
const VARSAYILAN_TAMPON_TOKEN = 2000;

/** Sema zaman deseni milisaniye kabul etmiyor (task-manager ile ayni bicim). */
function simdi() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * ponytail: token sayisi 4 karakter = 1 token kabaligiyla tahmin ediliyor.
 * Gercek sayaci saglayici verir (`ModelTasiyici`); tasiyici bir sayac
 * sunduğunda burasi ona devredilir. Baglam butcesi icin kabalik yeterli,
 * cunku `context-manager` esigi zaten %90'da tutuyor.
 */
function tokenTahmini(deger) {
  const metin = typeof deger === "string" ? deger : JSON.stringify(deger ?? "");
  return Math.ceil(metin.length / 4);
}

function adimBul(gorev, adim_id) {
  const adim = gorev.graph.steps.find((a) => a.id === adim_id);
  if (!adim) throw new Error(`orkestrator: gorev grafinda boyle bir adim yok: ${adim_id}`);
  return adim;
}

/**
 * Model yanitindaki arac cagrisi. Tasiyicidan gelen icerik sozlesmeli degil
 * (tipi `unknown`), bu yuzden bicim burada bir kez okunur ve baska yerde
 * varsayilmaz.
 */
function aracCagrisi(icerik) {
  const c = icerik && typeof icerik === "object" ? icerik.arac_cagrisi : null;
  if (!c || typeof c.ad !== "string") return null;
  return { ad: c.ad, argumanlar: c.argumanlar ?? {} };
}

/**
 * `recovery-manager` telafi bilgisini disaridan bekler. Yan etkisi olmayan
 * adimda telafi edilecek sey yoktur; yan etkili adimda telafi ancak sozlesmede
 * tanimliysa vardir. Tanimsizsa `false` doner ve kurtarma insan kapisina gider
 * (AP8) — bu modul hicbir yan etkiyi kendi basina geri sarmaz.
 */
function telafiVar(adim, kayit) {
  const yapilmis = Array.isArray(kayit?.side_effects_done) && kayit.side_effects_done.length > 0;
  if (!adim.side_effects && !yapilmis) return true;
  return Boolean(adim.compensation && adim.compensation.method);
}

/**
 * Bilesim koku. 12 bagimlilik elle baglanir; `secenekler` yalnizca baglam
 * penceresini ve saati verir (ikisi de calisma ortamindan gelir, mimariden
 * degil).
 */
export function orkestrator(bagimliliklar, secenekler = {}) {
  const eksik = GEREKLI_BAGIMLILIKLAR.filter((ad) => !bagimliliklar || !bagimliliklar[ad]);
  if (eksik.length > 0) {
    // Yarim bagli bir orkestrator ilk adimda coker; hatayi kurulusta vermek
    // ucuz, kosu ortasinda vermek pahalidir.
    throw new Error(`orkestrator: eksik bagimlilik: ${eksik.join(", ")}`);
  }

  const d = bagimliliklar;
  const {
    baglam_token = VARSAYILAN_BAGLAM_TOKEN,
    tampon_token = VARSAYILAN_TAMPON_TOKEN,
    saat = simdi,
  } = secenekler;

  let spanSayaci = 0;

  /** Adima atanmis ajan. Yonlendirme ayri bir servis degil (blueprint §4.2). */
  async function ajanSec(adim) {
    const atama = adim.assign || {};
    if (atama.mode === "agent" && atama.agent_id) return d.ajan_defteri.getir(atama.agent_id);
    const adaylar = await d.ajan_defteri.listele({ role: atama.role, status: "active" });
    return adaylar && adaylar.length > 0 ? adaylar[0] : null;
  }

  function bellekKatmanlari(ajan) {
    const kapsam = ajan && ajan.memory_scope;
    const okur = kapsam && Array.isArray(kapsam.read) ? kapsam.read : null;
    return okur && okur.length > 0 ? okur : VARSAYILAN_KATMANLAR;
  }

  /**
   * Tek adim: blueprint §3.2'nin 1–10 sirasi. Numaralar asagidaki yorumlarda
   * duruyor ve testte ayni sirayla bekleniyor.
   */
  async function adimi_yurut(gorev, adim_id) {
    const adim = adimBul(gorev, adim_id);
    const run_id = gorev.run.run_id;
    /** 1–9 arasinda biriken span'lar; 10. adimda tek yonlu yazilir. */
    const olaylar = [];
    let kok = null;

    const izle = (operation, name, outcome = { status: "ok" }) => {
      const span = {
        contract_version: "1.0",
        span_id: `${run_id}-span-${(spanSayaci += 1)}`,
        trace_id: run_id,
        parent_span_id: kok,
        run_id,
        step_id: adim_id,
        operation,
        name,
        started_at: saat(),
        outcome,
      };
      if (kok === null) kok = span.span_id;
      olaylar.push(span);
    };

    // 1 — yan etkiden ONCE yazilir (ADR-003 iki yazma).
    let kayit = await d.gorev_yoneticisi.basladi_yaz(gorev, adim_id);
    izle("run", `adim ${adim_id}`);

    /** Hata yolu: mod kurtarma yoneticisinden gelir, burada secilmez. */
    async function kurtar(hata_turu, mesaj) {
      const kurtarma = d.kurtarma_yoneticisi.mod_sec({
        hata_turu,
        deneme: kayit.attempt,
        step_id: adim_id,
        telafi_var: telafiVar(adim, kayit),
      });
      izle("recovery", `recovery ${kurtarma.mod}`, {
        status: "hata",
        error_type: hata_turu,
        error_message: String(mesaj).slice(0, 2000),
      });
      if (kurtarma.mod === "insan-kapisi") {
        const bekleyen = await d.gorev_yoneticisi.durum_degistir(
          gorev,
          adim_id,
          "ONAY_BEKLIYOR",
          `kurtarma-kapisi:${adim_id}:${hata_turu}`,
        );
        return { ...bekleyen, kurtarma_modu: kurtarma.mod };
      }
      const basarisiz = await d.gorev_yoneticisi.basarisiz_yaz(gorev, adim_id, {
        error_type: hata_turu,
        error_message: String(mesaj).slice(0, 2000),
      });
      return { ...basarisiz, kurtarma_modu: kurtarma.mod };
    }

    try {
      // 2 — ajan sozlesmesi
      const ajan = await ajanSec(adim);
      izle(
        "invoke_agent",
        `invoke_agent ${ajan && ajan.identity ? ajan.identity.id : "yok"}`,
        ajan ? { status: "ok" } : { status: "hata", error_type: "BAGIMLILIK_BASARISIZ" },
      );
      if (!ajan) return await kurtar("BAGIMLILIK_BASARISIZ", `adim ${adim_id} icin ajan bulunamadi`);

      // 3 — yalnizca gecerli bellek kayitlari (gecmis istenmiyor)
      const anilar = await d.bellek_yoneticisi.oku({
        katmanlar: bellekKatmanlari(ajan),
        metin: adim.title,
      });
      izle("run", `bellek okuma (${anilar.length})`);

      // 4 — baglam butcesi; kisilma sirasi kurulusta yazili, burada degil
      const butce = d.baglam_yoneticisi.butcele({
        toplam: baglam_token,
        sistem_sozlesmesi: tokenTahmini(ajan),
        gorev_durumu: tokenTahmini({ gorev: gorev.task, adim, kayitlar: gorev.run.step_records }),
        bilgi: tokenTahmini(anilar),
        sorgu: tokenTahmini(adim.title),
        tampon: tampon_token,
      });
      izle("run", `baglam butcesi (kalan ${butce.kalan})`);

      // 5 — model secimi ve cagrisi
      const secim = d.model_yonlendirici.sec({
        yetenekler: Array.isArray(ajan.capabilities) ? ajan.capabilities : [],
        en_az_baglam_token: baglam_token - butce.kalan,
      });
      const yanit = await d.model_yonlendirici.cagir(secim, {
        ajan,
        adim,
        anilar,
        butce: butce.bilesenler,
      });
      izle("inference", `inference ${yanit.model_id}`, { status: "ok" });

      // 6 — usage maliyete duser; esik asildiysa faz gecisi kosuyu_yurut'ta
      const { maliyet_usd } = d.maliyet_yoneticisi.usage_isle(yanit.model_id, yanit.usage);
      izle("run", `maliyet ${maliyet_usd === null ? "bilinmiyor" : maliyet_usd}`);

      // 7 — arac cagrisi varsa: sema, sonra izin. Ajan araci dogrudan cagiramaz.
      const cagri = aracCagrisi(yanit.icerik);
      let onay_ref;
      if (cagri) {
        const aracKaydi = await d.arac_defteri.getir(cagri.ad);
        izle(
          "execute_tool",
          `execute_tool ${cagri.ad}`,
          aracKaydi ? { status: "ok" } : { status: "hata", error_type: "ARAC_HATASI" },
        );
        if (!aracKaydi) return await kurtar("ARAC_HATASI", `arac defterinde yok: ${cagri.ad}`);

        const dogrulama = d.arac_defteri.argumanlari_dogrula(cagri.ad, cagri.argumanlar);
        if (!dogrulama.gecerli) return await kurtar("SEMA_IHLALI", dogrulama.hatalar.join("; "));

        const karar = await d.izin_yoneticisi.karar({
          run_id,
          step_id: adim_id,
          requester: { kind: "agent", id: ajan.identity.id },
          action: {
            tool: cagri.ad,
            operation: aracKaydi.operation,
            summary: adim.title,
          },
          scope: Array.isArray(adim.writes) && adim.writes.length > 0 ? adim.writes : [adim_id],
          irreversible: Boolean(aracKaydi.irreversible),
        });
        izle("permission_check", `permission_check ${karar.decision}`, {
          status: karar.decision === "ALLOW" ? "ok" : "kesildi",
        });

        if (karar.decision === "HUMAN_REQUIRED") {
          // Kosu burada DURUR. Karar zaten insan kapisina yazildi (gate_ref);
          // orkestrator ikinci kez yazmaz, yalnizca adimi bekleme durumuna alir.
          return await d.gorev_yoneticisi.durum_degistir(
            gorev,
            adim_id,
            "ONAY_BEKLIYOR",
            karar.gate_ref || karar.decision_id,
          );
        }
        if (karar.decision === "BLOCK") return await kurtar("IZIN_REDDI", karar.reason);
        onay_ref = karar.decision_id;
      }

      // 8 — deterministik kapi; kaldiysa elestiri, sonra kurtarma modu
      const kanitlar =
        yanit.icerik && Array.isArray(yanit.icerik.kanitlar) ? yanit.icerik.kanitlar : [];
      const degerlendirme = d.degerlendirici.gecerli_mi(kanitlar);
      izle("evaluate", `evaluate ${degerlendirme.sonuc}`);

      if (degerlendirme.sonuc === "KALDI") {
        const elestiri = await d.elestirmen.elestir({
          run_id,
          step_id: adim_id,
          degerlendirme,
          adim_kaydi: kayit,
        });
        izle("critique", `critique ${elestiri.message_id}`);
        return await kurtar("DOGRULAMA_KALDI", degerlendirme.aciklama);
      }

      if (degerlendirme.sonuc === "DEGERLENDIRILMEDI") {
        // D11: dogrulayici bulunamayan adim GECTI sayilmaz; kapiya duser ve
        // kosu durur. `bitti_yaz` zaten boyle bir kaydi approval_ref'siz
        // kapatmiyor — iki yerde ayni kural, ikisi de kapali.
        return await d.gorev_yoneticisi.durum_degistir(
          gorev,
          adim_id,
          "ONAY_BEKLIYOR",
          `degerlendirme-yok:${adim_id}`,
        );
      }

      // 9 — yan etkiden SONRA yazilir
      kayit = await d.gorev_yoneticisi.bitti_yaz(gorev, adim_id, {
        result_summary: `${adim.title} — ${degerlendirme.sonuc}`.slice(0, 2000),
        cost_usd: maliyet_usd,
        evaluation_result: degerlendirme.sonuc,
        ...(Array.isArray(adim.writes) && adim.writes.length > 0 ? { artifacts: adim.writes } : {}),
        ...(onay_ref ? { approval_ref: onay_ref } : {}),
      });
      izle("run", `adim bitti ${adim_id}`);
      return kayit;
    } catch (hata) {
      // Beklenmeyen cokme de bir hata turudur; siniflandirilmadigi icin
      // BILINMEYEN'e duser ve kurtarma yoneticisi guvenli tarafi secer.
      return await kurtar("BILINMEYEN", hata && hata.message ? hata.message : String(hata));
    } finally {
      // 10 — 1–9 arasindaki her olay icin span. Tek yonlu: gozlem hicbir sey
      // dondurmez ve yazma hatasi kosuyu dusurmez (U12 karari).
      for (const span of olaylar) d.gozlem.span_yaz(span);
    }
  }

  /** Ortak dongu; `kosuyu_yurut` ve `kosuyu_surdur` ayni yoldan gecer. */
  async function dongu(gorev) {
    const adim_kayitlari = [];
    const run_id = gorev.run.run_id;
    // Ust sinir: her adim deneme hakki kadar donebilir. Sonsuz donguye karsi
    // sayac, cunku `sonraki_adim` basarisiz adimi hakki bitene dek geri verir.
    const tavan =
      gorev.graph.steps.reduce((n, a) => n + ((a.retry && a.retry.max_attempts) || 1), 0) + 1;

    for (let tur = 0; tur < tavan; tur += 1) {
      const adim = d.gorev_yoneticisi.sonraki_adim(gorev);
      if (!adim) return { run_id, son: "bitti", adim_kayitlari };

      const kayit = await adimi_yurut(gorev, adim.id);
      adim_kayitlari.push(kayit);

      if (kayit.status === "ONAY_BEKLIYOR") return { run_id, son: "onay-bekliyor", adim_kayitlari };

      if (kayit.status === "BASARISIZ") {
        const hak = (adim.retry && adim.retry.max_attempts) || 1;
        const yeniden =
          (kayit.kurtarma_modu === "duzelt" || kayit.kurtarma_modu === "temiz-sayfa") &&
          kayit.attempt < hak;
        if (!yeniden) return { run_id, son: "basarisiz", adim_kayitlari };
        continue;
      }

      // Butce esigi asildiysa bu bir cokme degil, planli faz gecisidir.
      if (d.maliyet_yoneticisi.gecis_gerekli_mi()) return { run_id, son: "butce", adim_kayitlari };
    }

    return { run_id, son: "kesildi", adim_kayitlari };
  }

  return {
    async kosuyu_yurut(gorev) {
      return dongu(gorev);
    },

    /**
     * Yarim kalmis kosuyu ayni gorev kaydindan surdurur (D1). Tamamlanmis adim
     * tekrarlanmaz: `sonraki_adim` BITTI kaydi olan adimi atlar, `basladi_yaz`
     * kapanmis adimi ikinci kez baslatmayi reddeder. Yani tekrar etmeme
     * burada bir "unutmama" degil, iki ayri yerde kapali bir kapidir.
     */
    async kosuyu_surdur(gorev, run_id) {
      if (gorev.run.run_id !== run_id) {
        throw new Error(
          `kosuyu_surdur: gorev kaydindaki kosu ${gorev.run.run_id}, istenen ${run_id}`,
        );
      }
      return dongu(gorev);
    },

    adimi_yurut,
  };
}
