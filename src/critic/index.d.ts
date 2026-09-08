/**
 * Critic — bir LLM'dir ve **oyu gecme kararina girmez**.
 *
 * Blueprint §2.9: yalnizca "neden basarisiz oldu, sonraki denemede ne
 * yapilmali" yazar. Ciktisi serbest metin degil, `contracts/message.schema.json`
 * icinde `kind: "critique"` olan bir mesajdir; bu yuzden donus tipi
 * `MesajSozlesmesi`, `string` degil.
 */

import type { AdimKaydi, DegerlendirmeSonucu, KebabId, MesajSozlesmesi } from "../tipler";

export interface ElestiriGirdisi {
  run_id: KebabId;
  step_id: KebabId;
  /** Degerlendiricinin kaldi karari; elestiri ancak bundan sonra istenir. */
  degerlendirme: DegerlendirmeSonucu;
  adim_kaydi: AdimKaydi;
}

export interface Critic {
  /** kind: "critique" mesaji uretir. Gecti/kaldi karari **degistiremez**. */
  elestir(girdi: ElestiriGirdisi): Promise<MesajSozlesmesi>;
}
