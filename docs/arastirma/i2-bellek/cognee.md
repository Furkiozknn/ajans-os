# cognee
## Kimlik
topoteretes/cognee · 30.542 yıldız · 112 watcher · son push 2026-09-06 · Apache-2.0 · Python · haftalık indirme doğrulanmadı
Sürüm: `pyproject.toml:4` → `version = "1.5.4"`, `requires-python = ">=3.10,<3.15"`.
canlılık: geçti (son push tarihi güncel, 683 adet `test_*.py` dosyası mevcut, aktif değişiklik geçmişi — bkz. `cognee/alembic/versions/` altındaki güncel migration'lar)

## Çözdüğü problem
LLM tabanlı ajanlara "anlamsal katman" (semantic layer) sağlamak: ham metin/doküman/kod girdisini kalıcı bir bilgi grafiğine (knowledge graph) + vektör indeksine dönüştürüp, bunun üzerinden zenginleştirilmiş bağlam (RAG'den daha fazlası — graf ilişkileri, özetler, ontoloji) döndürmek. `README.md` üstünden değil, `cognee/api/v1/{add,cognify,search}` kodundan doğrulandı.

## Mimari
Üç aşamalı ECL (Extract-Cognify-Load) akışı, `add()` → `cognify()` → `search()`:
- **add()** — `cognee/api/v1/add/add.py`: dosya/metni ingest eder, `Data` kayıtları oluşturur, dataset üzerinde kullanıcıya read/write/delete/share izni verir (satır 100-117 docstring + `resolve_authorized_user_dataset` çağrısı, `cognee/api/v1/add/add.py:8-9`).
- **cognify()** — `cognee/api/v1/cognify/cognify.py:104-` : `run_pipeline` ile task zinciri kurar: `classify_documents` → `extract_chunks_from_documents` → `extract_graph_and_summarize` (LLM ile graf çıkarımı + özetleme paralel, `cognee/tasks/graph/extract_graph_and_summarize.py:12-33`) → `add_data_points` (yazma, `cognee/tasks/storage/add_data_points.py:67`).
- **search()** — `cognee/api/v1/search/search.py:40-` : yetki kontrolünden geçen dataset'lerde `search_function` çağrılır, seçilen `SearchType`'a göre bir retriever örneklenir (`cognee/modules/search/methods/get_search_type_retriever_instance.py`).
- Pipeline motoru (`cognee/modules/pipelines/operations/run_tasks_base.py`) her task'ı `handle_task` ile sarar: telemetry, OpenTelemetry span, provenance damgalama (`_stamp_provenance`), hata durumunda `raise error` (satır 257).

## Klasör yapısı
```
cognee/
  api/v1/{add,cognify,search,datasets,users,visualize,recall,tools}/  # dış API yüzeyi, FastAPI router'ları
  modules/
    pipelines/     # Task/BoundTask, run_pipeline, run_tasks_base, PipelineRun durum makinesi
    engine/models/ # Entity, EntityType, Event, Triplet — DataPoint alt sınıfları
    graph/         # upsert_nodes/upsert_edges, get_graph_from_model, dedup
    search/        # SearchType enum, retriever seçimi, arama geçmişi loglama
    retrieval/     # her SearchType için bir retriever sınıfı (27 dosya)
    users/         # User, Tenant, Role, ACL, Permission — tam RBAC modeli
    ontology/      # opsiyonel ontoloji çözümleyici (resolver) + eşleme stratejileri
    memify/        # graf üzerinde ek "memify" zenginleştirme pipeline'ı (skill improvement vb.)
  infrastructure/
    engine/models/DataPoint.py  # temel veri noktası modeli (tüm graf düğümlerinin atası)
    databases/{graph,vector,relational}/  # adapter'lar (kuzu, neo4j, neptune, ladybug, turso / lancedb, pgvector / sqlalchemy)
    llm/           # LLMGateway, yapılandırılmış çıktı (instructor/BAML), retry politikası
  tasks/           # pipeline'da kullanılan somut task fonksiyonları (graph, summarization, storage, ingestion...)
cognee-mcp/src/     # FastMCP tabanlı MCP sunucusu (server.py, tool_registry.py)
cognee-frontend/    # görselleştirme arayüzü (incelenmedi, kapsam dışı)
```

## Bellek modeli
Üç depo modeli doğrulanmış: **relational** (SQLAlchemy, `Data`/`Dataset`/`PipelineRun` metadata, `cognee/infrastructure/databases/relational/`), **vector** (embedding index, `cognee/infrastructure/databases/vector/{lancedb,pgvector,turso}`), **graph** (düğüm/kenar, `cognee/infrastructure/databases/graph/{kuzu,neo4j_driver,neptune_driver,ladybug,turso,postgres_demo}`). Senkronizasyon `get_unified_engine()` (`cognee/tasks/storage/add_data_points.py:112-116`) üzerinden tek bir yazma noktasında yapılır: `add_data_points` aynı çağrıda hem `graph_engine` hem `vector_engine`'e yazar (`use_hybrid = unified.has_capability(EngineCapability.HYBRID_WRITE)`); `graph_only=True` ile sadece graf yazımı da mümkün.

`DataPoint` modeli (`cognee/infrastructure/engine/models/DataPoint.py:28-79`) her düğümün atasıdır: `id` varsayılan olarak rastgele `uuid4`, ancak alt sınıf `metadata["identity_fields"]` tanımlarsa `id_for()` ile **deterministik** (`uuid5(NAMESPACE_OID, "ClassName:degerler")`) id üretilir (satır 156-176) — bu, tekrar çalıştırmalarda aynı varlığın aynı id'ye düşmesini (idempotency/merge) sağlar. Ayrıca `ontology_uri`, `valid_to` (bi-temporal geçerlilik), `source_pipeline`/`source_task`/`source_user`/`source_content_hash` (provenance) alanları var (satır 60-75). `Entity`, `EntityType`, `Event`, `Triplet` gibi somut modeller `cognee/modules/engine/models/` altında.

`memify` (`cognee/modules/memify/memify.py`, `cognee/tasks/memify/`) ayrı bir zenginleştirme katmanı: mevcut grafiği ikinci geçişte işleyip (örn. skill improvement, global context index) üstüne ek DataPoint'ler ekliyor — incelenen dosyalarda cognify'dan sonra çalışan opsiyonel bir "bellek üstü bellek" katmanı olarak görünüyor; detaylı iç akışı derinlemesine incelenmedi.

## Bağlam yönetimi
`search()` (`cognee/api/v1/search/search.py:40-72`) `List[SearchResult]` döndürür; boyut `top_k` (varsayılan 15) ve retriever'a özgü `wide_search_top_k` (varsayılan 100, `completion_retriever.py:100`) ile sınırlanıyor — bu bir **sonuç sayısı sınırı**, token bütçesi değil. `cognee/modules/graph/utils/resolve_edges_to_text.py:61-97` alınan kenarları tek bir metin bloğuna birleştirir; dosyada token/karakter kırpma **yok** (yalnızca `agentic_retriever.py:511`'de araç çıktıları `MAX_TOOL_OUTPUT_CHARS` ile kırpılıyor — `"...[truncated]"`). Yani bağlam çok büyürse (çok sayıda kenar/chunk) sistemin kendisi kırpmıyor; boyut kontrolü çağıranın `top_k` seçimine bırakılmış — doğrulanan bir token-bütçesi mekanizması yok.

Farklı `SearchType` değerleri `cognee/modules/search/types/SearchType.py:4-24` içinde tanımlı (21 tip): `SUMMARIES`, `CHUNKS`, `CHUNKS_LEXICAL`, `RAG_COMPLETION`, `HYBRID_COMPLETION`, `GRAPH_COMPLETION` (+ `_DECOMPOSITION`, `_COT`, `_CONTEXT_EXTENSION`, `_SUMMARY_COMPLETION`), `TRIPLET_COMPLETION`, `CYPHER`, `NATURAL_LANGUAGE`, `TEMPORAL`, `CODING_RULES`, `AGENTIC_COMPLETION`, `CODE`, `GRAPH_REPORT`, `SKILLS`, `FEELING_LUCKY`. Her biri `cognee/modules/retrieval/` altında ayrı bir retriever sınıfında somutlaşıyor (ör. `graph_completion_retriever.py`, `summaries_retriever.py`, `chunks_retriever.py`, `code_retriever.py`); `get_search_type_retriever_instance.py` çalışma zamanında tipe göre örnek seçiyor.

## Bellek yazma yetkisi ve güvenlik
**(A) Yazma yetkisi:** Şema önceden tanımlı — `extract_content_graph()` (`cognee/infrastructure/llm/extraction/knowledge_graph/extract_content_graph.py:15-44`) LLM'i her zaman bir pydantic `response_model`e (varsayılan `KnowledgeGraph`, veya `cognify(graph_model=...)` ile özel model) kilitli **yapılandırılmış çıktı** (`LLMGateway.acreate_structured_output`, instructor/BAML tabanlı) üretmeye zorluyor; LLM içerik (entity/ilişki) üretir ama şemayı belirlemez. Ontoloji isteğe bağlı bir `ontology_resolver` ile devreye giriyor (`cognee/modules/ontology/construct_data_points_and_edges_with_ontology.py`); resolver yoksa "pure construction path" kullanılıyor (`cognee/modules/pipelines/layers/check_pipeline_run_qualification.py` içindeki `integrate_chunk_graphs` docstring'i, satır 98-112).
Yazma her zaman pipeline task'ları üzerinden yapılıyor (`add_data_points`, `cognee/tasks/storage/add_data_points.py:67-`); ara doğrulama pydantic model validation (`DataPoint` alt sınıf constraint'leri) + `InvalidDataPointsInAddDataPointsError` tip kontrolü (satır 90-95) ile sağlanıyor.
**Kesinti/idempotency:** `add_data_points` düğüm/kenarları `upsert_nodes`/`upsert_edges` (`cognee/modules/graph/methods/upsert_edges.py:19`, `upsert_nodes.py:19`) ile **upsert** ediyor; `DataPoint.id_for()` deterministik id sayesinde aynı varlık tekrar işlense bile çakışıp güncelleniyor (kopya oluşmuyor) — kısmi yazmalar kalıcı ama zararsız. Pipeline seviyesinde durum makinesi `PipelineRunStatus` (`DATASET_PROCESSING_STARTED/COMPLETED/ERRORED`, `cognee/modules/pipelines/layers/check_pipeline_run_qualification.py:39-53`) tutuluyor: normal bir exception `log_pipeline_run_error` ile `DATASET_PROCESSING_ERRORED`e düşüyor (`cognee/modules/pipelines/operations/log_pipeline_run_error.py:27-` ). Ancak **sert kesintide (process kill)** durum `DATASET_PROCESSING_STARTED`da asılı kalabilir — bunu temizlemek için elle `reset_dataset_pipeline_run_status()` / `reset_pipeline_run_status()` çağrılması gerekiyor (`cognee/modules/pipelines/layers/reset_dataset_pipeline_run_status.py:19-25`); otomatik heartbeat/timeout temizliği koduna rastlanmadı → checkpoint mekanizması **kısmen** var (durum kaydı + idempotent upsert var, otomatik kurtarma yok).

