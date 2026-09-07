# Letta (MemGPT)

## Kimlik
letta-ai/letta · 24.638 yıldız · 142 watcher · son push 2026-08-23 · Apache-2.0 · arşivlenmemiş.
Dil/sürüm: Python, `requires-python = "<3.14,>=3.11"`, paket sürümü `0.16.8` (`pyproject.toml`, `origin/archive` dalı). Haftalık PyPI indirme: doğrulanmadı (erişimim yok).

canlılık: geçti — ANCAK önemli bir uyarı var (bkz. not aşağıda).

**Not (metodolojik dürüstlük):** GitHub'daki `main` dalının HEAD'i (`4511fa0`, 2026-08-23) ve bir önceki commit'i (`87fd37a`) yalnızca 12 idari dosya içeriyor (README, LICENSE, AGENTS.md vb.) — `letta/` kaynak kodu, `tests/`, `pyproject.toml` **main dalında yok**. Bunu `gh api repos/letta-ai/letta/contents/` ile doğrudan GitHub API'den doğruladım, klon hatası değil. Gerçek kaynak kod `archive` dalında duruyor (son commit 2026-08-14, `git fetch origin archive`). Bu analiz `origin/archive` dalı üzerinden yapıldı; tüm dosya yolları bu dala göredir. Bu proje sahibi için ek bulgu: repo şu an "arşivlenmemiş" statüsünde ama varsayılan dal fiilen boşaltılmış — README pazarlaması ile gerçek repo durumu arasında ciddi bir fark var, bu da KURAL 2'nin (README'ye güvenme) somut bir örneği.

## Çözdüğü problem
LLM'lerin sabit bağlam penceresi sorununu, ajana kendi "çekirdek belleğini" (persona, kullanıcı bilgisi vb.) düzenleme aracı vererek ve bunun dışında kalan bilgiyi aranabilir bir arşive (archival memory) taşıyarak çözüyor. Amaç: oturumlar arası kalıcı, kendi kendini düzenleyen ajan belleği (self-editing memory / "MemGPT" fikri).

## Mimari
```
İstemci --> letta/server (FastAPI, letta/server/) --> Agent Loop (letta/agents/letta_agent_v3.py)
                                                          |-- LLM Client (letta/llm_api/*_client.py, sağlayıcı-bağımsız)
                                                          |-- Tool Executor (letta/services/tool_executor/core_tool_executor.py)
                                                          |     -> Block Manager (letta/services/block_manager.py) [core memory yazma]
                                                          |     -> Passage Manager (letta/services/passage_manager.py) [archival yazma/okuma]
                                                          |-- Context Window Calculator (letta/services/context_window_calculator/)
                                                          |-- Summarizer / Compaction (letta/services/summarizer/*)
                                                          '-- Message Manager (letta/services/message_manager.py) [recall memory]
DB katmanı: letta/orm/*.py (SQLAlchemy, Postgres+pgvector veya SQLite) + opsiyonel Turbopuffer (letta/helpers/tpuf_client.py)
```
Ajan durumu (`AgentState`, `letta/schemas/agent.py`) her adımda DB'den yüklenip sistem promptu yeniden derleniyor (`agent_manager.rebuild_system_prompt_async`).

## Klasör yapısı
```
letta/
  agents/            ajan çalıştırma döngüleri (letta_agent_v3.py = güncel, letta_agent.py = eski)
  services/
    block_manager.py       core memory (Block) CRUD + versiyonlama
    passage_manager.py     archival memory (Passage) CRUD + embedding
    archive_manager.py     Archive (passage koleksiyonu) yönetimi, native/tpuf seçimi
    message_manager.py     recall memory (mesaj geçmişi) CRUD + hibrit arama
    summarizer/             bağlam sıkıştırma / özetleme stratejileri
    context_window_calculator/  token sayımı ve pencere raporu
    file_processor/         dosya -> chunk -> embedding hattı (RAG "knowledge" kaynakları)
    tool_executor/           araç adı -> Python metodu eşlemesi (core_tool_executor.py)
  orm/                SQLAlchemy tablo tanımları (block.py, passage.py, message.py, archive.py...)
  schemas/            Pydantic API/iç modeller (memory.py, block.py, passage.py, tool_rule.py...)
  functions/function_sets/base.py   modele açık bellek araçlarının imza+docstring tanımı
  llm_api/            13+ sağlayıcı istemcisi (anthropic, openai, azure, bedrock, google, groq, xai, zai, ...)
```

