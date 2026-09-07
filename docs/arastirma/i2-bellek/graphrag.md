# GraphRAG (Microsoft)

## Kimlik
microsoft/graphrag · 35.862 yıldız · 207 watcher · son push 2026-09-07 · MIT · Python · haftalık indirme: doğrulanmadı.
Sürüm: `pyproject.toml` monorepo kökü `0.0.0` (private), asıl paket `packages/graphrag/pyproject.toml:4` → `version = "3.1.2"`.
Canlılık: geçti (aktif geliştirme, monorepo yapıya (packages/*) geçmiş, çoklu paket: graphrag-cache, graphrag-storage, graphrag-llm, graphrag-chunking, graphrag-vectors, graphrag-input, graphrag-common).

## Çözdüğü problem
Düz vektör RAG'ın kaçırdığı "bütünsel/global" soruları (örn. "bu belge kümesinin ana temaları nedir") cevaplamak için metinden bilgi grafiği (entity/relationship) çıkarıp, topluluk (community) hiyerarşisi kurup, bu grafı hem yerel (local) hem küresel (global) sorgu yollarıyla LLM bağlamına dönüştürüyor.

## Mimari
İki ayrı akış: index pipeline (yazma) ve query (okuma).

```
INDEX: CLI/API (cli/index.py) -> PipelineFactory.create_pipeline() (index/workflows/factory.py)
  -> run_pipeline() (index/run/run_pipeline.py) -> Pipeline.run() sırayla workflow fonksiyonları
  her workflow: DataReader ile önceki parquet tabloyu okur -> LLM/graf işlemi -> output_table_provider.write_dataframe()

QUERY: api/query.py -> factory.py (context builder + search sınıfı kurar)
  -> LocalSearch / GlobalSearch / DRIFTSearch / BasicSearch (query/structured_search/*)
  -> context_builder.build_context() (context_builder/*, structured_search/*/*_context.py)
  -> model.completion_async() (graphrag-llm)
```
Bileşen-dosya eşlemesi: pipeline seçimi `index/workflows/factory.py`; pipeline yürütücü `index/run/run_pipeline.py`; workflow imzası `index/typing/workflow.py`; depolama soyutlaması `packages/graphrag-storage`; LLM çağrı zinciri (cache/retry/rate-limit) `packages/graphrag-llm/graphrag_llm/middleware/*`.

## Klasör yapısı
```
packages/
  graphrag/graphrag/
    index/            # indexleme: workflows/, operations/, run/, update/, typing/
    query/            # sorgu: context_builder/, structured_search/{local,global,drift,basic}_search/
    data_model/       # Document/TextUnit/Entity/Relationship/Community/CommunityReport/Covariate
    config/           # pydantic config modelleri (config/models/*)
    cache/, callbacks/, cli/, api/, tokenizer/, prompts/
  graphrag-cache/      # Cache soyutlaması (json/memory/noop)
  graphrag-storage/    # Storage + TableProvider (parquet/csv/cosmos)
  graphrag-llm/        # completion/embedding + middleware (cache, retry, rate-limit, metrics)
  graphrag-chunking/   # metin parçalama (token/sentence chunker)
  graphrag-vectors/    # vector store factory
tests/{unit,verbs,integration,smoke,notebook}
```

## Bilgi/bellek modeli
Veri modeli sınıfları `packages/graphrag/graphrag/data_model/`: `entity.py` (69 satır), `relationship.py` (65), `community.py` (79), `community_report.py` (67), `text_unit.py` (62), `document.py` (49), `covariate.py` (54) — her biri ayrı dataclass/pydantic model, alanları tek tek okunmadı (satır sayıları doğrulandı, içerik detayı incelenmedi).
Depolama: her workflow ara/final tabloyu `TableProvider.write_dataframe(table_name, df)` ile yazıyor; varsayılan tip Parquet — `packages/graphrag-storage/graphrag_storage/tables/parquet_table_provider.py:82` (`await self._storage.set(f"{table_name}.parquet", df.to_parquet())`). CSV ve Cosmos DB için de provider var (`csv_table_provider.py`, `cosmos_table_provider.py`), seçim `table_provider_config.py:18` üzerinden ("parquet", "csv", "cosmosdb").
Storage soyutlaması `Storage` arayüzü + `create_storage()` (`graphrag-storage`), dosya/blob/cosmos backend'lerini tek API arkasında saklıyor.

## Bağlam yönetimi
Bütçe her yerde aynı desen: `max_context_tokens` parametresi + `tokenizer.num_tokens()` ile greedy paketleme, sınır aşılınca **o parçayı hiç eklemeden döngüden çık** (kırpma = "kalanı at", cümle-seviyeli kırpma değil, batch/kayıt-seviyeli dışlama).

- Tokenizer: `packages/graphrag/graphrag/tokenizer/get_tokenizer.py` — model config verilmezse tiktoken (`encoding_model` varsayılanı `o200k_base`, bkz. `config/defaults.py:39`), model config verilmişse LiteLLM tabanlı per-model tokenizer.
- Local search bağlamı: `query/context_builder/local_context.py` üç ayrı fonksiyon (satır 32, 96, 161 civarı), her biri `max_context_tokens: int = 8000` varsayılanıyla `current_tokens + new_tokens > max_context_tokens` kontrolüyle kaydı ekleyip eklememeye karar veriyor (satır 76-81, 141-146, 215-220).
- Local search karışık bağlam kurucu `query/structured_search/local_search/mixed_context.py:91` (`build_context`, `max_context_tokens: int = 8000`) toplam bütçeyi community/local-entity/text-unit oranlarına bölüyor (satır 175, 192, 208: `community_prop`, `local_prop`, `text_unit_prop` çarpanlarıyla alt bütçeler), sonra her alt bölüm kendi alt bütçesi içinde paketleniyor; satır 448'de `if total_tokens > max_context_tokens: break`.
- **Global search map-reduce (en kritik cevap):** `query/structured_search/global_search/community_context.py` — `build_context()` (satır 57) community report'ları `max_context_tokens=8000` (varsayılan, `config/defaults.py:201`'de global için `data_max_tokens: int = 12_000`) sınırına göre **birden çok batch'e (context_chunks)** bölüyor. `query/structured_search/global_search/search.py`: Adım 1 (Map) — her batch için ayrı LLM çağrısı `_map_response_single_batch()` (satır ~220), `asyncio.Semaphore(concurrent_coroutines=32)` ile paralel, her batch kendi `MAP_SYSTEM_PROMPT` ile "puanlı key point" listesi (JSON, `{"answer":..., "score":...}`) üretiyor. Adım 2 (Reduce) — `_reduce_response()` (satır ~300): tüm batch'lerin key point'leri tek listede toplanır, `score == 0` olanlar elenir, kalanlar **skora göre azalan sırada sıralanır**, sonra `max_data_tokens` (varsayılan 8000) bütçesine göre greedy eklenir; **bütçe dolduğu anda `break` ile geri kalan (düşük skorlu) noktalar tamamen atılır** — kırpma stratejisi budur. Tüm skorlar 0 ise ve `allow_general_knowledge=False` ise kanıtsız "veri yok" cevabı dönüyor (`NO_DATA_ANSWER`).
- DRIFT search (`structured_search/drift_search/`): `search.py:71` `init_local_search()` DRIFT'in kendi context'ini `LocalSearch`'e devrediyor (`max_context_tokens`: `self.context_builder.config.local_search_max_data_tokens`, satır 89); `primer.py` sorguyu alt-sorulara ayrıştırıp (`decompose_query`) community report'ları `split_reports()` ile parçalara bölerek primer LLM'e veriyor (`primer_llm_max_tokens: int = 12_000`, `config/defaults.py:101`); yani DRIFT = primer (global benzeri) + iteratif local search follow-up döngüsü.
- Config varsayılanları: `config/defaults.py:94` `data_max_tokens = 12_000` (global), `:124` `batch_max_tokens = 8191` (embedding batch), `:201` `data_max_tokens = 12_000` (drift). Somut sınıf alanları `config/models/local_search_config.py:46` ve `global_search_config.py:30` (`max_context_tokens` Field).

## Bilgi yazma yetkisi ve güvenlik
**A — yazma süreci:** Pipeline sıralı workflow listesi, `IndexingMethod` başına sabit dizi (`index/workflows/factory.py` satır ~53-90): Standard = `create_base_text_units, create_final_documents, extract_graph, finalize_graph, extract_covariates, create_communities, create_final_text_units, create_community_reports, generate_text_embeddings`; Fast varyantı NLP tabanlı extraction kullanıyor. Her workflow `WorkflowFunction` imzasıyla (`index/typing/workflow.py`) `(config, context) -> WorkflowFunctionOutput` döner; `result.stop=True` ise pipeline sonraki adıma geçmeden durur (`index/run/run_pipeline.py` içinde `if result.stop: break`). Hata durumunda (`run_pipeline.py`, `except Exception as e:` bloğu) pipeline **tamamen durur**, `PipelineRunResult(error=e)` yayınlanır; kod içinde otomatik "kaldığı yerden devam et" (workflow-seviyeli checkpoint/resume CLI bayrağı) **bulunamadı** — `cli/main.py` içinde sadece `--skip-validation` var, resume/skip-workflow bayrağı yok. Ancak pratik checkpoint LLM seviyesinde var: `packages/graphrag-llm/graphrag_llm/middleware/with_cache.py` her completion/embedding çağrısını `cache.get(cache_key)` ile önbellekten okuyor, yoksa çağırıp `cache.set()` ile yazıyor (`cache_key_creator` = girdi argümanlarının hash'i, `graphrag-cache/graphrag_cache/cache_key.py`). Cache backend'leri `graphrag-cache/graphrag_cache/{json_cache,memory_cache,noop_cache}.py`. Sonuç: workflow yeniden çalıştırılırsa aynı girdi için LLM tekrar çağrılmaz (maliyet korunur) ama workflow'un kendisi baştan işler — gerçek "workflow checkpoint" değil, "LLM çağrısı checkpoint"i.
**Artımlı güncelleme (incremental):** gerçek ve ayrı bir pipeline seti olarak var — `IndexingMethod.StandardUpdate` / `FastUpdate` (`factory.py` satır ~92-98): `load_update_documents` + standart workflow'lar + `update_*` workflow'ları (`update_entities_relationships.py`, `update_text_units.py`, `update_covariates.py`, `update_communities.py`, `update_community_reports.py`, `update_text_embeddings.py`, `update_clean_state.py`). Mekanizma `index/run/run_pipeline.py` `is_update_run=True` dalında: önceki çıktı `previous_table_provider`'a kopyalanır (`_copy_previous_output`), yeni belgeler zaman damgalı `delta_storage`'a izole indexlenir, sonra `update_entities_relationships.py` içindeki `_group_and_resolve_entities` / `_update_and_merge_relationships` (`index/update/entities.py`, `index/update/relationships.py`) eski+yeni grafı birleştirir (entity id eşlemesi ile). Yani gerçek bir merge, sıfırdan yeniden indexleme değil.
**C — PII/erişim denetimi:** `grep -rni "pii|redact|anonymi|encrypt|retention|acl|permission"` sonucunda **veri düzeyinde hiçbir PII maskeleme/anonimleştirme/şifreleme/saklama-süresi/ACL mekanizması bulunamadı.** Tek eşleşme `utils/cli.py:27-53` fonksiyonu `redact()` — bu sadece **config log çıktısında** `api_key`, `connection_string`, `container_name`, `organization` alanlarını maskeliyor (`cli/index.py:115`, `api/query.py:293`), yani sır sızıntısını önlüyor, belge/entity içeriğindeki PII'yi değil. **Yorum:** kurumsal bir bilgi grafiğinde (entity/relationship/community report tabloları düz parquet/CSV olarak diske yazılıyor) satır bazlı erişim denetimi, veri sınıflandırması veya PII redaksiyonu yok — bu, hassas kurumsal metinlerle kullanılacaksa ciddi bir boşluk; storage/table_provider katmanı Cosmos DB gibi backend'lere bağlanabiliyor ama bu sadece depolama hedefi, kendi başına erişim kontrolü sağlamıyor.

## RAG ve bilgi katmanı
- Chunking: ayrı paket `packages/graphrag-chunking/graphrag_chunking/` — `token_chunker.py`, `sentence_chunker.py`, `chunker_factory.py`, strateji seçimi `chunk_strategy_type.py`; index'te kullanımı `index/workflows/create_base_text_units.py` (incelenmedi, dosya var olduğu doğrulandı).
- Entity/relationship extraction: `index/operations/extract_graph/extract_graph.py`, workflow `index/workflows/extract_graph.py` (satır 1-50 okundu) — `DataReader` ile text_unit okuyup `create_completion()` ile LLM extraction modeli kuruyor, `context.cache.child(...)` ile cache alt-alanı ayırıyor; ardından `summarize_descriptions.py` ile açıklamalar özetleniyor.
- Claim/covariate: `index/workflows/extract_covariates.py`, artımlı sürümü `update_covariates.py`.
- Community detection: `index/operations/cluster_graph.py:11-27` — `from graphrag.graphs.hierarchical_leiden import hierarchical_leiden`, `_compute_leiden_communities()` (satır 51-86) gerçek Leiden algoritmasını çağırıyor (`stable_lcc` ile önce en büyük bağlı bileşen stabilize ediliyor).
- Community report üretimi: `index/workflows/create_community_reports.py` (LLM tabanlı) ve `create_community_reports_text.py` (Fast/NLP modu, muhtemelen şablon tabanlı — içerik detaylı incelenmedi).
- Embedding: `index/workflows/generate_text_embeddings.py`, artımlısı `update_text_embeddings.py`; embedding modeli `graphrag-llm/graphrag_llm/embedding/*`; vektör depolama `graphrag-vectors/graphrag_vectors/vector_store_factory.py` (registry deseni — bkz. Genişletilebilirlik).

## Ajan tasarımı
GraphRAG bir ajan çerçevesi değil; kütüphane + CLI + API (`api/query.py`, `api/index... ` benzeri) sağlıyor. Bir ajan bunu şu şekillerde entegre edebilir: (1) CLI çağrısı (`graphrag index`, `graphrag query`) alt-süreç olarak, (2) Python API doğrudan import (`graphrag.api.query`), sonuçlar `SearchResult`/`GlobalSearchResult` dataclass'ları (`query/structured_search/base.py`, `global_search/search.py:47-53`) — bunlar makine-okur JSON'a çevrilebilir sözleşmeler (response, context_data, llm_calls, prompt_tokens, output_tokens alanları net tipli). Resmi bir "ajan protokolü" (MCP sunucusu, function-calling şeması) bu depoda görülmedi (aranmadı ayrıca doğrulanmadı — sadece query/index modülleri incelendi).

## Hata yönetimi
- Retry: `graphrag-llm/graphrag_llm/middleware/with_retries.py` + `retry/{exponential_retry,immediate_retry}.py`, config `retry_config.py` (`type`: exponential_backoff/immediate, `max_retries`, `base_delay`, `jitter`, `max_delay` — hepsi opsiyonel, validasyonlu).
- Rate limiting: `middleware/with_rate_limiting.py` + `rate_limit/sliding_window_rate_limiter.py`, config `rate_limit_config.py` (`period_in_seconds`, `requests_per_period`, `tokens_per_period` — sliding window).
- Cache: yukarıda anlatıldığı gibi `with_cache.py`, hem sync hem async, streaming/mock response cache'lenmiyor (satır ~59-63, ~120-124 `if is_streaming or is_mocked`).
- Pipeline hatası: `index/run/run_pipeline.py` `except Exception as e: logger.exception(...); yield PipelineRunResult(error=e)` — hata durdurma noktasını (`last_workflow`) kaydediyor ama otomatik kurtarma yok.
- Callbacks/logging: `callbacks/workflow_callbacks.py`, `console_workflow_callbacks.py`, `blob_workflow_logger.py` — workflow start/end event'leri, `WorkflowProfiler` (`index/run/profiling.py`) her workflow'un süre/metrik istatistiğini `context.stats.workflows[name]`'e yazıp `stats.json`'a dump ediyor (`_dump_stats_json`, `run_pipeline.py`).
- Global search map adımında tekil batch hatası: `_map_response_single_batch` içinde `except Exception: return SearchResult(response=[{"answer": "", "score": 0}], ...)` — bir batch patlarsa reduce adımı yine de devam eder (o batch'in katkısı sıfırlanır).

## Genişletilebilirlik
Registry deseni açıkça var: `PipelineFactory.register()` / `register_all()` / `register_pipeline()` (`index/workflows/factory.py` satır 26-45) — yeni workflow eklemek için fonksiyonu register edip `config.workflows` listesine adını eklemek yeterli, factory dosyasını değiştirmeye gerek yok. Benzer factory desenleri: `graphrag-storage/tables/table_provider_factory.py` (yeni storage tipi), `graphrag-vectors/vector_store_factory.py` (yeni vector store), `graphrag-llm/completion/completion_factory.py` + `embedding_factory.py` (yeni model sağlayıcı, LiteLLM üzerinden zaten çoğu sağlayıcıyı kapsıyor), `graphrag-cache/cache_factory.py` (yeni cache backend), `graphrag-llm/retry_factory.py` / `rate_limit_factory.py`. Yeni bir workflow eklemek tipik olarak 2 dosya: yeni workflow fonksiyonu + `factory.py`'de bir `register()`/`register_pipeline()` çağrısı (mevcut pipeline listelerini de güncellemek gerekebilir).

## Güçlü yönler (kanıtlı)
- Net factory/registry deseni her katmanda tekrarlanıyor (workflow, storage, cache, LLM, vector store) — `index/workflows/factory.py`, `table_provider_factory.py`, `vector_store_factory.py`.
- LLM çağrı zinciri (cache → retry → rate-limit → metrics) middleware olarak ayrıştırılmış, `with_middleware_pipeline.py` ile kompozit edilebiliyor.
- Gerçek, çalışan bir incremental update mekanizması var (workflow seviyesinde ayrı pipeline + entity/relationship merge kodu, `index/update/entities.py`, `index/update/relationships.py`), sadece kavramsal değil.
- Global search'ün map-reduce'u skor bazlı filtreleme ile hem maliyeti hem alaka düzeyini kontrol ediyor (`_reduce_response`, `global_search/search.py`).

## Zayıf yönler (kanıtlı)
- Context bütçesi dolduğunda kırpma stratejisi kaba: azalan skora göre greedy paketleme + `break` — sınırın hemen altındaki yüksek skorlu bir nokta girer, bütçeyi az aşan sıradaki nokta (belki aynı skorda) tamamen atılır, kısmi/özetlenmiş dahil etme yok (`global_search/search.py`, `_reduce_response`).
- Pipeline hatasında workflow-seviyeli resume/skip CLI desteği yok; tek güvence LLM-cache'in tekrar çağrıyı önlemesi — workflow'un kendi mantığı (örn. dataframe işleme) yine de baştan çalışır.
- PII/ACL/retention hiç yok (bkz. C bölümü) — kurumsal kullanım için harici bir veri yönetişim katmanı şart.
- Fast/NLP indexleme yolu (`extract_graph_nlp.py`, `create_community_reports_text.py`) içerik olarak incelenmedi; LLM'siz mi tamamen yoksa kısmi mi belirsiz — doğrulanmadı.

## Puan (1–5)
- olgunluk: 4 — 3.1.2 sürüm, monorepo'ya ayrışmış paketler, aktif commit (son push bugün); ama 0.x/1.x döneminden beri API kırılımları yaşamış bir proje (doğrulanmadı, kod içinde görülmedi, dışarıdan bilinen bilgi).
- mimari netlik: 4 — workflow/context_builder/data_model ayrımı temiz, factory deseni tutarlı; ama bazı dosyalar (mixed_context.py, global search community_context.py) çok parametreli ve satır içi oran hesapları (`community_prop` vb.) okunması zor.
- genişletilebilirlik: 5 — her katmanda (workflow, storage, cache, LLM, vector store) registry/factory var, kanıtlı.
- güvenilirlik ilkelleri: 3 — retry+rate-limit+cache var ama pipeline-seviyeli checkpoint/resume yok, hata durumunda elle yeniden başlatma gerekiyor.
- gözlemlenebilirlik: 4 — `stats.json`, `context.json`, `WorkflowProfiler`, callback event'leri (`workflow_start/end`) somut ve dosyaya yazılıyor.
- güvenlik duruşu: 2 — sadece config sırlarını redakte ediyor (API key vb.); veri içeriği (PII, erişim denetimi) için hiçbir mekanizma yok.

## Alınacak fikir
- Context bütçesi = tokenizer + `max_context_tokens` + greedy-paketle-dur deseni: basit, test edilebilir, her context builder'da tekrarlanan tek satırlık kural (`current_tokens + new_tokens > max_context_tokens: break`) — bizim bellek/bağlam katmanımızda da aynı basit birincil desen olabilir, karmaşık token-bütçeleme algoritmasına gerek yok.
- LLM cache = `hash(input_args)` anahtarlı get/set sarmalayıcı (`with_cache.py`) — pahalı LLM çağrılarını tekrar denemelerde/yeniden çalıştırmalarda bedavaya çıkarıyor; bizim otomasyon/pipeline görevlerimizde (headless run'larda hata sonrası yeniden deneme) doğrudan uygulanabilir bir desen.
- Registry/factory ile "yeni workflow = yeni fonksiyon + bir register() satırı" deseni; bizim görev kuyruğu/otomasyon sistemimizde adım eklemeyi merkezi dosyayı değiştirmeden yapmaya örnek olabilir.
- Global search'ün map-reduce + skor filtreleme yaklaşımı: çok sayıda küçük belge/not özetini tek soruya cevap üretmek için (bizim "bellek" havuzumuzdaki günlük raporlar/loglar gibi) uygulanabilir bir örüntü.

## Alınmayacak
- Tüm mimariyi (5 ayrı pip paketi: cache/storage/llm/chunking/vectors) aynen kopyalamak — bizim ölçeğimizde aşırı; maliyet boyutu: standart bir indexleme, belge başına en az extract_graph (1+ LLM çağrısı/text_unit) + summarize_descriptions + community_report üretimi (topluluk başına 1 LLM çağrısı) demek — orta boy bir korpus için onlarca-yüzlerce LLM çağrısı; bizim ölçeğimizde bu maliyeti karşılayacak kadar büyük bir "bilgi grafiği" ihtiyacımız yok.
- Leiden tabanlı hiyerarşik community detection + community report LLM üretimi — güçlü ama pahalı (her topluluk için ayrı LLM çağrısı) ve bizim kullanım senaryomuzda (kişisel/ajans ölçeğinde bellek) gerekli karmaşıklığı karşılamıyor; basit tag/klasör tabanlı gruplama yeterli.

## Matris cevapları
- saglayici_bagimsiz: evet — `graphrag-llm` LiteLLM üzerinden çalışıyor (`lite_llm_completion.py`, `lite_llm_embedding.py`), model sağlayıcı `model_provider/model` string'i ile seçiliyor (`get_tokenizer.py` satır ~35: `f"{model_config.model_provider}/{model_config.model}"`).
- sozlesme_var: kısmen — `SearchResult`/`GlobalSearchResult` dataclass'ları net tipli makine-okur çıktı (`global_search/search.py:47-53`) ama resmi bir ajan/tool-calling şeması (MCP, JSON-schema sözleşmesi) bu incelemede görülmedi.
- insan_kapisi: hayır — pipeline tamamen otomatik çalışıyor, indexleme veya query akışında onay/insan-kapısı adımı koda rastlanmadı (aranmadı derinlemesine, sadece run_pipeline.py ve query search sınıfları incelendi).
- checkpoint: kısmen — workflow-seviyeli resume yok (`run_pipeline.py` hata anında durur), ama LLM-çağrı seviyesinde cache (`with_cache.py`) fiilen bir checkpoint görevi görüyor; ayrıca incremental update ayrı bir "delta + merge" mekanizmasıyla var (`index/run/run_pipeline.py` `is_update_run` dalı, `index/update/entities.py`).
