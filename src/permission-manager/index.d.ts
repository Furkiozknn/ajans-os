/**
 * Permission Manager — tek gecit (K6).
 *
 * Blueprint §2.5, ADR-005/ADR-007: ajan araci dogrudan cagiramaz; karar uc
 * degerlidir ve `HUMAN_REQUIRED` bir hata degil, normal bir sonuctur. Sabit
 * sinirlar (silme, yayinlama, kimlik bilgisi) hicbir ayarla acilmaz.
 */

import type { IzinKarari, IzinSinifi, KebabId, Ozet, Zaman } from "../tipler";

/** permission.schema.json checks[] — bir denetleyicinin tek sonucu. */
export interface Denetleyici {
  id: KebabId;
  /** 'calistirilmadi' ve 'hata' ayri degerlerdir; ikisi de 'gecti' sayilmaz (D5). */
  result: "gecti" | "kaldi" | "calistirilmadi" | "hata";
  detail?: string;
  /** Olculmemis detektor sinyal uretir, yetki almaz (kural 6). */
  shadow?: boolean;
}

/** permission.schema.json binding — izin bilesenin BU haline verilir (ADR-007). */
export interface SurumBagi {
  component: string;
  version?: string;
  digest: Ozet;
}

/** permission.schema.json grant — "suresiz" diye bir mod yoktur. */
export interface IzinKapsami {
  mode: "tek-cagri" | "oturum" | "sureli";
  expires_at?: Zaman;
  max_calls?: number;
}

export interface IzinIstegi {
  run_id: KebabId;
  step_id?: KebabId;
  requester: { kind: "agent" | "orchestrator" | "component"; id: KebabId; [alan: string]: unknown };
  action: { tool: string; operation: IzinSinifi; summary: string; arguments_digest?: Ozet };
  /** En az bir somut hedef. Kapsamsizlik "hepsi" degil, hatadir (ADR-005/3). */
  scope: string[];
  irreversible: boolean;
  /** Ajan sozlesmesinden gelen izinli kapsam onekleri. Verilmezse kapsam
   *  denetimi `calistirilmadi` doner ve karar `ALLOW` olamaz (D11). */
  izinli_kapsam?: string[];
  binding?: SurumBagi;
  /** Disaridan calisan ek denetleyicilerin sonuclari (golge dahil). */
  checks?: Denetleyici[];
  /** Siddeti yalnizca **yukseltir**; islem sinifindan gelen tabanin altina inemez. */
  severity?: "dusuk" | "orta" | "yuksek";
  /** Kod tarafli listeye ek bir sabit sinir bildirir. Liste uzatilabilir,
   *  daraltilamaz; buradan bir kural kaldirilamaz (ADR-005/1). */
  sabit_sinir?: "kimlik-bilgisi-girme" | "kalici-silme" | "para-transferi"
    | "hesap-acma" | "sistem-guvenlik-ayari" | "disari-yayin-gonderim";
}

export interface PermissionManagerBagimliliklari {
  /**
   * `HUMAN_REQUIRED` kaydini insan kapisina (`raporlar/ONAY-BEKLEYENLER.md`)
   * yazar. Bu modul dosya sistemine dokunmaz (ADR-002). Kapisiz bir yonetici
   * kurulamaz: sessiz varsayilan, AP1'in ta kendisi olurdu.
   */
  kapi(karar: IzinKarari): Promise<{ recorded_in: string; gate_ref: string }>;
  /** ISO 8601, milisaniyesiz. Varsayilan: sistem saati. */
  saat?(): Zaman;
}

export interface PermissionManager {
  /**
   * Tek karar noktasi. Sonuc her zaman bir `IzinKarari` belgesidir —
   * `BLOCK` ve `HUMAN_REQUIRED` de dahil, hicbiri istisna firlatmaz;
   * karar veri olarak kaydedilebilsin diye. Istisna yalnizca bozuk **istek**
   * ve bozuk **bagimlilik** icin atilir.
   */
  karar(istek: IzinIstegi): Promise<IzinKarari>;

  /**
   * HUMAN_REQUIRED kararini `raporlar/ONAY-BEKLEYENLER.md` benzeri insan
   * kapisina yazar. Donus, kararin `recorded_in` alanina konacak referans.
   * `karar()` bunu zaten yaptigi icin ayni kayit ikinci kez yazilmaz.
   */
  insan_kapisina_yaz(karar: IzinKarari): Promise<string>;

  /**
   * Insanin verdigi cevabi karara baglar; eski kayit silinmez, yenisi
   * `supersedes` ile eskisini gosterir. Yeniden kullanilabilir izin
   * (`grant.mode` ≠ `tek-cagri`) verildiyse sonraki cagrinin ayni
   * argumanlarla ve ayni bilesen ozetiyle geldigi `arguments_digest` +
   * `binding.digest` ile kanitlanir.
   *
   * Sabit sinira dokunan ya da geri alinamaz bir istekte insan `ALLOW` dese
   * bile kayit `HUMAN_REQUIRED` kalir (sema boyle bir `ALLOW` kaydini
   * reddeder) ve yeniden kullanilabilir izin **kaydedilmez**.
   */
  onayi_isle(
    decision_id: KebabId,
    karar_degeri: "ALLOW" | "BLOCK",
    grant?: IzinKapsami,
  ): Promise<IzinKarari>;
}

export declare function izinYoneticisi(
  bagimliliklar: PermissionManagerBagimliliklari,
): PermissionManager;
