/**
 * Cost Manager — butcenin sahibi.
 *
 * Blueprint §2.12: fiyat tablosu **veridir, koda gomulmez**; bilinmeyen
 * maliyet `null`, sifir degil (AP10 → kural 11). Esik asilinca **planli faz
 * gecisi**: elindeki kismi ciktiyi yaz, sonra dur (SWE-agent autosubmission) —
 * ani olum degil.
 */

import type { Kullanim } from "../tipler";

/** Fiyat tablosu satiri. Kaynak bir veri dosyasidir, bu dosya degil. */
export interface FiyatSatiri {
  model_id: string;
  /** Milyon token basina USD. Bilinmiyorsa null — 0 yazmak yasak. */
  input_usd_per_mtok: number | null;
  output_usd_per_mtok: number | null;
  /** Onbellek sayaclari fiyatlaniyorsa. Yoksa o sayacli cagri bilinmeyen olur. */
  cache_read_usd_per_mtok?: number | null;
  cache_write_usd_per_mtok?: number | null;
  gecerli_tarih: string;
}

export interface ButceDurumu {
  harcanan_usd: number;
  /** Maliyeti hesaplanamayan cagri sayisi; sifir maliyet sayilmaz. */
  bilinmeyen_cagri: number;
  tavan_usd: number;
  doluluk: number;
  /** Planli faz gecisi esigi asildi mi? */
  gecis_gerekli: boolean;
}

export interface CostManager {
  /** Fiyat tablosunu veri dosyasindan yukler. Kodda gomulu tablo yoktur. */
  tablo_yukle(): Promise<FiyatSatiri[]>;

  /**
   * Bir cagrinin usage'ini isler. Fiyat satiri yoksa maliyet `null` doner ve
   * `bilinmeyen_cagri` artar; toplam bozulmaz ama "eksik" oldugu gorunur.
   */
  usage_isle(model_id: string, usage: Kullanim): { maliyet_usd: number | null; durum: ButceDurumu };

  /** Esik asildi mi? Asildiysa Orchestrator planli faz gecisine gecer. */
  gecis_gerekli_mi(): boolean;

  /** Bir adim icin verilebilecek ust maliyet siniri; kalan yoksa null. */
  adim_tavani(): number | null;

  /** Anlik butce durumu; hesaplama yapmaz, sayaclari okur. */
  durum(): ButceDurumu;
}

/** Fiyat tablosunun varsayilan yeri: depo kokundeki `veri/fiyat-tablosu.json`. */
export declare const VARSAYILAN_TABLO: string;

/**
 * Kurar. `tavan_usd` zorunludur. `gecis_esigi` (varsayilan 0.8) asilinca
 * `gecis_gerekli` kalkar; durdurma karari cagirana aittir. `adim_orani`
 * (varsayilan 0.25) `adim_tavani`nin kalan butceden aldigi paydir.
 */
export declare function maliyetYoneticisi(secenekler: {
  tabloYolu?: string;
  tavan_usd: number;
  gecis_esigi?: number;
  adim_orani?: number;
}): CostManager;
