/**
 * Context Manager — prompt butcesinin sahibi.
 *
 * Blueprint §2.7, formul LightRAG'den dogrudan alindi:
 * `kalan = toplam − (sistem sozlesmesi + gorev durumu + bilgi + sorgu + tampon)`
 * Esik %100'un altindadir ve **kisilma sirasi onceden yazilir** — calisma
 * aninda "neyi atalim" karari verilmez.
 */

/** Formulun bilesenleri, token cinsinden. */
export interface ButceBilesenleri {
  toplam: number;
  sistem_sozlesmesi: number;
  gorev_durumu: number;
  bilgi: number;
  sorgu: number;
  tampon: number;
}

/** Kisilacak parcalarin sirasi. Ilk eleman ilk kisilir. */
export type KisilmaSirasi = ReadonlyArray<"bilgi" | "gorev_durumu" | "sorgu">;

export interface ButceSonucu {
  bilesenler: ButceBilesenleri;
  kalan: number;
  /** Esigi astiysa hangi parcalar ne kadar kisildi. */
  kisilanlar: Array<{ parca: KisilmaSirasi[number]; kisilan_token: number }>;
  asildi_mi: boolean;
}

export interface ContextManager {
  /** Doluluk esigi; %100'un altinda olmak zorunda (0 < esik < 1). */
  readonly esik: number;

  /** Onceden yazili kisilma sirasi. Calisma aninda degismez. */
  readonly kisilma_sirasi: KisilmaSirasi;

  /** Formulu uygular ve gerekiyorsa siraya gore kisar. */
  butcele(bilesenler: ButceBilesenleri): ButceSonucu;
}

/**
 * Kurar. `esik` 0 ile 1 arasindadir (1 kabul edilmez); `kisilma_sirasi`
 * donmustur ve calisma aninda degistirilemez.
 *
 * Donen `ButceSonucu.bilesenler` **kisilma sonrasi** halidir; `asildi_mi`
 * ise esigin kisilmadan once asilip asilmadigini soyler.
 */
export declare function baglamYoneticisi(secenekler?: {
  esik?: number;
  kisilma_sirasi?: KisilmaSirasi;
}): ContextManager;
