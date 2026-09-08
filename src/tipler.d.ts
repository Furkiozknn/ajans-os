/**
 * Ortak sozlesme tipleri.
 *
 * TEK KAYNAK `contracts/*.json` dosyalaridir. Burada yalnizca arayuzlerin
 * imzasi icin gereken alanlar var; alan adlari JSON semasindakiyle birebir
 * ayni (Ingilizce). Sema ile bu dosya arasinda fark olursa **sema haklidir**.
 *
 * Kaynak: docs/mimari/00-BLUEPRINT.md §3.3, docs/mimari/08-YAPI-VE-ARAYUZLER.md
 */

/** contracts/*.json $defs.kebab_id */
export type KebabId = string;

/** ISO 8601 zaman damgasi. contracts/*.json $defs.zaman */
export type Zaman = string;

/** sha256:... ozet. contracts/*.json $defs.digest */
export type Ozet = string;

/** task.schema.json $defs.hata_turu */
export type HataTuru =
  | "SEMA_IHLALI"
  | "ARAC_HATASI"
  | "IZIN_REDDI"
  | "BUTCE_DUVARI"
  | "ZAMAN_ASIMI"
  | "MODEL_HATASI"
  | "DOGRULAMA_KALDI"
  | "BAGIMLILIK_BASARISIZ"
  | "BILINMEYEN";

/** task.schema.json $defs.step_record.status */
export type AdimDurumu =
  | "PLANLANDI"
  | "BASLADI"
  | "GIRDI_BEKLIYOR"
  | "ONAY_BEKLIYOR"
  | "BITTI"
  | "BASARISIZ";

/** agent.schema.json $defs.memory_layer */
export type BellekKatmani = "task" | "session" | "project" | "global" | "knowledge";

/** permission.schema.json properties.action.operation */
export type IzinSinifi =
  | "read"
  | "write"
  | "execute"
  | "network"
  | "delete"
  | "publish"
  | "memory_write";

/** permission.schema.json properties.decision — uc degerli, ADR-005 */
export type IzinKarariDegeri = "ALLOW" | "BLOCK" | "HUMAN_REQUIRED";

/** message.schema.json properties.kind */
export type MesajTuru =
  | "assignment"
  | "result"
  | "critique"
  | "handoff"
  | "approval_request"
  | "approval_decision"
  | "error";

/** span.schema.json properties.operation */
export type SpanIslemi =
  | "run"
  | "invoke_agent"
  | "inference"
  | "execute_tool"
  | "permission_check"
  | "evaluate"
  | "critique"
  | "memory_write"
  | "recovery";

/**
 * Sozlesme govdeleri. Zorunlu alanlarin bir kismi burada; geri kalani
 * `[alan: string]: unknown` ile acik birakildi cunku dogrulama semayla
 * yapilir, tip sistemiyle degil (bkz. arac/sema-dogrula.js).
 */

/** contracts/agent.schema.json */
export interface AjanSozlesmesi {
  contract_version: string;
  identity: { id: KebabId; name: string; version: string; status: string; [alan: string]: unknown };
  role: string;
  tools: unknown;
  permissions: unknown;
  memory_scope: unknown;
  [alan: string]: unknown;
}

/** contracts/task.schema.json $defs.step */
export interface Adim {
  id: KebabId;
  title: string;
  assign: unknown;
  depends_on?: KebabId[];
  side_effects?: unknown;
  human_gate?: unknown;
  [alan: string]: unknown;
}

/** contracts/task.schema.json $defs.step_record */
export interface AdimKaydi {
  step_id: KebabId;
  attempt: number;
  status: AdimDurumu;
  started_at: Zaman;
  ended_at?: Zaman;
  result_summary?: string;
  error_type?: HataTuru;
  cost_usd?: number | null;
  [alan: string]: unknown;
}

/** contracts/task.schema.json — gorev + graf + kosu */
export interface GorevSozlesmesi {
  contract_version: string;
  task: { id: KebabId; title: string; goal: string; [alan: string]: unknown };
  graph: { steps: Adim[] };
  run: {
    run_id: KebabId;
    started_at: Zaman;
    ended_at?: Zaman;
    resumed_from?: KebabId;
    step_records: AdimKaydi[];
  };
}

/** contracts/message.schema.json */
export interface MesajSozlesmesi {
  contract_version: string;
  message_id: KebabId;
  run_id: KebabId;
  step_id?: KebabId;
  at: Zaman;
  from: unknown;
  to: unknown;
  kind: MesajTuru;
  payload: Record<string, unknown>;
}

/** contracts/permission.schema.json */
export interface IzinKarari {
  contract_version: string;
  decision_id: KebabId;
  run_id: KebabId;
  at: Zaman;
  requester: unknown;
  action: { tool: string; operation: IzinSinifi; summary: string; arguments_digest?: Ozet };
  scope: unknown;
  irreversible: boolean;
  decision: IzinKarariDegeri;
  reason: string;
  [alan: string]: unknown;
}

/** contracts/span.schema.json */
export interface Span {
  contract_version: string;
  span_id: KebabId;
  trace_id: KebabId;
  parent_span_id: KebabId | null;
  run_id: KebabId;
  operation: SpanIslemi;
  name: string;
  started_at: Zaman;
  outcome: { status: "ok" | "hata" | "kesildi"; error_type?: HataTuru; error_message?: string };
  usage?: Record<string, unknown>;
  cost?: Record<string, unknown>;
  shadow?: boolean;
  [alan: string]: unknown;
}

/** Bir aracin MCP JSON Schema tanimi. Yeni sozlesme yazilmaz (blueprint §2.4). */
export interface AracTanimi {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** Bir LLM cagrisinin token/adet sayaclari. Bilinmeyen alan yok, eksik alan olur. */
export interface Kullanim {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  [sayac: string]: number | undefined;
}

/**
 * Degerlendirme kaniti — yalnizca deterministik kaynaklar (ADR-004).
 * LLM ciktisi bu tipe giremez.
 */
export type Kanit =
  | { tur: "cikis_kodu"; kod: number }
  | { tur: "sema"; sema: string; gecerli: boolean; hatalar: string[] }
  | { tur: "test"; gecen: number; kalan: number }
  | { tur: "olcum"; ad: string; deger: number };

/**
 * Kapinin uc degeri (ADR-004, task.schema.json `evaluation_result`).
 * Ucuncu deger zorunludur: "kontrol edilmedi" ile "temiz" ayni sey degildir
 * (D11). `DEGERLENDIRILMEDI` isi durdurmaz, insan kapisina dusurur.
 */
export type DegerlendirmeKarari = "GECTI" | "KALDI" | "DEGERLENDIRILMEDI";

export interface DegerlendirmeSonucu {
  sonuc: DegerlendirmeKarari;
  /** Kisayol; her zaman `sonuc === "GECTI"`. Iki alan asla ayrisamaz. */
  gecti: boolean;
  /** Karari veren kanitlar; yalnizca `DEGERLENDIRILMEDI` bos olabilir. */
  kanitlar: Kanit[];
  aciklama: string;
}
