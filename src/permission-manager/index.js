/**
 * Permission Manager — tek gecit (U4).
 *
 * Blueprint §2.5 / ADR-005: ajan araci dogrudan cagiramaz. Karar **uc
 * degerlidir** (`ALLOW` / `BLOCK` / `HUMAN_REQUIRED`) ve ucu de bir
 * `IzinKarari` **belgesi** olarak doner — `BLOCK` ve `HUMAN_REQUIRED` istisna
 * degildir, cunku karar veri olarak kaydedilebilmelidir (kanit zinciri).
 * Istisna yalnizca bozuk **istek** ve bozuk **bagimlilik** icin atilir; bunlar
 * karar degil, yapilandirma hatasidir.
 *
 * Uc kural bu dosyada kod olarak durur, yapilandirmadan okunmaz (ADR-005/1):
 *
 *   1. `SABIT_SINIRLAR` kumesi burada tanimlidir. Cagiran bir kural
 *      **ekleyebilir** (`istek.sabit_sinir`), hicbir alan kaldiramaz;
 *      `--yes-always` karsiligi bir parametre yoktur.
 *   2. `reliability` istekten **alinmaz**, calisan denetleyicilerden turetilir.
 *      Cagiranin "kontrol ettim, temizdi" demesi mumkun degil (D11).
 *   3. `severity` islem sinifindan turetilir; `istek.severity` yalnizca
 *      **yukseltebilir**, dusuremez.
 *
 * ADR-007: `ALLOW` `binding` olmadan yazilamaz. Bunun dogrudan sonucu su:
 * sabit sinira dokunan ya da geri alinamaz bir cagri, **insan onayladiktan
 * sonra bile** `ALLOW` kaydi uretmez — sema boyle bir kaydi zaten reddeder.
 * O durumda `onayi_isle` onayi `grant` alani ile `HUMAN_REQUIRED` kaydinin
 * uzerine yazar ve yeniden kullanilabilir izin **kaydetmez**: her cagri kapiya
 * dusmeye devam eder. Eylemi kimin yurutecegi U13'un (Orchestrator) isi.
 *
 * ADR-002: kardes modul import edilmez. Insan kapisina yazma isi disaridan
 * verilen `kapi` fonksiyonudur; bu modul dosya sistemine dokunmaz.
 */

/** tipler.d.ts IzinSinifi. */
const IZIN_SINIFLARI = new Set([
  "read", "write", "execute", "network", "delete", "publish", "memory_write",
]);

/** permission.schema.json hard_limit.rule — CLAUDE.md listesiyle birebir. */
const SABIT_SINIR_KURALLARI = new Set([
  "kimlik-bilgisi-girme",
  "kalici-silme",
  "para-transferi",
  "hesap-acma",
  "sistem-guvenlik-ayari",
  "disari-yayin-gonderim",
]);

/**
 * Islem sinifindan dogrudan tetiklenen sabit sinirlar. Liste uzatilabilir,
 * daraltilamaz: burada olmayan bir kural `istek.sabit_sinir` ile eklenebilir
 * ama buradaki eslesme hicbir girdiyle atlanamaz.
 */
const ISLEMDEN_SABIT_SINIR = {
  delete: "kalici-silme",
  publish: "disari-yayin-gonderim",
};

/** Siddet islem sinifindan turer; istek yalnizca yukseltebilir. */
const SIDDET = {
  read: "dusuk",
  write: "orta",
  execute: "orta",
  network: "orta",
  memory_write: "orta",
  delete: "yuksek",
  publish: "yuksek",
};
const SIDDET_SIRASI = ["dusuk", "orta", "yuksek"];

/** permission.schema.json $defs.zaman — milisaniye yok. */
function simdi() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function metinMi(d) {
  return typeof d === "string" && d !== "";
}

