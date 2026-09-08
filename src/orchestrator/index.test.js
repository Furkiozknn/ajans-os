/**
 * Orchestrator testleri (U13).
 *
 * Yol haritasindaki bitti olcutu uc cumle, ucu de burada olculuyor:
 *   (a) 12 sahte bagimlilikla `adimi_yurut` cagrilir ve **cagri sirasi**
 *       blueprint §3.2'nin 1–10'uyla birebir kaydedilir;
 *   (b) `HUMAN_REQUIRED` senaryosunda kosu `ONAY_BEKLIYOR`da durur, ikinci
 *       adima gecmez;
 *   (c) `kosuyu_surdur` tamamlanmis adimi tekrar baslatmaz.
 *
 * Sira testi mutlu yolu degil, mimariden gelen kisiti sinar: sira bir uygulama
 * ayrintisi olsaydi test yazilamazdi. Cagrilar bir diziye adiyla dusuyor ve
 * dizi beklenen listeyle **tamamen** karsilastiriliyor — fazladan bir cagri da
 * eksik bir cagri kadar hatadir.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { orkestrator } from "./index.js";

const AJAN = {
  contract_version: "2.0",
  identity: { id: "kod-yazan", name: "Kod Yazan", version: "1.0.0", status: "active" },
  role: "specialist",
  capabilities: ["kod"],
  tools: [],
  permissions: {},
  memory_scope: { read: ["task", "project"] },
};

function gorevUret(kayitlar = []) {
  return {
    contract_version: "1.0",
    task: { id: "ornek-gorev", title: "Ornek", goal: "Ornek gorev" },
    graph: {
      steps: [
        {
          id: "birinci-adim",
          title: "Birinci adim",
          assign: { mode: "agent", agent_id: "kod-yazan" },
          depends_on: [],
          writes: ["docs/bir.md"],
          evaluation: { method: "deterministic" },
          retry: { max_attempts: 2 },
          side_effects: false,
          on_failure: "dur",
        },
        {
          id: "ikinci-adim",
          title: "Ikinci adim",
          assign: { mode: "role", role: "specialist" },
          depends_on: ["birinci-adim"],
          evaluation: { method: "deterministic" },
          retry: { max_attempts: 2 },
          side_effects: false,
          on_failure: "dur",
        },
      ],
    },
    run: { run_id: "kosu-bir", started_at: "2026-09-08T18:00:00Z", step_records: kayitlar },
  };
}

/** Gercek task-manager'in durum kurallarini taklit eden bellek ici sahte. */
function gorevYoneticisiSahte(cagrilar, baslatilanlar) {
  const son = (gorev, id) =>
    [...gorev.run.step_records].reverse().find((k) => k.step_id === id) || null;
  const acik = (gorev, id) => {
    const k = son(gorev, id);
    return k && k.status !== "BITTI" && k.status !== "BASARISIZ" ? k : null;
  };
  return {
    kayit_yolu: (id) => `bellek://${id}`,
    async yukle() {
      return null;
    },
    async olustur(gorev) {
      return gorev;
    },
    sonraki_adim(gorev) {
      cagrilar.push("gorev_yoneticisi.sonraki_adim");
      for (const adim of gorev.graph.steps) {
        const k = son(gorev, adim.id);
        if (k && (k.status === "BITTI" || k.status === "ONAY_BEKLIYOR")) continue;
        if (k && k.status === "BASARISIZ" && k.attempt >= adim.retry.max_attempts) continue;
        const hazir = adim.depends_on.every((b) => {
          const bk = son(gorev, b);
          return bk && bk.status === "BITTI";
        });
        if (hazir) return adim;
      }
      return null;
    },
    async basladi_yaz(gorev, id) {
      cagrilar.push("gorev_yoneticisi.basladi_yaz");
      baslatilanlar.push(id);
      const onceki = son(gorev, id);
      if (onceki && onceki.status === "BITTI") throw new Error(`adim zaten BITTI: ${id}`);
      const a = acik(gorev, id);
      if (a) {
        a.status = "BASLADI";
        return a;
      }
      const kayit = {
        step_id: id,
        attempt: onceki ? onceki.attempt + 1 : 1,
        status: "BASLADI",
        started_at: "2026-09-08T18:00:01Z",
      };
      gorev.run.step_records.push(kayit);
      return kayit;
    },
    async bitti_yaz(gorev, id, sonuc) {
      cagrilar.push("gorev_yoneticisi.bitti_yaz");
      const kayit = acik(gorev, id);
      assert.ok(kayit, `bitti_yaz oncesi basladi_yaz cagrilmali: ${id}`);
      // D11: gercek modulun kurali burada da gecerli olmali.
      assert.ok(
        sonuc.evaluation_result !== "DEGERLENDIRILMEDI" || sonuc.approval_ref,
        "DEGERLENDIRILMEDI approval_ref olmadan kapatilamaz",
      );
      Object.assign(kayit, { status: "BITTI", ended_at: "2026-09-08T18:00:02Z", ...sonuc });
      return kayit;
    },
    async basarisiz_yaz(gorev, id, hata) {
      cagrilar.push("gorev_yoneticisi.basarisiz_yaz");
      const kayit = acik(gorev, id);
      Object.assign(kayit, { status: "BASARISIZ", ended_at: "2026-09-08T18:00:02Z", ...hata });
      return kayit;
    },
    async durum_degistir(gorev, id, durum, not) {
      cagrilar.push("gorev_yoneticisi.durum_degistir");
      const kayit = acik(gorev, id);
      assert.ok(not, "ONAY_BEKLIYOR approval_ref olmadan yazilamaz");
      Object.assign(kayit, { status: durum, approval_ref: not });
      return kayit;
    },
    tamamlandi_mi(gorev, id) {
      const k = son(gorev, id);
      return Boolean(k && k.status === "BITTI");
    },
  };
}

