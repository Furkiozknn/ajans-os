/**
 * Evaluator — gecme kararini tek basina verir.
 *
 * Blueprint §2.8, ADR-004: yalnizca **deterministik** kaynaklardan beslenir
 * (cikis kodu, sema dogrulamasi, test, esik). LLM girdisi yoktur; Critic'in
 * oyu buraya girmez. Iki fonksiyon: `gecerli_mi` ve `esigi_asti_mi`.
 */

import type { DegerlendirmeSonucu, Kanit, DegerlendirmeKarari } from "../tipler";

export type { DegerlendirmeSonucu, Kanit, DegerlendirmeKarari };

export interface Evaluator {
  /**
   * Cikti sozlesmeye/olcute uyuyor mu? Deterministik ve saf.
   *
   * Bos dizi `DEGERLENDIRILMEDI` verir (dogrulayici yok — D11). Kanit
   * birlesimi kapalidir: bilinmeyen `tur`, yanlis tipli ya da fazladan alan
   * **istisna** atar; sessizce yok sayilmaz. LLM metni bu yolla kanit
   * kiligina giremez.
   */
  gecerli_mi(kanitlar: Kanit[]): DegerlendirmeSonucu;

  /**
   * Sayisal olcum esigi asti mi? Deterministik. Esik **alt sinirdir**:
   * esige esit deger gecer. Deger ve esik yalnizca sonlu sayi olabilir;
   * metin ayristirilmaz, reddedilir (BILINEN-TUZAKLAR #4).
   */
  esigi_asti_mi(olcum: { ad: string; deger: number }, esik: number): DegerlendirmeSonucu;
}

export declare const GECTI: "GECTI";
export declare const KALDI: "KALDI";
export declare const DEGERLENDIRILMEDI: "DEGERLENDIRILMEDI";

/**
 * Kurar. Secenek almaz: ayarlanabilir bir kapi, ayni girdi icin iki farkli
 * sonuc verebilirdi. Kurulum durum tutmaz, iki cagri birbirini etkilemez.
 */
export declare function degerlendirici(): Evaluator;
