/**
 * Observability — tek yonlu dinleyici.
 *
 * Blueprint §2.13 / §3.1: hicbir bilesen gozlemden **cevap beklemez**;
 * `span_yaz` void doner ve hata firlatmaz — iz kaydinin basarisizligi kosuyu
 * dusuremez. Iz modeli OTel GenAI semantic conventions uyumludur; olculmemis
 * detektor `shadow: true` ile baslar (AP5 → kural 6).
 */

import type { KebabId, Span } from "../tipler";

export interface Observability {
  /** Span yazar. Tek yonlu: donus yok, istisna yok. */
  span_yaz(span: Span): void;

  /**
   * Span baslatir; donen fonksiyon spani kapatir. Kapatilmayan span
   * `outcome.status = "kesildi"` olarak kalir — surec olduyse gorunur olsun.
   */
  span_ac(span: Omit<Span, "ended_at" | "outcome">): (sonuc: Span["outcome"]) => void;

  /**
   * Bir kosunun spanlarini okur; K7'nin (izler → degerlendirme) girdi ucu.
   * `run_id` kebab_id degilse istisna atar: kimlik dosya adidir, `../` yol olmaz.
   */
  kosu_izleri(run_id: KebabId): Promise<Span[]>;
}

/**
 * Uygulama (`index.js`). Izler `dizin` altinda `<run_id>.jsonl` olarak
 * tutulur, satir basina bir span. `span_ac` acilis kaydini da yazar
 * (`outcome.status = "kesildi"`); `kosu_izleri` ayni `span_id`'nin son
 * kaydini dondurur.
 */
export function gozlemci(secenekler: { dizin: string }): Observability & {
  /** Izin disk yolu — kaydi disaridan denetlemek icin. Kebab olmayan kimlikte istisna. */
  iz_yolu(run_id: KebabId): string;
};
