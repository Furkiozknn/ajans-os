/**
 * Permission Manager — tek gecit (K6).
 *
 * Blueprint §2.5, ADR-005/ADR-007: ajan araci dogrudan cagiramaz; karar uc
 * degerlidir ve `HUMAN_REQUIRED` bir hata degil, normal bir sonuctur. Sabit
 * sinirlar (silme, yayinlama, kimlik bilgisi) hicbir ayarla acilmaz.
 */

import type { IzinKarari, IzinSinifi, KebabId, Ozet } from "../tipler";

export interface IzinIstegi {
  run_id: KebabId;
  step_id?: KebabId;
  requester: { agent_id: KebabId; [alan: string]: unknown };
  action: { tool: string; operation: IzinSinifi; summary: string; arguments_digest?: Ozet };
  scope: unknown;
  irreversible: boolean;
}

export interface PermissionManager {
  /**
   * Tek karar noktasi. Sonuc her zaman bir `IzinKarari` belgesidir —
   * `BLOCK` ve `HUMAN_REQUIRED` de dahil, hicbiri istisna firlatmaz;
   * karar veri olarak kaydedilebilsin diye.
   */
  karar(istek: IzinIstegi): Promise<IzinKarari>;

  /**
   * HUMAN_REQUIRED kararini `raporlar/ONAY-BEKLEYENLER.md` benzeri insan
   * kapisina yazar. Donus, kararin `recorded_in` alanina konacak referans.
   */
  insan_kapisina_yaz(karar: IzinKarari): Promise<string>;

  /**
   * Insanin verdigi cevabi karara baglar. Yeniden kullanilabilir izin
   * (`grant`) verildiyse sonraki cagrinin ayni argumanlarla geldigi
   * `arguments_digest` ile kanitlanir.
   */
  onayi_isle(decision_id: KebabId, karar_degeri: "ALLOW" | "BLOCK"): Promise<IzinKarari>;
}
