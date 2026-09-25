/**
 * Observability — tek yonlu span yazimi (U12).
 *
 * Blueprint §2.13 / docs/mimari/06-GOZLEM.md. Iki kisit bu dosyada kod olarak
 * durur, yorumda degil:
 *
 *   1. **Yazma hicbir zaman istisna atmaz** (06-GOZLEM D1: "span yazimi
 *      basarisiz olursa adim basarisiz sayilmaz"). Disk dolu, klasor salt
 *      okunur, span bozuk — hepsinde `span_yaz` sessizce vazgecer ve `void`
 *      doner. Tersi olsaydi gozlem katmani, izledigi sistemin ariza kaynagi
 *      olurdu.
 *   2. **Sinir acilirken de yazilir** (06-GOZLEM §2 tablosu + ADR-003'un iki
 *      yazma disiplini). `span_ac` spani hemen `outcome.status = "kesildi"`
 *      olarak diske indirir; kapatan fonksiyon ayni `span_id` ile ikinci kaydi
 *      yazar. Surec ortada olurse iz "kesildi" olarak kalir — kayip span
 *      yerine gorunur bir yarim kayit.
 *
 * Iz bir dosya kaydidir, canli toplayici boru hatti degil (06-GOZLEM D1):
 * kosu basina bir JSONL dosyasi, satir basina bir span. `kosu_izleri` ayni
 * `span_id`'nin son kaydini alir, yani kapanmis span acilis kaydini bastirir.
 *
 * Kapsam disi (yol haritasi U12): OTLP disa aktarimi, gosterge paneli.
 *
 * ADR-002: kardes modul import edilmez, hicbir bilesen cagrilmaz (D2).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** contracts/*.json $defs.zaman — milisaniye yok. */
function simdi() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** contracts/span.schema.json $defs.kebab_id. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Gecikme. Olculemeyen sure `null` doner, sifir DEGIL (kural 11 / AP10):
 * sifir yazmak olculmemis sureyi "aninda" gibi gosterir.
 */
function sure(basladi, bitti) {
  const a = Date.parse(basladi);
  const b = Date.parse(bitti);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return b - a;
}

export function gozlemci({ dizin }) {
  if (!dizin) throw new Error("gozlemci: `dizin` zorunlu");

  // run_id diskte dosya adidir: kebab olmayan kimlik yol yapilmaz (`../x`
  // iz klasorunun disini okurdu). Yazma ucu bunu zaten sessizce dusuruyor (D1);
  // okuma ucu ve iz_yolu istisna atar.
  const yol = (run_id) => {
    if (typeof run_id !== "string" || !KEBAB.test(run_id)) {
      throw new Error(`run_id kebab_id degil, dosya yolu yapilmaz: ${JSON.stringify(run_id)}`);
    }
    return join(dizin, `${run_id}.jsonl`);
  };

  return {
    /** Izin disk yolu — kaydi disaridan denetlemek icin. */
    iz_yolu: yol,

    /**
     * Span yazar. Tek yonlu: donus yok, **istisna yok**. Basarisizligin tek
     * gorunur izi cagiranin hic haberdar olmamasidir; bu bilincli (D1).
     */
    span_yaz(span) {
      try {
        if (!span || typeof span !== "object") return;
        if (typeof span.run_id !== "string" || !KEBAB.test(span.run_id)) return;
        const hedef = yol(span.run_id);
        mkdirSync(dizin, { recursive: true });
        appendFileSync(hedef, `${JSON.stringify(span)}\n`, "utf8");
      } catch {
        // Yutulur. 06-GOZLEM D1: span kaybi yalnizca gorunurluk kaybidir.
      }
    },

    /**
     * Span baslatir. Acilis kaydi hemen diske iner (`kesildi`); donen
     * fonksiyon ayni `span_id` ile kapanis kaydini yazar. Kapatan fonksiyon
     * da hicbir sey firlatmaz.
     */
    span_ac(taslak) {
      const acik = { ...taslak, outcome: { status: "kesildi" } };
      this.span_yaz(acik);
      return (sonuc) => {
        const bitti = simdi();
        this.span_yaz({
          ...taslak,
          ended_at: bitti,
          duration_ms: sure(taslak.started_at, bitti),
          outcome: sonuc,
        });
      };
    },

    /**
     * Bir kosunun spanlarini okur; K7'nin (izler → degerlendirme) girdi ucu.
     * Bozuk satir atlanir: yarim yazilmis tek satir butun izi okunamaz
     * yapmamali. Iz yoksa bos dizi doner — "kosu yok" karari cagiranindir.
     */
    async kosu_izleri(run_id) {
      const hedef = yol(run_id);
      if (!existsSync(hedef)) return [];
      const sonKayit = new Map();
      for (const satir of readFileSync(hedef, "utf8").split("\n")) {
        if (!satir.trim()) continue;
        let span;
        try {
          span = JSON.parse(satir);
        } catch {
          continue;
        }
        // Gecerli JSON ama span degil ("null", "7", "[]"): o da bozuk satirdir.
        if (!span || typeof span !== "object" || Array.isArray(span) || typeof span.span_id !== "string") continue;
        sonKayit.set(span.span_id, span);
      }
      return [...sonKayit.values()];
    },
  };
}
