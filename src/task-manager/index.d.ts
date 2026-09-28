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
  /**
   * Kaydin disk yolu. Kaydi `arac/sema-dogrula.js --dosya` ile denetlemek icin.
   * Gorev kimligi dosya adidir: kebab_id olmayan kimlik (`../x`, `a/b`)
   * `kayit_yolu`, `yukle` ve `olustur`da istisna atar.
   */
  kayit_yolu(task_id: KebabId): string;

  /** Gorev kaydini diskten okur. Yoksa null — "yeni gorev" karari cagirandadir. */
  yukle(task_id: KebabId): Promise<GorevSozlesmesi | null>;

  /** Yeni gorev kaydini ilk kez diske indirir. Var olan kaydin uzerine yazmaz. */
  olustur(gorev: GorevSozlesmesi): Promise<GorevSozlesmesi>;

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
    sonuc: {
      result_summary: string;
      artifacts?: string[];
      cost_usd?: number | null;
      side_effects_done?: string[];
      /**
       * Sema BITTI kaydinda zorunlu tutar. Verilmezse DEGERLENDIRILMEDI olur ve
       * o zaman `approval_ref` sarttir — "kontrol edilmedi" temiz sayilmaz (D11).
       */
      evaluation_result?: "GECTI" | "KALDI" | "DEGERLENDIRILMEDI";
      approval_ref?: string;
    },
  ): Promise<AdimKaydi>;

  basarisiz_yaz(
    gorev: GorevSozlesmesi,
    adim_id: KebabId,
    hata: { error_type: HataTuru; error_message: string },
  ): Promise<AdimKaydi>;

  /**
   * Bekleme durumlarina gecis; baska durum kabul edilmez. ONAY_BEKLIYOR icin
   * `not` bir `approval_ref`tir ve zorunludur — onay bir durumdur, izi vardir.
   */
  durum_degistir(
    gorev: GorevSozlesmesi,
    adim_id: KebabId,
    durum: Extract<AdimDurumu, "GIRDI_BEKLIYOR" | "ONAY_BEKLIYOR">,
    not?: string,
  ): Promise<AdimKaydi>;

  /**
   * Adim daha once BITTI olarak kapandi mi? Yan etkinin sessiz tekrarini
   * (02 §5/K1) onleyen tek kontrol budur.
   */
  tamamlandi_mi(gorev: GorevSozlesmesi, adim_id: KebabId): boolean;
}

/**
 * Uygulama (`index.js`). Kayitlar `dizin` altinda `<task_id>.json` olarak
 * tutulur; her yazma gecici dosya + rename ile atomiktir (yarim JSON diske
 * dusmez), cunku ADR-003'un iki yazmasi ancak diskteki kayit butunse anlamlidir.
 */
export function gorevYoneticisi(secenekler: { dizin: string }): TaskManager;