/**
 * 12 sahte bagimlilik. `ozel` ile tek tek davranis degistirilir; her cagri
 * `cagrilar` dizisine adiyla duser.
 */
function kur(ozel = {}) {
  const cagrilar = [];
  const baslatilanlar = [];
  const spanlar = [];
  const {
    izin_karari = "ALLOW",
    degerlendirme = { sonuc: "GECTI", gecti: true, kanitlar: [], aciklama: "kanit temiz" },
    arac_cagrisi = { ad: "dosya-yaz", argumanlar: { yol: "docs/bir.md" } },
    gecis_gerekli = false,
    kurtarma_modu = "durdur",
  } = ozel;

  const bagimliliklar = {
    gorev_yoneticisi: gorevYoneticisiSahte(cagrilar, baslatilanlar),

    ajan_defteri: {
      async getir(id) {
        cagrilar.push("ajan_defteri.getir");
        return id === AJAN.identity.id ? AJAN : null;
      },
      async listele() {
        cagrilar.push("ajan_defteri.listele");
        return [AJAN];
      },
      dogrula: () => ({ gecerli: true, hatalar: [] }),
      async turet() {
        return {};
      },
    },

    bellek_yoneticisi: {
      async oku(sorgu) {
        cagrilar.push("bellek_yoneticisi.oku");
        assert.deepEqual(sorgu.katmanlar, ["task", "project"], "katmanlar ajan sozlesmesinden");
        return [];
      },
      async yaz() {
        throw new Error("testte bellek yazilmaz");
      },
      async gecersiz_kil() {
        throw new Error("testte bellek yazilmaz");
      },
    },

    baglam_yoneticisi: {
      esik: 0.9,
      kisilma_sirasi: ["bilgi", "gorev_durumu", "sorgu"],
      butcele(bilesenler) {
        cagrilar.push("baglam_yoneticisi.butcele");
        return { bilesenler, kalan: 1000, kisilanlar: [], asildi_mi: false };
      },
    },

    model_yonlendirici: {
      katalog: [],
      sec() {
        cagrilar.push("model_yonlendirici.sec");
        return { model_id: "sahte-model", saglayici: "sahte", tasima: {} };
      },
      async cagir() {
        cagrilar.push("model_yonlendirici.cagir");
        return {
          icerik: {
            ...(arac_cagrisi ? { arac_cagrisi } : {}),
            kanitlar: [{ tur: "cikis_kodu", kod: 0 }],
          },
          usage: { input_tokens: 10, output_tokens: 5 },
          cost: {},
          model_id: "sahte-model",
        };
      },
    },

    maliyet_yoneticisi: {
      async tablo_yukle() {
        return [];
      },
      usage_isle() {
        cagrilar.push("maliyet_yoneticisi.usage_isle");
        return { maliyet_usd: 0.01, durum: this.durum() };
      },
      gecis_gerekli_mi() {
        cagrilar.push("maliyet_yoneticisi.gecis_gerekli_mi");
        return gecis_gerekli;
      },
      adim_tavani: () => 1,
      durum: () => ({
        harcanan_usd: 0.01,
        bilinmeyen_cagri: 0,
        tavan_usd: 6,
        doluluk: 0.01,
        gecis_gerekli,
      }),
    },

    arac_defteri: {
      async getir(ad) {
        cagrilar.push("arac_defteri.getir");
        return { tanim: { name: ad, inputSchema: {} }, operation: "write", irreversible: false, kaynak: "test" };
      },
      async listele() {
        return [];
      },
      argumanlari_dogrula() {
        cagrilar.push("arac_defteri.argumanlari_dogrula");
        return { gecerli: true, hatalar: [] };
      },
    },

    izin_yoneticisi: {
      async karar(istek) {
        cagrilar.push("izin_yoneticisi.karar");
        assert.ok(istek.scope.length > 0, "izin istegi bos kapsamla gitmez");
        return {
          contract_version: "1.0",
          decision_id: "izin-0001",
          run_id: istek.run_id,
          at: "2026-09-08T18:00:01Z",
          requester: istek.requester,
          action: istek.action,
          scope: istek.scope,
          irreversible: istek.irreversible,
          decision: izin_karari,
          reason: "test karari",
          ...(izin_karari === "HUMAN_REQUIRED"
            ? { gate_ref: "onay-bekleyenler-satir-7", recorded_in: "raporlar/ONAY-BEKLEYENLER.md" }
            : {}),
        };
      },
      async insan_kapisina_yaz() {
        cagrilar.push("izin_yoneticisi.insan_kapisina_yaz");
        return "onay-bekleyenler-satir-7";
      },
      async onayi_isle() {
        throw new Error("testte onay islenmez");
      },
    },

    degerlendirici: {
      gecerli_mi() {
        cagrilar.push("degerlendirici.gecerli_mi");
        return degerlendirme;
      },
      esigi_asti_mi() {
        cagrilar.push("degerlendirici.esigi_asti_mi");
        return degerlendirme;
      },
    },

    elestirmen: {
      async elestir() {
        cagrilar.push("elestirmen.elestir");
        return {
          contract_version: "1.0",
          message_id: "elestiri-0001",
          run_id: "kosu-bir",
          at: "2026-09-08T18:00:01Z",
          from: {},
          to: {},
          kind: "critique",
          payload: { items: [] },
        };
      },
    },

    kurtarma_yoneticisi: {
      mod_sec() {
        cagrilar.push("kurtarma_yoneticisi.mod_sec");
        return { mod: kurtarma_modu, bekleme_ms: 0, gerekce: "test" };
      },
      bekleme_ms: () => 0,
    },

    gozlem: {
      span_yaz(span) {
        cagrilar.push("gozlem.span_yaz");
        spanlar.push(span);
      },
      span_ac() {
        return () => {};
      },
      async kosu_izleri() {
        return spanlar;
      },
    },
  };

  return {
    orkestra: orkestrator(bagimliliklar, { saat: () => "2026-09-08T18:00:01Z" }),
    cagrilar,
    baslatilanlar,
    spanlar,
  };
}

