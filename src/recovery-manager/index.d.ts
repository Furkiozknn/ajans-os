/**
 * Recovery Manager — hata turune bakip modu secer.
 *
 * Blueprint §2.10 (AP8 → kural 9): "rollback" kelimesi kullanilmaz; yerine
 * *durumu geri sarma* ve *telafi*. Telafisi olmayan geri alinamaz eylem
 * kurtarmaya degil, insan kapisina duser. Backoff + jitter varsayilan aciktir.
 */

import type { HataTuru, KebabId } from "../tipler";

/**
 * `duzelt`: baglami koru, elestiriyi ekle, tekrar dene.
 * `temiz-sayfa`: baglami at, adimi bastan calistir.
 * `insan-kapisi`: telafisi olmayan yan etki; karar insanindir.
 * `durdur`: deneme hakki bitti veya hata tekrar denenemez turden.
 */
export type KurtarmaModu = "duzelt" | "temiz-sayfa" | "insan-kapisi" | "durdur";

export interface KurtarmaKarari {
  mod: KurtarmaModu;
  /** Beklenecek sure; backoff + jitter uygulanmis hali. 0 = hemen. */
  bekleme_ms: number;
  gerekce: string;
}

export interface RecoveryManager {
  /**
   * Modu secer. `deneme` kacinci denemede oldugumuz (1'den baslar);
   * `telafi_var` adimda tanimli bir telafi eylemi olup olmadigi.
   */
  mod_sec(girdi: {
    hata_turu: HataTuru;
    deneme: number;
    step_id: KebabId;
    telafi_var: boolean;
  }): KurtarmaKarari;

  /** Ustel geri cekilme + jitter. Saf fonksiyon; test edilebilir olmali. */
  bekleme_ms(deneme: number): number;
}