## Bellek modeli
Dört ayrı katman, dört ayrı depolama:
1. **Core memory (in-context)** — `letta/orm/block.py`, tablo `block`. Her blok bir `label` (persona, human, ...), `value` (metin), `limit` (karakter sınırı, varsayılan `CORE_MEMORY_BLOCK_CHAR_LIMIT = 100000`, `letta/constants.py:435`) ve `read_only` bayrağı taşır. Sınır uygulaması uygulama katmanında: `memory_replace`/`core_memory_append` gibi araçlar önce `read_only` kontrolü yapar (`letta/services/tool_executor/core_tool_executor.py:319-345`), ancak karakter limitine karşı yazma sırasında kod içinde açık bir kontrol bulunmadı — limit alanı şemada var (`orm/block.py:44`) ama executor'da doğrulandığını gösteren bir satır bulamadım (incelenmedi ölçüde derin: pydantic validator tarafında olabilir, `schemas/block.py` tam taranmadı).
2. **Archival memory** — `letta/orm/passage.py` (`ArchivalPassage`, tablo `archival_passages`) veya harici Turbopuffer (`letta/helpers/tpuf_client.py`), seçim `Archive.vector_db_provider` alanına göre (`letta/services/archive_manager.py:41-44`, `VectorDBProvider.NATIVE` vs `TPUF`). Yazan: `archival_memory_insert` aracı (`core_tool_executor.py:315-318`) -> `passage_manager.insert_passage`. Okuyan: `archival_memory_search` -> `agent_manager.search_agent_archival_memory_async` (`letta/services/agent_manager.py:2534`).
3. **Recall memory** — konuşma geçmişi, `letta/orm/message.py`, tablo `messages`; `conversation_search` aracıyla model tarafından hibrit (metin+vektör) aranabilir (`core_tool_executor.py` içindeki `conversation_search`, RRF skorları `combined_score/vector_rank/fts_rank`).
4. **Message buffer (context window)** — o an modele gönderilen ham mesaj listesi; boyutu `letta/services/summarizer/*` tarafından yönetiliyor (aşağıya bkz).

Kim okur/kim yazar: Core memory'yi **model kendisi** (self-editing, bkz. "Bellek yazma yetkisi") günceller; archival/recall'a model yazıyor (archival_memory_insert) ama recall memory'ye yazma asıl konuşma akışının doğal sonucu (her mesaj otomatik kaydediliyor), model onu sadece okuyor/arıyor.

## Bağlam yönetimi
Token sayımı: `letta/services/summarizer/summarizer_sliding_window.py:count_tokens` — model tipine göre gerçek tokenizer (`create_token_counter`) veya yaklaşık `bytes/4` sayaç kullanır; yaklaşık sayaç için `%30` güvenlik payı eklenir (`APPROX_TOKEN_SAFETY_MARGIN = 1.3`, satır 24). Araç tanımları da (`count_tokens_with_tools`) sayıma dahil ediliyor.

Eşik: `letta/services/summarizer/thresholds.py:get_compaction_trigger_threshold` — varsayılan tetikleme `context_window * SUMMARIZATION_TRIGGER_MULTIPLIER` (`SUMMARIZATION_TRIGGER_MULTIPLIER = 0.9`, `letta/constants.py:83`); GPT-5 ailesi için `force_proactive` bayrağıyla erken (%90) tetikleme özel olarak not düşülmüş (uzun input+çıktı limiti taşması gözlemlendiği için).

