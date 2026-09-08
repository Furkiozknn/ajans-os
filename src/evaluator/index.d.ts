/**
 * Evaluator — gecme kararini tek basina verir.
 *
 * Blueprint §2.8, ADR-004: yalnizca **deterministik** kaynaklardan beslenir
 * (cikis kodu, sema dogrulamasi, test, esik). LLM girdisi yoktur; Critic'in
 * oyu buraya girmez. Iki fonksiyon: `gecerli_mi` ve `esigi_asti_mi`.
 */

import type { DegerlendirmeSonucu, Kanit } from "../tipler";

export type { DegerlendirmeSonucu, Kanit };

export interface Evaluator {
  /** Cikti sozlesmeye/olcute uyuyor mu? Deterministik. */
  gecerli_mi(kanitlar: Kanit[]): DegerlendirmeSonucu;

  /** Sayisal olcum esigi asti mi? Deterministik. */
  esigi_asti_mi(olcum: { ad: string; deger: number }, esik: number): DegerlendirmeSonucu;
}