/** Span'lar en sonda (10. adim) yazilir; oncesi §3.2'nin 1–9'udur. */
function sirayiAyir(cagrilar) {
  const ilkSpan = cagrilar.indexOf("gozlem.span_yaz");
  return {
    dokuz: ilkSpan === -1 ? cagrilar : cagrilar.slice(0, ilkSpan),
    kuyruk: ilkSpan === -1 ? [] : cagrilar.slice(ilkSpan),
  };
}

test("adimi_yurut cagri sirasi blueprint §3.2'nin 1-10'uyla birebir", async () => {
  const { orkestra, cagrilar, spanlar } = kur();
  const gorev = gorevUret();

  const kayit = await orkestra.adimi_yurut(gorev, "birinci-adim");

  assert.equal(kayit.status, "BITTI");
  const { dokuz, kuyruk } = sirayiAyir(cagrilar);
  assert.deepEqual(dokuz, [
    "gorev_yoneticisi.basladi_yaz", // 1  Task Manager  → durum=BASLADI
    "ajan_defteri.getir", // 2  Agent Registry → ajan sozlesmesi
    "bellek_yoneticisi.oku", // 3  Memory Manager → ilgili kayitlar
    "baglam_yoneticisi.butcele", // 4  Context Manager→ butce
    "model_yonlendirici.sec", // 5  Model Router  → secim
    "model_yonlendirici.cagir", // 5  Model Router  → cagri
    "maliyet_yoneticisi.usage_isle", // 6  Cost Manager  ← usage
    "arac_defteri.getir", // 7  Tool Registry → arac semasi
    "arac_defteri.argumanlari_dogrula", // 7  Tool Registry → arguman semasi
    "izin_yoneticisi.karar", // 7  Permission Mgr→ ALLOW|BLOCK|HUMAN_REQUIRED
    "degerlendirici.gecerli_mi", // 8  Evaluator     → deterministik kapi
    "gorev_yoneticisi.bitti_yaz", // 9  Task Manager  → durum=BITTI
  ]);
  // 10 — 1–9 arasindaki her olay icin span, hepsi en sonda ve tek yonlu.
  // U14: span sinifi listesi kapali (span.schema.json). Karsiligi olmayan ara
  // olaylar (bellek okuma, baglam butcesi, maliyet) artik span uretmiyor; alti
  // span kaliyor: run, invoke_agent, inference, execute_tool, permission_check,
  // evaluate.
  assert.ok(kuyruk.length >= 6, "her olay icin span yazilmali");
  assert.ok(
    kuyruk.every((ad) => ad === "gozlem.span_yaz"),
    "span yazimi 1–9'un arasina girmez",
  );
  assert.equal(spanlar.length, kuyruk.length);
  assert.equal(spanlar[0].parent_span_id, null, "adimin kok span'i ustsuz");
  assert.ok(
    spanlar.slice(1).every((s) => s.parent_span_id === spanlar[0].span_id),
    "kalan span'lar kok span'in altinda",
  );
});