function istegiDogrula(istek) {
  if (!istek || typeof istek !== "object") throw new Error("izin istegi bir nesne olmali");
  const { run_id, requester, action, scope } = istek;
  if (!metinMi(run_id)) throw new Error("izin istegi: 'run_id' zorunlu");
  if (!requester || !metinMi(requester.id)) throw new Error("izin istegi: 'requester.id' zorunlu");
  if (!["agent", "orchestrator", "component"].includes(requester.kind)) {
    throw new Error(`izin istegi: gecersiz 'requester.kind': ${requester.kind}`);
  }
  if (!action || !metinMi(action.tool)) throw new Error("izin istegi: 'action.tool' zorunlu");
  if (!IZIN_SINIFLARI.has(action.operation)) {
    throw new Error(`izin istegi: gecersiz izin sinifi '${action.operation}'`);
  }
  if (!metinMi(action.summary) || action.summary.length < 3) {
    throw new Error("izin istegi: 'action.summary' en az 3 karakter olmali");
  }
  // ADR-005/3: kapsam belirtilmemisse sonuc bos kumedir, "hepsi" degil. Bos
  // kume bir karara donusemez (sema minItems:1), bu yuzden bozuk istektir.
  if (!Array.isArray(scope) || scope.length === 0 || !scope.every(metinMi)) {
    throw new Error("izin istegi: 'scope' en az bir somut hedef icermeli (ADR-005/3)");
  }
  if (typeof istek.irreversible !== "boolean") {
    throw new Error("izin istegi: 'irreversible' bir boolean olmali");
  }
  if (istek.sabit_sinir !== undefined && !SABIT_SINIR_KURALLARI.has(istek.sabit_sinir)) {
    throw new Error(`izin istegi: bilinmeyen sabit sinir kurali '${istek.sabit_sinir}'`);
  }
}

/** Kod tarafli sabit sinir taramasi. Girdi bunu genisletebilir, kapatamaz. */
function sabitSinir(istek) {
  const kural = ISLEMDEN_SABIT_SINIR[istek.action.operation] || istek.sabit_sinir;
  return kural ? { hit: true, rule: kural } : { hit: false };
}

/** Kapsam esleme: her hedef, verilen izinli kapsamin bir onekiyle baslamali. */
function kapsamDenetle(istek) {
  const izinli = istek.izinli_kapsam;
  if (!Array.isArray(izinli)) {
    // D11: "bakilmadi" ile "bakildi, temiz" ayri degerlerdir.
    return { id: "kapsam-eslesme", result: "calistirilmadi", detail: "Ajan sozlesmesinden izinli kapsam verilmedi." };
  }
  const disarida = istek.scope.filter((h) => !izinli.some((o) => h === o || h.startsWith(o)));
  if (disarida.length) {
    return { id: "kapsam-eslesme", result: "kaldi", detail: `Kapsam disi hedef: ${disarida.join(", ")}` };
  }
  return { id: "kapsam-eslesme", result: "gecti" };
}

function surumDenetle(istek) {
  const d = istek.binding?.digest;
  if (!metinMi(d)) {
    return { id: "surum-bagi", result: "calistirilmadi", detail: "Bilesen ozeti verilmedi (ADR-007/2)." };
  }
  return { id: "surum-bagi", result: "gecti" };
}

/** Guvenilirlik denetleyicilerden turer; golge denetleyici karara girmez. */
function guvenilirlik(denetler) {
  const gercek = denetler.filter((c) => c.shadow !== true);
  if (gercek.length === 0) return "kontrol-edilmedi";
  return gercek.every((c) => c.result === "gecti") ? "guclu" : "zayif";
}

function siddet(istek) {
  const taban = SIDDET[istek.action.operation];
  const istenen = istek.severity;
  if (!SIDDET_SIRASI.includes(istenen)) return taban;
  return SIDDET_SIRASI.indexOf(istenen) > SIDDET_SIRASI.indexOf(taban) ? istenen : taban;
}

