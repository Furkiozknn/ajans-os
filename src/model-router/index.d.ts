/**
 * Model Router — tek model siniri (K4).
 *
 * Blueprint §2.11: sinir **secim** ile **tasima** arasindan gecer. `ModelRouter`
 * %100 saglayici-agnostiktir; saglayiciya ozel her sey `ModelTasiyici`
 * arkasindadir. Sozlesme en az uc alan tasir: tasima ayari, yetenek beyani ve
 * acik uclu usage/cost sozlugu (cekirdege terfi bekleme odasi).
 */

import type { Kullanim } from "../tipler";

/** Adimin modelden ne istedigi. Saglayici adi burada gecmez. */
export interface ModelGereksinimi {
  /** Yetenek beyani: "arac-cagirma", "uzun-baglam", "ucuz" gibi etiketler. */
  yetenekler: string[];
  en_az_baglam_token?: number;
  /** Adim basina ust maliyet siniri; Cost Manager'in verdigi tavan. */
  tavan_usd?: number | null;
}

export interface ModelSecimi {
  /** Saglayici-agnostik model kimligi; tasiyici bunu kendi adina cevirir. */
  model_id: string;
  saglayici: string;
  /** Tasima ayari — zaman asimi, tekrar, taban URL gibi saglayiciya ozel. */
  tasima: Record<string, unknown>;
}

export interface ModelYaniti {
  icerik: unknown;
  usage: Kullanim;
  /** Saglayicinin bildirdigi ham maliyet sozlugu; bilinmiyorsa bos. */
  cost: Record<string, number | null>;
  model_id: string;
}

/** Saglayiciya ozel tek katman. Yeni saglayici = yeni tasiyici, cekirdek durur. */
export interface ModelTasiyici {
  saglayici: string;
  cagir(secim: ModelSecimi, istem: unknown): Promise<ModelYaniti>;
}

/**
 * Katalog girdisi — **veridir, koda gomulmez** (kural 11'in secim tarafi).
 * Sira operatorun tercihidir: kisitlari saglayan ilk girdi secilir.
 */
export interface KatalogGirdisi {
  model_id: string;
  saglayici: string;
  yetenekler: string[];
  baglam_token: number;
  /** Adim basina tahmini maliyet. Bilinmiyorsa `null` — sifir degil. */
  tahmini_usd?: number | null;
  tasima?: Record<string, unknown>;
}

export interface ModelRouter {
  /** Kurulusta verilen katalogun donmus hali. */
  readonly katalog: ReadonlyArray<Readonly<Required<KatalogGirdisi>>>;

  /**
   * Gereksinimden model secer. Saglayici-agnostik; saf karar. Kisitlari
   * saglayan girdi yoksa **istisna atar**; sessizce uymayan modele dusmez.
   */
  sec(gereksinim: ModelGereksinimi): ModelSecimi;

  /** Secilen modeli cagirir; tasiyiciyi kendisi bulur. */
  cagir(secim: ModelSecimi, istem: unknown): Promise<ModelYaniti>;
}

/**
 * Kurar. `katalog` bos olamaz ve gecersiz girdi sessizce atlanmaz (AP3).
 * `tasiyicilar` bos birakilabilir: `sec` tasiyicisiz de calisir — secim ile
 * tasima ayri katmanlardir (K4). `cagir` tasiyicisi olmayan bir secim icin
 * istisna atar; baska bir saglayiciya dusmez.
 */
export declare function modelYonlendirici(secenekler: {
  katalog: ReadonlyArray<KatalogGirdisi>;
  tasiyicilar?: ReadonlyArray<ModelTasiyici>;
}): ModelRouter;
