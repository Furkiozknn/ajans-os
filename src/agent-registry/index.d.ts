/**
 * Agent Registry — ajan sozlesmelerinin tek kaynagi.
 *
 * Blueprint §2.3, ADR-006 (K8): ev sahibi bicimleri (Claude Code `.md`
 * frontmatter vb.) sozlesmeden **turetilir**, elle yazilmaz. Ajan eklemek
 * cekirdege dokunmayi gerektirmez (AP7).
 */

import type { AjanSozlesmesi, KebabId } from "../tipler";

/** Sema dogrulamasinin sonucu. Gecerliyse `hatalar` bostur. */
export interface DogrulamaSonucu {
  gecerli: boolean;
  hatalar: string[];
}

export interface AgentRegistry {
  /** Sozlesmeyi id ile getirir. Yoksa null. */
  getir(agent_id: KebabId): Promise<AjanSozlesmesi | null>;

  /** Rol/etiket suzgeciyle listeler. Suzgec yoksa hepsi. */
  listele(suzgec?: { role?: string; tags?: string[]; status?: string }): Promise<AjanSozlesmesi[]>;

  /** contracts/agent.schema.json'a gore dogrular. Kayit **once** dogrulanir. */
  dogrula(sozlesme: unknown): DogrulamaSonucu;

  /**
   * Ev sahibi bicimini uretir (K8). Donus, yazilacak dosyalarin yol→icerik
   * eslemesi; yazma isi cagiranin, cunku dosya yazmak izin islemidir.
   */
  turet(agent_id: KebabId, ev_sahibi: string): Promise<Record<string, string>>;
}

/**
 * Uygulama (`index.js`). Sozlesmeler `dizin` altindaki `*.json` dosyalarindan
 * yuklenir ve yukleme aninda dogrulanir: gecersiz bir sozlesme sessizce
 * atlanmaz, istisna atar — sessiz atlama "ajan neden yok" sorusunu bir sonraki
 * tura birakirdi. `semaYolu` verilmezse `contracts/agent.schema.json` okunur.
 */
export function ajanKaydi(secenekler: { dizin: string; semaYolu?: string }): AgentRegistry;