/**
 * Semanin `ALLOW` yazmaya izin verdigi durum (permission.schema.json allOf):
 * sabit sinir yok, telafisi var, bilesen ozeti bagli.
 */
function allowYazilabilir(kayit) {
  return kayit.hard_limit.hit !== true && kayit.irreversible !== true && !!kayit.binding;
}

/**
 * ADR-007/3: yeniden kullanilabilir izin ozetsiz, suresiz veya tavansiz
 * verilemez. "Suresiz" diye bir mod yoktur; olmayan modu burada reddediyoruz
 * ki sema ihlali kayit anina degil onay anina dussun.
 */
function grantDogrula(grant) {
  if (grant === undefined) return { mode: "tek-cagri" };
  const izin = structuredClone(grant);
  if (!["tek-cagri", "oturum", "sureli"].includes(izin.mode)) {
    throw new Error(`gecersiz grant.mode: ${izin.mode}`);
  }
  if (izin.mode !== "tek-cagri") {
    if (!metinMi(izin.expires_at)) throw new Error(`grant.mode '${izin.mode}' icin 'expires_at' zorunlu (ADR-007/3)`);
    if (!Number.isInteger(izin.max_calls) || izin.max_calls < 1) {
      throw new Error(`grant.mode '${izin.mode}' icin 'max_calls' zorunlu (ADR-007/3)`);
    }
  }
  return izin;
}

function grantAnahtari(istek) {
  return [
    istek.run_id,
    istek.action.tool,
    istek.action.operation,
    istek.action.arguments_digest || "-",
    istek.binding?.digest || "-",
  ].join("|");
}

/**
 * @param {{
 *   kapi: (karar: object) => Promise<{ recorded_in: string, gate_ref: string }>,
 *   saat?: () => string,
 * }} bagimliliklar
 */
