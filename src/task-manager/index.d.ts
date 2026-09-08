/**
 * Task Manager — gorevin kalici kaydi ve durum makinesi.
 *
 * Blueprint §2.2, ADR-003: adim sinirinda **iki** yazma vardir — yan etkiden
 * once "BASLADI", sonra "BITTI". Tek yazmaya dusurmek yeniden baslatma
 * amnezisini (D1) geri getirir; `BILINEN-TUZAKLAR.md` #7/#13/#20 bunun uc ayri
 * gorunumudur.
 */

import type { Adim, AdimDurumu, AdimKaydi, GorevSozlesmesi, HataTuru, KebabId } from "../tipler";

export interface TaskManager {
  /** Gorev kaydini diskten okur. Yoksa null — "yeni gorev" karari cagirandadir. */
  yukle(task_id: KebabId): Promise<GorevSozlesmesi | null>;

  /**
   * Bagimliliklari karsilanmis, henuz calismamis bir sonraki adim.
   * Yoksa null (kosu bitti). Paralellik icin coklu donus **yok**: paralel
   * adimlarin ayni alana yazmasi blueprint §2.1'de onlenen hatadir.
   */
  sonraki_adim(gorev: GorevSozlesmesi): Adim | null;

  /** Yan etkiden ONCE cagrilir. Donusu bu denemenin kaydidir. */
  basladi_yaz(gorev: GorevSozlesmesi, adim_id: KebabId): Promise<AdimKaydi>;

  /** Yan etkiden SONRA cagrilir; kaydi kapatir. */
  bitti_yaz(
    gorev: GorevSozlesmesi,
    adim_id: KebabId,
    sonuc: { result_summary: string; artifacts?: unknown[]; cost_usd?: number | null },
  ): Promise<AdimKaydi>;

  basarisiz_yaz(
    gorev: GorevSozlesmesi,
    adim_id: KebabId,
    hata: { error_type: HataTuru; error_message: string },
  ): Promise<AdimKaydi>;

  /** Bekleme durumlarina gecis: GIRDI_BEKLIYOR, ONAY_BEKLIYOR. */
  durum_degistir(
    gorev: GorevSozlesmesi,
    adim_id: KebabId,
    durum: AdimDurumu,
    not?: string,
  ): Promise<AdimKaydi>;

  /**
   * Adim daha once BITTI olarak kapandi mi? Yan etkinin sessiz tekrarini
   * (02 §5/K1) onleyen tek kontrol budur.
   */
  tamamlandi_mi(gorev: GorevSozlesmesi, adim_id: KebabId): boolean;
}