**(B) PII/erişim denetimi:** `grep -ri "permission|acl|pii|redact|anonymi|encrypt|retention|tenant"` çalıştırıldı ve doğrulandı. Tam bir RBAC modeli mevcut: `User`, `Tenant`, `Role`, `ACL`, `Permission`, `UserTenant` (`cognee/modules/users/models/`), izin tipleri `PERMISSION_TYPES = ["read","write","delete","share"]` (`cognee/modules/users/permissions/permission_types.py:3`). Zorlama noktası: `search()` içinde `get_authorized_existing_datasets(datasets, "read", user)` (`cognee/api/v1/search/search.py:334`) ve `add()` içinde `resolve_authorized_user_dataset` (`cognee/api/v1/add/add.py:8-9`) — dataset erişimi her API çağrısında bu fonksiyonlarla kontrol ediliyor (`check_permission_on_dataset.py:11-27` → `get_specific_user_permission_datasets`). Bağlantı sırları (Neo4j şifreleri) Fernet ile şifreleniyor (`Neo4jCommunityDatasetDatabaseHandler.py:121,195`), hata mesajlarında secret/bearer token **redaksiyonu** var (`cognee/infrastructure/session/agent_context_extraction.py:85-88`, `cognee/modules/users/authentication/redact_websocket_query_secrets.py`).
Ancak **PII/anonimleştirme/retention** için içerik seviyesinde bir mekanizma **yok**: grep sonuçlarında "pii"/"redact"/"anonymi"/"retention" eşleşmeleri sadece secret/hata-mesajı temizliğine (credential, token) ait; kullanıcı verisindeki kişisel bilgiyi (isim, TC kimlik no vb.) graf/vektöre yazmadan önce tarayan/maskeleyen bir modül bulunamadı → **yok** olarak işaretlendi.