test("degerlendirme KALDI: once elestirmen, sonra kurtarma yoneticisi (§3.2/8)", async () => {
  const { orkestra, cagrilar } = kur({
    degerlendirme: { sonuc: "KALDI", gecti: false, kanitlar: [], aciklama: "cikis kodu 1" },
    kurtarma_modu: "duzelt",
  });
  const gorev = gorevUret();

  const kayit = await orkestra.adimi_yurut(gorev, "birinci-adim");

  assert.equal(kayit.status, "BASARISIZ");
  assert.equal(kayit.error_type, "DOGRULAMA_KALDI");
  assert.equal(kayit.kurtarma_modu, "duzelt");
  const { dokuz } = sirayiAyir(cagrilar);
  assert.deepEqual(dokuz.slice(-4), [
    "degerlendirici.gecerli_mi",
    "elestirmen.elestir",
    "kurtarma_yoneticisi.mod_sec",
    "gorev_yoneticisi.basarisiz_yaz",
  ]);
});

test("HUMAN_REQUIRED: adim ONAY_BEKLIYOR'da kalir ve kosu ikinci adima gecmez", async () => {
  const { orkestra, cagrilar, baslatilanlar } = kur({ izin_karari: "HUMAN_REQUIRED" });
  const gorev = gorevUret();

  const sonuc = await orkestra.kosuyu_yurut(gorev);

  assert.equal(sonuc.son, "onay-bekliyor");
  assert.deepEqual(baslatilanlar, ["birinci-adim"], "ikinci adim hic baslatilmadi");
  const kayit = gorev.run.step_records.at(-1);
  assert.equal(kayit.status, "ONAY_BEKLIYOR");
  assert.equal(kayit.approval_ref, "onay-bekleyenler-satir-7", "kapi kaydi adimda iz birakir");
  // Onay beklerken adim kapanmaz: BITTI yazilmaz.
  assert.ok(!cagrilar.includes("gorev_yoneticisi.bitti_yaz"));
});

