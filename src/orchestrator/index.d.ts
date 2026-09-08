/**
 * Orchestrator — adim dongusunun sahibi.
 *
 * Blueprint §2.1 / §3.1: **diger bilesenleri yalnizca Orchestrator cagirir**
 * (ADR-002). Bu kural bir yorum degil, tip: `OrchestratorBagimliliklari`
 * diger 12 bilesenin tamamini icerir ve baska hicbir modul baska bir modulu
 * import etmez. Ihlali `arac/yapi-dogrula.js` yakalar.
 */

import type { AdimKaydi, GorevSozlesmesi, KebabId } from "../tipler";
import type { AgentRegistry } from "../agent-registry";
import type { ContextManager } from "../context-manager";
import type { CostManager } from "../cost-manager";
import type { Critic } from "../critic";
import type { Evaluator } from "../evaluator";
import type { MemoryManager } from "../memory-manager";
import type { ModelRouter } from "../model-router";
import type { Observability } from "../observability";
import type { PermissionManager } from "../permission-manager";
import type { RecoveryManager } from "../recovery-manager";
import type { TaskManager } from "../task-manager";
import type { ToolRegistry } from "../tool-registry";

/** Bilesim koku (composition root). Tek yer, tek yon. */
export interface OrchestratorBagimliliklari {
  gorev_yoneticisi: TaskManager;
  ajan_defteri: AgentRegistry;
  arac_defteri: ToolRegistry;
  izin_yoneticisi: PermissionManager;
  bellek_yoneticisi: MemoryManager;
  baglam_yoneticisi: ContextManager;
  degerlendirici: Evaluator;
  elestirmen: Critic;
  kurtarma_yoneticisi: RecoveryManager;
  model_yonlendirici: ModelRouter;
  maliyet_yoneticisi: CostManager;
  gozlem: Observability;
}

/** Bir kosunun neden bittigi. `butce` planli faz gecisidir, cokme degil. */
export type KosuSonu = "bitti" | "basarisiz" | "onay-bekliyor" | "butce" | "kesildi";

export interface KosuSonucu {
  run_id: KebabId;
  son: KosuSonu;
  /** Yazilan adim kayitlari; kesilse de yazilmis olanlar burada. */
  adim_kayitlari: AdimKaydi[];
}

export interface Orchestrator {
  /**
   * Gorevi bastan sona yurutur. Yarida kesilirse (butce, onay, cokme) geriye
   * yazilmis olani dondurur; kaldigi yer `gorev.run.step_records` icindedir,
   * `kosuyu_surdur` oradan devam eder.
   */
  kosuyu_yurut(gorev: GorevSozlesmesi): Promise<KosuSonucu>;

  /** Yarim kalmis bir kosuyu ayni gorev kaydindan surdurur (D1). */
  kosuyu_surdur(gorev: GorevSozlesmesi, run_id: KebabId): Promise<KosuSonucu>;

  /** Tek adim: blueprint §3.2'deki 1–10 sirasi. Sira degismez. */
  adimi_yurut(gorev: GorevSozlesmesi, adim_id: KebabId): Promise<AdimKaydi>;
}

/** Calisma ortamindan gelen ayarlar; mimari karar degil (08 §6). */
export interface OrkestratorSecenekleri {
  /** Model baglam penceresi (token). Context Manager esigi bunun uzerine uygulanir. */
  baglam_token?: number;
  /** Baglam butcesinde ayrilan tampon (token). */
  tampon_token?: number;
  /** Span zaman damgasi kaynagi; testte sabitlenir. */
  saat?: () => string;
}

export declare function orkestrator(
  bagimliliklar: OrchestratorBagimliliklari,
  secenekler?: OrkestratorSecenekleri,
): Orchestrator;