## RAG ve bilgi katmanı
- **Chunking:** `cognee/modules/chunking/{TextChunker,LangchainChunker,CsvChunker,JsonListChunker}.py`, `chunk_policy.py`, `incremental_chunking.py` — paragraf tabanlı (varsayılan) ve recursive-splitting seçenekleri.
- **Embedding:** `cognee/infrastructure/databases/vector/embeddings/` (config ve model seçimi `EmbeddingConfig`).
- **Ontoloji desteği:** `cognee/modules/ontology/base_ontology_resolver.py`, `matching_strategies.py`, `construct_data_points_and_edges_with_ontology.py` — opsiyonel, `ONTOLOGY_MODE` ("annotate"/"strict") ile kontrol ediliyor.
- **Graph completion:** `cognee/modules/retrieval/graph_completion_retriever.py` (+ cot/decomposition/context_extension/summary varyantları), kenarları `resolve_edges_to_text` ile düzyazıya çevirip LLM'e veriyor.
- **Retriever tipleri:** 27 dosya, `cognee/modules/retrieval/` (bkz. Bağlam yönetimi bölümü) — `bm25_retriever.py`, `lexical_retriever.py`, `triplet_retriever.py`, `code_retriever.py`, `cypher_search_retriever.py`, `temporal_retriever.py`, `skills_retriever.py` dahil.

