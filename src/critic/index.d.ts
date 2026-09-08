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

/** Tasiyicinin dondurmesi gereken bicim. Serbest metin kabul edilmez. */
export interface ElestiriYaniti {
  items: ElestiriMaddesi[];
  /** Ham cikti nerede duruyorsa oraya isaret (kural 12); mesaja kopyalanmaz. */
  raw_ref?: string;
}

/** message.schema.json payload.items maddesi. */
export interface ElestiriMaddesi {
  id: KebabId;
  severity: "dusuk" | "orta" | "yuksek";
  location?: string;
  what: string;
  fix_hint: string;
}

/** message.schema.json payload.items.maxItems — sema sabiti, yapilandirma degil. */
export declare const EN_FAZLA_MADDE: 20;

/**
 * Kurar. `cagir` modele giden tek kapidir; Model Router burada `import`
 * edilmez, bagimlilik U13'te elle baglanir (ADR-002). `saat` testte
 * sabitlenebilsin diye disaridan verilebilir.
 */
export declare function elestirmen(secenekler: {
  cagir: (istem: unknown) => Promise<ElestiriYaniti>;
  saat?: () => string;
  kimlik?: KebabId;
}): Critic;