Doldu ne oluyor: `letta/agents/letta_agent_v3.py:1218` — `ContextWindowExceededError` yakalanır, `summarizer_settings.max_summarizer_retries` sınırına kadar `self.compact(...)` çağrılır (satır ~1234). `compact` -> `letta/services/summarizer/summarizer_sliding_window.py:summarize_via_sliding_window`: mesaj listesinde bir kesim noktası (cutoff) bulunur, kesilen kısım ayrı bir "özetleyici ajan" (Haiku/gpt-5-mini/gemini-flash, `summarizer_config.py:get_default_summarizer_model`) tarafından özetlenir ve özet, sohbetin başına bir özet mesajı olarak eklenir (`simple_summary`, `summarizer.py`). Kaybolan ham mesajlar DB'de (`messages` tablosunda) kalır, sadece **modele gönderilen bağlamdan** çıkarılır — yani kalıcı silme değil, context'ten tahliye (evict). Ayrıca eski/legacy bir `Summarizer` sınıfı (`letta/services/summarizer/summarizer.py`) statik tampon (`STATIC_MESSAGE_BUFFER`) veya kısmi tahliye (`PARTIAL_EVICT_MESSAGE_BUFFER`) modlarıyla da mevcut ama dosya başında "legacy, new version is functional" notu var (satır 34).

## Bellek yazma yetkisi ve güvenlik
**Soru A — kim yazıyor:** Core memory'ye yazma tamamen **model kendisi** üzerinden, modelin çağırdığı araçlarla yapılıyor: `core_memory_append`, `core_memory_replace`, `memory_replace`, `memory_insert`, `memory_apply_patch`, `memory_str_replace/insert`, `memory_rethink`, `memory_finish_edits`, `memory` (`letta/services/tool_executor/core_tool_executor.py:44-58` fonksiyon eşlemesi). Doğrulama/onay: yalnızca `read_only` bayrağı kontrol ediliyor (satır 320, 329); ayrıca `memory_replace` içinde eski metnin blokta **benzersiz** olması zorunlu tutuluyor (occurences==0/>1 hatası, satır ~230-245) — bu bir güvenlik onayı değil, bir düzenleme bütünlüğü kontrolü. Genel amaçlı bir `RequiresApprovalToolRule` mekanizması var (`letta/schemas/tool_rule.py:348`, `PendingApprovalError`, `ApprovalRequestMessage` — `letta/errors.py:48`, `letta/schemas/letta_message.py:306`) ve bir araç bu kurala bağlanırsa insan onayı bekletilebiliyor; ancak varsayılan olarak bellek araçlarının bu kurala bağlı olduğuna dair kanıt bulamadım (ajan/tool tanımına göre değişir) — yani insan onayı **var ama opsiyonel/varsayılan değil**.

**Soru B — PII/hassas veri:** Kodda `redact/pii/anonymi` için grep yapıldığında bulunan tüm eşleşmeler LLM'nin "redacted thinking" (Anthropic reasoning) içeriğiyle ilgili (`letta/interfaces/anthropic_*streaming_interface.py`), **memory/PII maskeleme değil**. `encrypt` araması yalnızca `letta/helpers/crypto_utils.py` (AES-256-GCM) ve `letta/schemas/secret.py` çıkarıyor; bu şifreleme **sadece tool/sandbox kimlik bilgileri (API anahtarları, secrets)** için, core/archival/recall memory içeriği düz metin olarak DB'de saklanıyor — şifreleme yok. `ttl/retention` araması yalnızca Redis kilit sürelerini (`CONVERSATION_LOCK_TTL_SECONDS`, `letta/constants.py:475`) ve OpenAI prompt-cache retention ayarlarını buluyor; **veri saklama süresi (retention policy) yok**. Silme: `delete_block_async`, `delete_agent_passage_by_id_async`, `delete_all_messages_for_agent_async` gibi sert-silme (hard delete) fonksiyonları var (`block_manager.py:275`, `passage_manager.py:767/857`, `message_manager.py:1045`) — yani "sil" isteği (right-to-erasure) API üzerinden karşılanabilir, ama otomatik/zamanlı bir silme yok. **Sonuç: PII maskeleme/anonimleştirme yok; içerik şifreleme yok (sadece secrets şifreli); TTL/retention yok; manuel hard-delete var.** Repo kökünde ayrı bir `PRIVACY.md` var ama bu politika metni, koda yansıyan bir teknik önlem değil.