## Ajan tasarımı
cognee kendisi bir ajan çerçevesi değil, bir **bellek/RAG kütüphanesi**dir. Ajan entegrasyonu iki yoldan: (1) `cognee-mcp/src/server.py` — FastMCP tabanlı gerçek bir MCP sunucusu (satır 1-80'de `from fastmcp import FastMCP`, `mcp = FastMCP("Cognee")`), `tool_registry.py` üzerinden araçları (cognify, search, recall, prune vb.) MCP tool sözleşmesi olarak dışa veriyor — bu, makine-okur (JSON şema tabanlı MCP tool tanımı) bir sözleşme sağlıyor. (2) `cognee/modules/retrieval/agentic_retriever.py` — `AGENTIC_COMPLETION` search tipi, LLM'e araç çağırma döngüsü sunan bir retriever (satır 511'de araç çıktı kırpma). Kapsamlı ajan orkestrasyonu (planlama, çoklu-ajan) koduna rastlanmadı; bu boşluk "incelenmedi" değil, kodda böyle bir katman **yok**.

## Hata yönetimi
Task seviyesi: `handle_task()` (`cognee/modules/pipelines/operations/run_tasks_base.py:241-257`) her task'ı try/except ile sarar, OpenTelemetry span'ine `record_exception` yazar, telemetry gönderir, sonra **hatayı yeniden fırlatır** (`raise error`, satır 257) — pipeline bu noktada durur, sessiz yutma yok. Pipeline seviyesi: `cognify()` üstünde `_wrap_cognify_exception`/`CognifyFailedError` (`cognee/api/v1/cognify/cognify.py:57-75`) hatayı tip bilgisiyle sarar; `raise_on_error=False` ile ham exception yerine `PipelineRunErrored` döndürülebiliyor (`PipelineRunInfo.py:44-54`, `error_message` PII-scrubbed). LLM çağrıları `tenacity` ile retry ediliyor: `cognee/infrastructure/llm/retry_config.py` — quota/billing hataları **retry edilmiyor** (`QuotaExceededError`, satır 188), diğer geçici hatalar `stop_after_attempt` & `stop_after_delay` ile sınırlı deneme alıyor. Kısmi başarı: `PipelineRunProgress` (`completed_items`/`total_items`/`current_stage`, `PipelineRunInfo.py:56-62`) ilerleme durumunu dışa raporluyor.

## Genişletilebilirlik
Yeni bir **graph adapter** eklemek: `GraphDBInterface` (`cognee/infrastructure/databases/graph/graph_db_interface.py:23-46`, ~13 soyut metot) uygulanır + `supported_databases.py`'a (şu an boş sözlük, adapter modülleri kendini kaydediyor) kayıt olunur + `get_graph_engine.py`'de factory'e bağlanır — pratikte 2-3 dosya (yeni adapter dosyası + registration + config). Mevcutta 6 graph adapter'ı (kuzu, neo4j, neptune, ladybug, turso, postgres_demo) ve 3 vector adapter'ı (lancedb, pgvector, turso) bunun kanıtı.
Yeni bir **pipeline task** eklemek: `cognee/tasks/<yeni_klasor>/` altına async bir fonksiyon yazıp `cognify.py`'deki `run_pipeline([...])` listesine eklemek yeterli (`Task`/`task()` sarmalayıcısı, `cognee/modules/pipelines/tasks/task.py`) — tek dosya + tek satır entegrasyon; `run_tasks_base` telemetry/provenance/hata yönetimini otomatik sağlıyor.

## Güçlü yönler (kanıtlı)
- Deterministik id (`DataPoint.id_for`, `DataPoint.py:156-176`) ile idempotent upsert — tekrar çalıştırmalar veri çoğaltmıyor.
- Gerçek, çok parçalı RBAC (Tenant/Role/ACL/Permission) ve her API girişinde zorlanan `get_authorized_existing_datasets` (`search.py:334`, `add.py:8-9`).
- 21 farklı `SearchType` ve 27 retriever dosyası — RAG'den grafik muhakemesine kadar geniş bir arama yelpazesi, hepsi tek bir `search()` giriş noktasından.
- Gözlemlenebilirlik: OpenTelemetry span'leri, provenance damgalama (`source_pipeline/source_task/source_content_hash`), `PipelineRunProgress` ile ilerleme raporlama.

## Zayıf yönler (kanıtlı)
- Bağlamda token bütçesi kontrolü yok: `resolve_edges_to_text.py` sınırsız birleştiriyor, sınır yalnızca `top_k`/`wide_search_top_k` sonuç sayısıyla (dolaylı) sağlanıyor — büyük graf komşuluklarında LLM context limitini aşma riski koddan görülüyor.
- Sert process crash'inde pipeline durumu `DATASET_PROCESSING_STARTED`da asılı kalabiliyor; otomatik heartbeat/timeout temizliği yok, elle `reset_dataset_pipeline_run_status()` gerekiyor.
- İçerik seviyesinde PII tarama/maskeleme/retention politikası yok — sadece secret/credential redaksiyonu var; kullanıcı verisi olduğu gibi grafiğe/vektöre yazılıyor.

## Puan (1-5)
- olgunluk: 4 — geniş test seti (683 test dosyası), aktif geliştirme, migration altyapısı (alembic) mevcut; ama bazı modüller (memify iç akışı) yeterince belgeli değil.
- mimari netlik: 4 — ECL akışı, Task/BoundTask soyutlaması ve modül ayrımı net; bazı isimlendirmeler (memify vs cognify) örtüşüyor.
- genişletilebilirlik: 4 — adapter arayüzleri (`GraphDBInterface`) ve task sarmalayıcı (`task()`) az dosyayla genişlemeyi destekliyor.
- güvenilirlik ilkelleri: 3 — idempotent upsert ve durum makinesi var, ama sert kesintiden otomatik kurtarma yok (elle reset gerekiyor).
- gözlemlenebilirlik: 4 — OpenTelemetry span, provenance damgalama, ilerleme raporlama kodda doğrulandı.
- güvenlik duruşu: 3 — RBAC ve secret şifreleme/redaksiyon güçlü, ama içerik PII kontrolü yok.

## Alınacak fikir
- Deterministik `id_for(*identity_fields)` deseni — bizim bellek katmanımızda varlık birleştirme/idempotency için doğrudan uygulanabilir; aynı varlık farklı kaynaklardan geldiğinde çoğalmayı önler.
- API çağrısı başına zorunlu `get_authorized_existing_datasets(dataset, permission, user)` deseni — her okuma/yazma noktasında izin kontrolünü merkezi bir fonksiyona bağlamak, bizde "hangi ajan hangi dataset'i görebilir" sorusunu çözer.
- `PipelineRunProgress`/`PipelineRunErrored` gibi tipli, PII-scrub'lı durum nesneleri — hata/ilerleme raporlamasını ham exception yerine yapılandırılmış obje olarak taşımak.

## Alınmayacak
- Sınırsız bağlam birleştirme (`resolve_edges_to_text`) — token bütçesi olmadan graf kenarlarını tek string'e yığmak; bizde context window taşmasına yol açar, token-farkında bir kırpma katmanı olmadan almamalıyız.
- Otomatik heartbeat'siz "STARTED" durum kilidi — sert kesintide elle reset gerektiren tasarım; bizde kilitlenme riski yaratır, TTL/heartbeat'li bir versiyon gerekir.

## Matris cevapları
- saglayici_bagimsiz: evet — `litellm` üzerinden çoklu LLM sağlayıcı soyutlaması (`pyproject.toml` satır ~37 `litellm>=1.83.7`), graph/vector/relational için de çoklu adapter (`supported_databases.py`, 6 graph + 3 vector adapter).
- sozlesme_var: evet — MCP sunucusu (`cognee-mcp/src/server.py`, FastMCP tool tanımları) makine-okur JSON şema sözleşmesi sağlıyor; ayrıca `DataPoint`/`SearchType`/`PipelineRunInfo` pydantic modelleri iç sözleşme.
- insan_kapisi: hayır — kodda onay bekleyen bir insan-in-the-loop kapısı bulunamadı; `cognify`/`add` doğrudan otomatik yazıyor, LLM çıktısı şema doğrulamasından geçtiği an kalıcılaşıyor.
- checkpoint: kısmen — `PipelineRunStatus` durumu ve idempotent `upsert_nodes/upsert_edges` var (kanıt: `check_pipeline_run_qualification.py:39-53`, `upsert_nodes.py:19`), ama sert kesintiden otomatik kurtarma/heartbeat yok (kanıt: `reset_dataset_pipeline_run_status.py:19-25` elle çağrılıyor).