export function izinYoneticisi({ kapi, saat = simdi }) {
  if (typeof kapi !== "function") {
    // Kapisiz bir izin yoneticisi HUMAN_REQUIRED yazamaz; sessiz varsayilan
    // vermek AP1'in ta kendisi olurdu (kapi bir yapilandirma degeri degildir).
    throw new Error("izinYoneticisi: insan kapisini yazan `kapi` fonksiyonu zorunlu");
  }

  let sayac = 0;
  /** @type {Map<string, { karar: object, istek: object, sonuclandi: boolean }>} */
  const kararlar = new Map();
  /** @type {Map<string, { decision_id: string, expires_at?: string, kalan: number }>} */
  const izinler = new Map();

  const yeniKimlik = () => `izin-${String(++sayac).padStart(4, "0")}`;

  function gecerliIzin(istek, at) {
    const kayit = izinler.get(grantAnahtari(istek));
    if (!kayit) return null;
    if (kayit.kalan <= 0) return null;
    if (kayit.expires_at && Date.parse(kayit.expires_at) <= Date.parse(at)) return null;
    return kayit;
  }

  /** Karar belgesini kurar; `decision`/`reason` disindaki her alan burada. */
  function taslak(istek, at, denetler) {
    const kayit = {
      contract_version: "1.0",
      decision_id: yeniKimlik(),
      run_id: istek.run_id,
      at,
      requester: { kind: istek.requester.kind, id: istek.requester.id },
      action: {
        tool: istek.action.tool,
        operation: istek.action.operation,
        summary: istek.action.summary,
      },
      scope: [...istek.scope],
      irreversible: istek.irreversible,
      severity: siddet(istek),
      reliability: guvenilirlik(denetler),
      checks: denetler,
      hard_limit: sabitSinir(istek),
      decision: "HUMAN_REQUIRED",
      reason: "",
    };
    if (istek.step_id) kayit.step_id = istek.step_id;
    if (istek.action.arguments_digest) kayit.action.arguments_digest = istek.action.arguments_digest;
    if (istek.binding) kayit.binding = structuredClone(istek.binding);
    return kayit;
  }

  /** HUMAN_REQUIRED kaydini insan kapisina baglar (sema: recorded_in + gate_ref). */
  async function kapiyaBagla(kayit) {
    const cevap = await kapi(structuredClone(kayit));
    if (!cevap || !metinMi(cevap.recorded_in) || !metinMi(cevap.gate_ref)) {
      throw new Error("kapi: 'recorded_in' ve 'gate_ref' donmeli; kaydi olmayan onay yoktur (ADR-005/2)");
    }
    kayit.recorded_in = cevap.recorded_in;
    kayit.gate_ref = cevap.gate_ref;
    return kayit;
  }

  async function sonuclandir(kayit, istek) {
    if (kayit.decision === "HUMAN_REQUIRED") await kapiyaBagla(kayit);
    kararlar.set(kayit.decision_id, { karar: kayit, istek: structuredClone(istek), sonuclandi: false });
    return structuredClone(kayit);
  }

  return {
    async karar(istek) {
      istegiDogrula(istek);
      const at = saat();
      const sinir = sabitSinir(istek);
      const onay = sinir.hit || istek.irreversible ? null : gecerliIzin(istek, at);

      const denetler = [
        sinir.hit
          ? { id: "sabit-sinir-taramasi", result: "kaldi", detail: `${sinir.rule} sinirina giriyor.` }
          : { id: "sabit-sinir-taramasi", result: "gecti" },
      ];
      if (onay) {
        // Insanin verdigi onay, kapsam ve surum denetiminin yerine gecer:
        // izin zaten bu araca, bu argumanlara ve bu bilesen ozetine baglandi.
        denetler.push(
          { id: "insan-onayi", result: "gecti", detail: `Onay kaydi: ${onay.decision_id}` },
          { id: "surum-bagi", result: "gecti", detail: "Bilesen ozeti izin verildigi andakiyle ayni." },
        );
      } else {
        denetler.push(kapsamDenetle(istek), surumDenetle(istek));
      }
      for (const c of istek.checks || []) denetler.push(structuredClone(c));

      const kayit = taslak(istek, at, denetler);
      const gercek = denetler.filter((c) => c.shadow !== true);

      if (sinir.hit) {
        kayit.decision = "HUMAN_REQUIRED";
        kayit.reason = `Sabit sinir: ${sinir.rule}. Hicbir yapilandirma bu kapiyi kapatamaz (ADR-005/1).`;
      } else if (istek.irreversible) {
        kayit.decision = "HUMAN_REQUIRED";
        kayit.reason = "Telafisi olmayan eylem insan kapisindan gecer (K6).";
      } else if (gercek.some((c) => c.result === "kaldi")) {
        const dusen = gercek.filter((c) => c.result === "kaldi").map((c) => c.id).join(", ");
        kayit.decision = "BLOCK";
        kayit.reason = `Denetleyici dustu: ${dusen}. Genisleme ucuzdur, yetki genislemesi ucuz degildir (ADR-005/4).`;
      } else if (kayit.reliability !== "guclu") {
        const eksik = gercek.filter((c) => c.result !== "gecti").map((c) => c.id).join(", ");
        kayit.decision = "HUMAN_REQUIRED";
        kayit.reason = `Denetlenmemis temiz sayilmaz: ${eksik} (D11). Hata yolu guvenli tarafa duser.`;
      } else {
        kayit.decision = "ALLOW";
        kayit.reason = onay
          ? `Insan onayina bagli izin (${onay.decision_id}); kapsam ve bilesen ozeti degismedi (ADR-007/3).`
          : "Kapsam ici, telafisi olan islem; bilesen ozeti bagli (ADR-007/1).";
      }

      if (kayit.decision === "ALLOW") {
        if (onay) {
          onay.kalan -= 1;
          kayit.supersedes = onay.decision_id;
          if (onay.kalan <= 0) izinler.delete(grantAnahtari(istek));
        } else {
          kayit.grant = { mode: "tek-cagri" };
        }
      }
      return sonuclandir(kayit, istek);
    },

    async insan_kapisina_yaz(karar) {
      const kayitli = kararlar.get(karar?.decision_id);
      // `karar()` HUMAN_REQUIRED uretirken kapiya kendisi yazar (sema
      // recorded_in'i zorunlu kilar). Bu yuzden burasi tekrar yazmaz.
      if (kayitli && metinMi(kayitli.karar.recorded_in)) return kayitli.karar.recorded_in;
      const kopya = structuredClone(karar);
      await kapiyaBagla(kopya);
      if (kayitli) {
        kayitli.karar.recorded_in = kopya.recorded_in;
        kayitli.karar.gate_ref = kopya.gate_ref;
      }
      return kopya.recorded_in;
    },

    async onayi_isle(decision_id, karar_degeri, grant) {
      const kayitli = kararlar.get(decision_id);
      if (!kayitli) throw new Error(`bilinmeyen karar: ${decision_id}`);
      if (kayitli.karar.decision !== "HUMAN_REQUIRED") {
        throw new Error(`${decision_id}: yalnizca HUMAN_REQUIRED kararlari onaya gider`);
      }
      if (kayitli.sonuclandi) throw new Error(`${decision_id}: bu karar zaten sonuclandirildi`);
      if (!["ALLOW", "BLOCK"].includes(karar_degeri)) {
        // Insanin verebilecegi karar iki degerlidir; HUMAN_REQUIRED bir
        // Permission Manager ciktisidir, insan cevabi degil.
        throw new Error(`gecersiz insan karari: ${karar_degeri}`);
      }
      kayitli.sonuclandi = true;

      const eski = kayitli.karar;
      const istek = kayitli.istek;
      const at = saat();
      const denetler = [
        ...structuredClone(eski.checks),
        { id: "insan-onayi", result: karar_degeri === "ALLOW" ? "gecti" : "kaldi", detail: `Insan karari: ${karar_degeri}` },
      ];
      const yeni = taslak(istek, at, denetler);
      yeni.supersedes = eski.decision_id;

      if (karar_degeri === "BLOCK") {
        yeni.decision = "BLOCK";
        yeni.reason = "Insan reddetti.";
        kararlar.set(yeni.decision_id, { karar: yeni, istek, sonuclandi: true });
        return structuredClone(yeni);
      }

      const izin = grantDogrula(grant);
      if (!allowYazilabilir(yeni)) {
        // Sabit sinir / geri alinamazlik onayla asilmaz: kayit HUMAN_REQUIRED
        // kalir ve yeniden kullanilabilir izin **kaydedilmez** — sonraki cagri
        // yine kapiya duser (ADR-005/1).
        yeni.decision = "HUMAN_REQUIRED";
        yeni.reason = yeni.hard_limit.hit
          ? `Insan onayladi ama sabit sinir kaydi ALLOW olamaz (${yeni.hard_limit.rule}, ADR-005/1).`
          : "Insan onayladi ama telafisi olmayan eylem ALLOW kaydi uretmez (K6).";
        yeni.recorded_in = eski.recorded_in;
        yeni.gate_ref = eski.gate_ref;
        kararlar.set(yeni.decision_id, { karar: yeni, istek, sonuclandi: true });
        return structuredClone(yeni);
      }

      yeni.decision = "ALLOW";
      yeni.reason = `Insan onayi (${eski.decision_id}); izin bilesenin bu haline baglandi (ADR-007/1).`;
      yeni.grant = izin;
      if (izin.mode !== "tek-cagri") {
        izinler.set(grantAnahtari(istek), {
          decision_id: yeni.decision_id,
          expires_at: izin.expires_at,
          kalan: izin.max_calls,
        });
      }
      kararlar.set(yeni.decision_id, { karar: yeni, istek, sonuclandi: true });
      return structuredClone(yeni);
    },
  };
}