## RAG ve bilgi katmanı
Embedding sağlayıcıları çoklu: openai/anthropic/bedrock/google_ai/google_vertex/azure/ollama (`letta/schemas/embedding_config.py:12-19`). Varsayılan chunk boyutu `DEFAULT_EMBEDDING_CHUNK_SIZE = 300` (`letta/constants.py:94`), maksimum embedding boyutu `MAX_EMBEDDING_DIM = 4096` (satır 93, pgvector şeması buna göre sabitlenmiş — "DBs will need to be reset" uyarısı var). Chunking iki stratejiyle yapılıyor: `letta/services/file_processor/chunker/line_chunker.py` (dosya tipine göre satır bazlı) ve `llama_index_chunker.py` (LlamaIndex tabanlı). Vektör deposu: Postgres+pgvector (`letta/orm/passage.py:35-39`, `settings.database_engine is DatabaseChoice.POSTGRES`) veya SQLite (`CommonVector` custom column) yerelde; opsiyonel olarak Turbopuffer (harici SaaS, `letta/helpers/tpuf_client.py`) — `Archive.vector_db_provider` alanı ile seçiliyor (`archive_manager.py:41`). Hibrit arama (vektör + tam metin, Reciprocal Rank Fusion) yalnızca Turbopuffer istemcisinde bulundu (`tpuf_client.py:1489 _reciprocal_rank_fusion`, `k`/`vector_weight`/`fts_weight` parametreli); native pgvector yolunda aynı seviyede RRF koduna rastlamadım (incelenmedi ölçüde: `agent_manager.py:2534` içindeki `search_agent_archival_memory_async` her iki backend'i de sarmalıyor ama native tarafın hibrit skorlama detayını doğrulamadım).

## Ajan tasarımı
Ajan, DB'de kalıcı bir `AgentState` (Pydantic model, `letta/schemas/agent.py`) olarak tanımlanıyor: `agent_type` (enum, `memgpt_agent`, `react_agent`, `sleeptime_agent` vb., satır 38-49), `llm_config`, `memory` (Blocks), `tools` (Tool listesi), `tool_rules` (ToolRule listesi — makine okunur izin/sıra sözleşmesi: `ChildToolRule`, `ConditionalToolRule`, `InitToolRule`, `TerminalToolRule`, `MaxCountPerStepToolRule`, `RequiresApprovalToolRule`, `letta/schemas/tool_rule.py`), `sources` (dosya kaynakları), `identities`. Araçlar OpenAI function-calling şemasına (`json_schema`) çevrilerek modele veriliyor (`letta/functions/schema_generator.py`); girdi/çıktı sözleşmesi docstring + tip anotasyonlarından üretiliyor (bkz. `functions/function_sets/base.py` docstring formatı). Yani "ajan sözleşmesi" = DB satırı + Pydantic şema + ToolRule listesi, kodla zorunlu kılınan makine-okur bir yapı.

## Hata yönetimi
Zengin bir hata hiyerarşisi var (`letta/errors.py`): `LLMRateLimitError`, `LLMProviderOverloaded`, `LLMTimeoutError`, `LLMServerError`, `ConcurrentUpdateError` (iyimser kilitleme çakışması, "Please retry your request"), `ConversationBusyError`/`MemoryRepoBusyError` (kilit çakışmaları), `PendingApprovalError`. Fallback: `letta/agents/letta_agent_v3.py` içinde `LLMRateLimitError/LLMServerError/LLMProviderOverloaded` yakalanınca `llm_router` üzerinden alternatif model handle'ına (`fallback_handle`) otomatik geçiş yapılıyor (satır ~1195-1210). Retry: context window taşımasında `max_summarizer_retries` kadar sıkıştırma denemesi (yukarıda). Rollback/checkpoint: `letta/services/block_manager.py:842 checkpoint_block_async` — her core memory değişikliği `BlockHistory` tablosuna sıra numarasıyla kaydediliyor, `current_history_entry_id` üzerinden önceki sürüme dönülebiliyor (undo/redo mekanizması, satır 760-790). İnsan onayı: `RequiresApprovalToolRule` + `ApprovalRequestMessage` akışı (bkz. yukarı).

## Genişletilebilirlik
Yeni bir bellek katmanı eklemek: yeni bir ORM tablosu (`letta/orm/`) + Pydantic şeması (`letta/schemas/`) + yeni bir `*_manager.py` servis + `core_tool_executor.py`'de fonksiyon eşlemesi + `function_sets/base.py`'de docstring tanımı — en az 5 dosya. Yeni bir vektör deposu eklemek: `VectorDBProvider` enum'a yeni değer (`letta/schemas/enums.py`) + `archive_manager.py`'de seçim mantığı + yeni bir client sınıfı (tpuf_client.py benzeri) — tahmini 3-4 dosya, ama `_reciprocal_rank_fusion` gibi arama mantığını yeniden yazmak gerekebilir (paylaşılan bir arayüz/soyutlama yok, her backend kendi arama kodunu taşıyor). Yeni bir LLM sağlayıcısı eklemek nispeten kolay: `letta/llm_api/` altına yeni `*_client.py` + `llm_client.py`'de fabrika kaydı — mevcut 13+ sağlayıcı örneği bunun rutin olduğunu gösteriyor.

## Güçlü yönler (kanıtlı)
- Self-editing memory gerçek ve derin: 9 farklı bellek düzenleme aracı, satır-numaralı diff uygulama (`memory_apply_patch`) dahil (`core_tool_executor.py:44-58`).
- Optimistic locking + tam checkpoint/undo geçmişi core memory için (`block.py:version` alanı + `block_manager.py:842`).
- Sağlayıcı bağımsızlığı hem LLM (13+ istemci) hem embedding (7 sağlayıcı) tarafında kodla kanıtlanmış.
- Bağlam taşması için otomatik, yeniden denemeli sıkıştırma + model ailesine özel proaktif eşik (GPT-5 için %90) — üretimde gözlemlenen bir soruna karşı somut düzeltme (`thresholds.py` yorumu).

## Zayıf yönler (kanıtlı)
- Bellek içeriği için sıfır güvenlik önlemi: PII maskeleme yok, şifreleme yok, retention/TTL yok (yalnızca kilit TTL'leri var) — kanıt: hedefli grep sonuçları yukarıda.
- `main` dalı fiilen kaynak koddan arındırılmış durumda (GitHub API ile doğrulandı); gerçek kod yalnızca `archive` ve özellik dallarında yaşıyor — bu proje sağlığı/erişilebilirliği açısından ciddi bir uyarı işareti.
- Hibrit arama (RRF) sadece harici Turbopuffer entegrasyonunda somut kodla görüldü; native pgvector yolunda aynı derinlikte hibrit skorlama koduna rastlanmadı (bu nokta "incelenmedi" düzeyinde bırakıldı, ileri doğrulama gerekir).
- `RequiresApprovalToolRule` var ama bellek yazma araçlarına varsayılan olarak bağlı değil; yani en hassas işlem (kendi belleğini değiştirme) varsayılan yapılandırmada insan onayından geçmiyor.
- Legacy/aktif kod karışıklığı: `letta_agent.py` vs `letta_agent_v2.py` vs `letta_agent_v3.py`, `Summarizer` (legacy) vs `summarize_via_sliding_window` (yeni) — bakım yükü ve kafa karışıklığı riski kod yorumlarında açıkça itiraf edilmiş ("legacy, new version is functional").

## Puan (1–5)
- olgunluk: 4 — 0.16.8 sürüm numarası, geniş test klasörü (`tests/managers`, `tests/test_memory.py`), üretimde gözlemlenmiş sorunlara (GPT-5 context taşması) yapılan somut düzeltmeler var; ama repo'nun main dalının boşaltılmış olması puanı 5'ten indiriyor.
- mimari netlik: 3 — katmanlar (core/archival/recall) net ayrılmış ve dosya bazında izlenebilir, ama üç ayrı ajan döngüsü sürümünün (v1/v2/v3) bir arada yaşaması netliği bozuyor.
- genişletilebilirlik: 3 — LLM sağlayıcı ekleme kolay (rutin örnek çok), ama vektör deposu/bellek katmanı eklemek paylaşılan arayüz eksikliği yüzünden birden fazla dosyaya dağınık değişiklik gerektiriyor.
- güvenilirlik ilkelleri: 4 — retry, fallback routing, optimistic locking, checkpoint/undo hepsi kodda somut ve birbirinden bağımsız çalışıyor.
- gözlemlenebilirlik: 4 — `letta/otel/` (OpenTelemetry), `clickhouse_otel_traces.py`, `provider_trace.py`/`llm_trace_writer.py` gibi ayrık telemetri/trace altyapısı mevcut (dosya isimlerinden görüldü, içerik detaylı okunmadı).
- güvenlik duruşu: 2 — sadece secrets şifreleniyor; bellek içeriği (potansiyel olarak PII barındıran core/archival memory) düz metin, maskeleme/retention yok, bellek yazma araçlarına varsayılan insan onayı yok.

## Alınacak fikir
- **Karakter/token limitli, etiketli bellek blokları (core memory)** — belirsiz "büyük bir sohbet geçmişi" yerine, ajan durumunun kritik parçalarını (persona, kullanıcı profili) ayrı, sınırlı, adlandırılmış bloklara ayırmak; bizim ajanlarımızda "kim/ne/neden" gibi sabit alanları benzer şekilde modelleyebiliriz.
- **BlockHistory tarzı checkpoint/undo** (`block_manager.py:842`) — herhangi bir yapılandırılabilir durumu (ör. ajan talimatları, tercihleri) her değişiklikte versiyonlamak; hatalı bir self-edit'i geri almak için ucuz ve etkili bir desen.
- **Model ailesine özel proaktif eşik** (`thresholds.py`, GPT-5 için %90) — "bir boyut hepsine uyar" tek eşik yerine, gözlemlenen sağlayıcıya özgü arızalara göre eşiği parametrize etmek.
- **RequiresApprovalToolRule + PendingApprovalError deseni** — genel amaçlı, araç bazında takılabilir bir insan-onayı kancası; bizim yüksek riskli araçlarımıza (dosya silme, dış paylaşım) aynı desenle onay kapısı eklenebilir.

## Alınmayacak
- **Turbopuffer'a özel hibrit arama kodu** — güçlü ama tek sağlayıcıya kilitli (SaaS bağımlılığı); native pgvector yoluyla aynı seviyede desteklenmiyor gibi görünüyor, bizim için sağlayıcı bağımsızlığını bozar.
- **Bellek yazma araçlarına varsayılan onay uygulamaması** — MemGPT'nin kendi tasarımı bunu bilinçli olarak açık bırakmış (otonomi için), ama bizim "insan kapısı" ilkemizle çelişir; bu varsayılanı kopyalamamalıyız.
- **Üç paralel ajan-döngüsü sürümünün (v1/v2/v3) aynı anda üretimde tutulması** — geriye dönük uyumluluk için mantıklı olabilir ama bizim ölçeğimizde gereksiz karmaşıklık ve bakım yükü yaratır.

## Matris cevapları
- saglayici_bagimsiz: evet — 13+ LLM istemcisi (`letta/llm_api/*_client.py`) ve 7 embedding sağlayıcısı (`schemas/embedding_config.py:12-19`) kodla kanıtlı; vektör depo tarafında ise yalnızca native/Turbopuffer iki seçenek var.
- sozlesme_var: evet — `AgentState` (Pydantic, DB'de kalıcı) + `Tool`/`ToolRule` şemaları + `json_schema` üretimi (`functions/schema_generator.py`) makine-okur, zorunlu kılınan bir sözleşme oluşturuyor.
- insan_kapisi: kismen — `RequiresApprovalToolRule`/`PendingApprovalError`/`ApprovalRequestMessage` mekanizması var ama bellek yazma araçlarına varsayılan olarak bağlı olduğuna dair kanıt yok; opsiyonel, varsayılan açık değil.
- checkpoint: evet — `block_manager.py:842 checkpoint_block_async` + `BlockHistory` tablosu ile core memory için gerçek versiyonlama/undo var; ayrıca `ConcurrentUpdateError` ile optimistic locking mevcut.