test("DEGERLENDIRILMEDI GECTI sayilmaz: adim kapiya duser (D11)", async () => {
  const { orkestra } = kur({
    degerlendirme: {
      sonuc: "DEGERLENDIRILMEDI",
      gecti: false,
      kanitlar: [],
      aciklama: "dogrulayici yok",
    },
  });
  const gorev = gorevUret();

  const sonuc = await orkestra.kosuyu_yurut(gorev);

  assert.equal(sonuc.son, "onay-bekliyor");
  assert.equal(gorev.run.step_records.at(-1).status, "ONAY_BEKLIYOR");
});

test("kosuyu_surdur tamamlanmis adimi tekrar baslatmaz", async () => {
  const { orkestra, baslatilanlar } = kur();
  const gorev = gorevUret([
    {
      step_id: "birinci-adim",
      attempt: 1,
      status: "BITTI",
      started_at: "2026-09-08T17:00:00Z",
      ended_at: "2026-09-08T17:01:00Z",
      result_summary: "onceki kosuda bitti",
      evaluation_result: "GECTI",
    },
  ]);

  const sonuc = await orkestra.kosuyu_surdur(gorev, "kosu-bir");

  assert.equal(sonuc.son, "bitti");
  assert.deepEqual(baslatilanlar, ["ikinci-adim"], "biten adim ikinci kez baslatilmadi");
  assert.equal(sonuc.adim_kayitlari.length, 1);
});

test("kosuyu_surdur baska bir kosunun kaydiyla calismaz", async () => {
  const { orkestra } = kur();
  await assert.rejects(
    () => orkestra.kosuyu_surdur(gorevUret(), "baska-kosu"),
    /kosuyu_surdur/,
  );
});

test("butce esigi asilinca kosu 'butce' ile durur, cokmeyle degil", async () => {
  const { orkestra } = kur({ gecis_gerekli: true });
  const gorev = gorevUret();

  const sonuc = await orkestra.kosuyu_yurut(gorev);

  assert.equal(sonuc.son, "butce");
  assert.equal(sonuc.adim_kayitlari.length, 1, "esik asildiktan sonra yeni adim alinmaz");
  assert.equal(gorev.run.step_records[0].status, "BITTI");
});

test("arac cagrisi olmayan adimda arac defteri ve izin yoneticisi hic cagrilmaz", async () => {
  const { orkestra, cagrilar } = kur({ arac_cagrisi: null });
  const gorev = gorevUret();

  await orkestra.adimi_yurut(gorev, "birinci-adim");

  assert.ok(!cagrilar.includes("arac_defteri.getir"));
  assert.ok(!cagrilar.includes("izin_yoneticisi.karar"));
});

test("eksik bagimlilikla kurulmaz: hata kosu ortasinda degil kurulusta gelir", () => {
  assert.throws(() => orkestrator({ gorev_yoneticisi: {} }), /eksik bagimlilik/);
});
