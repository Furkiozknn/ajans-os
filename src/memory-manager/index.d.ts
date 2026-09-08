/**
 * Memory Manager — katmanli bellek.
 *
 * Blueprint §2.6 (D5): kaynak kayit korunur, **uzerine yazilmaz**; guncelleme
 * yeni bir kayit + eskisinin gecersizlestirilmesidir. Bellege yazmak bir
 * **izin islemidir** (AP9 → kural 10): bu yuzden `yaz` bir `IzinKarari`
 * almadan cagrilamaz — kural yorumda degil, imzada.
 */

import type { BellekKatmani, IzinKarari, KebabId, Zaman } from "../tipler";

export interface BellekKaydi {
  id: KebabId;
  katman: BellekKatmani;
  icerik: string;
  yazildi: Zaman;
  /** Gecersizlestirildiyse zamani; kayit silinmez, dogru cevap olmaktan cikar. */
  gecersiz_kilindi?: Zaman;
  /** Bu kaydi gecersiz kilan yeni kayit. */
  yerine_gecen?: KebabId;
  kaynak?: { run_id?: KebabId; step_id?: KebabId };
}

export interface BellekSorgusu {
  /** Kapsam zorunlu: bos liste bos sonuc verir, "hepsi" degil (AP6 → kural 7). */
  katmanlar: BellekKatmani[];
  metin?: string;
  limit?: number;
  /**
   * Gecersiz kilinmis kayitlar da donsun. Varsayilan `false`: gecmis
   * **acikca** istenir, guvenli taraf varsayilandir (03-BELLEK §4).
   */
  gecmis?: boolean;
}

export interface MemoryManager {
  /** Yalnizca gecerli (gecersiz_kilinmamis) kayitlari dondurur. */
  oku(sorgu: BellekSorgusu): Promise<BellekKaydi[]>;

  /**
   * Yazma. `izin.decision` ALLOW degilse uygulama yazmaz — ama imza da
   * kararsiz cagrilmayi engeller: karar belgesi zorunlu argumandir.
   */
  yaz(kayit: Omit<BellekKaydi, "id" | "yazildi">, izin: IzinKarari): Promise<BellekKaydi>;

  /** Eski kaydi gecersiz kilar. Silme degil; kaynak kayit yerinde kalir. */
  gecersiz_kil(id: KebabId, yerine_gecen: KebabId, izin: IzinKarari): Promise<BellekKaydi>;
}

/**
 * Bellek yoneticisi. Bagimliligi yoktur: karar belgesi cagri basina gelir,
 * depo bellek icidir (ADR-002 — bu modul dosya sistemine dokunmaz).
 */
export declare function bellekYoneticisi(): MemoryManager;
