# Graphiti

## Kimlik
getzep/graphiti · 30.648 yıldız · 174 watcher · son push 2026-09-06 · Apache-2.0 · Python · haftalık indirme: doğrulanmadı (PyPI kontrol edilmedi)
Sürüm (kodda doğrulandı): `pyproject.toml:4` → `version = "0.30.1"`.
canlılık: geçti (son push 2026-09-06, aktif geliştirme; `mcp_server/`, `server/` alt projeleri ayrı `pyproject.toml`/`uv.lock` ile canlı tutuluyor).

## Çözdüğü problem
LLM ajanlarına, sohbet geçmişinin ötesinde, zamana duyarlı ve güncellenebilir bir "bilgi grafiği" belleği sağlamak. Klasik RAG'ın statik doküman parçalarının aksine Graphiti; olay (episode) akışından varlık (entity) ve ilişki (edge/fact) çıkarır, çelişen bilgiyi zaman damgalarıyla geçersiz kılar, hibrit arama (semantic+BM25+graph traversal) ile ajana bağlam döndürür.

## Mimari
İki ana veri yolu var: yazma (`add_episode`) ve okuma (`search`).

`add_episode()` yolu (`graphiti_core/graphiti.py:980`):
1. `EpisodicNode` oluşturulup kaydedilir (`graphiti_core/nodes.py:318-359`).
2. `extract_nodes` (varlık çıkarımı, LLM) → `graphiti_core/utils/maintenance/node_operations.py`.
3. Varlık dedup/resolve → aynı dosyada `resolve_extracted_nodes` benzeri akış; `dedup_helpers.py` ile hızlı-yol (exact/fuzzy) eşleştirme.
4. `extract_edges()` (ilişki/fact çıkarımı, LLM) → `graphiti_core/utils/maintenance/edge_operations.py:117`.
5. `resolve_extracted_edges()` → her yeni edge için hem "duplicate" hem "invalidation candidate" araması (`edge_operations.py:325-535`), LLM ile çelişki tespiti (`resolve_extracted_edge`, satır 623), kod tarafında zaman kuralıyla geçersiz kılma (`resolve_edge_contradictions`, satır 538).
6. Episodik kenarlar (`EpisodicEdge`, MENTIONS) ve embedding'ler kaydedilir; tüm graph yazımları `GraphDriver.execute_query`/`graph_operations_interface` üzerinden gerçek DB'ye gider (Neo4j/FalkorDB/Kuzu/Neptune).

`search()` yolu (`graphiti_core/search/search.py`, `graphiti_core/graphiti.py:1527` ve `1603`):
1. `SearchConfig` (edge/node/episode/community alt-config'leri) ile hangi yöntemlerin (bm25, cosine, bfs) çalışacağı belirlenir (`search_config.py`).
2. `search_utils.py` içindeki fonksiyonlar Cypher/openCypher sorgularını group_id filtresiyle (varsa) çalıştırır.
3. Sonuçlar reranker ile birleştirilir (RRF/MMR/node_distance/episode_mentions/cross_encoder) → `SearchResults` (edges/nodes/episodes/communities).
4. `Graphiti.search()` sade sürüm sadece `list[EntityEdge]` döner; `search_()` (eski `_search`) tam `SearchResults` döner.

## Klasör yapısı
```
graphiti_core/
  nodes.py            # Node/EpisodicNode/EntityNode/CommunityNode/SagaNode modelleri + CRUD
  edges.py            # Edge/EpisodicEdge/EntityEdge/CommunityEdge modelleri + CRUD
  graphiti.py         # Graphiti sınıfı: add_episode, search, build_communities, remove_episode
  graphiti_types.py   # GraphitiClients (driver/llm/embedder/cross_encoder taşıyıcı)
  driver/             # GraphDriver soyut arayüzü + neo4j/falkordb/kuzu/neptune alt-implementasyonları
    neo4j/ falkordb/ kuzu/ neptune/   # her biri operations/{entity,episode,community,saga}_*_ops.py
  llm_client/         # LLMClient soyutu + openai/anthropic/gemini/groq/azure/gliner2 client'ları
  embedder/           # EmbedderClient soyutu + openai/azure/gemini/voyage
  cross_encoder/      # CrossEncoderClient soyutu + bge/openai/gemini reranker client'ları
  search/             # search.py, search_utils.py (Cypher sorguları), search_config*.py, search_filters.py
  prompts/            # extract_nodes/extract_edges/dedupe_nodes/dedupe_edges/summarize_* (LLM prompt'ları)
  utils/maintenance/  # edge_operations, node_operations, community_operations, dedup_helpers, attribute_utils
  models/{nodes,edges}/*_db_queries.py  # Ham Cypher/openCypher CREATE/RETURN sorguları, provider bazlı
mcp_server/           # Ayrı paket: MCP protokolü ile Graphiti'yi ajanlara sunan sunucu (add_memory, search_nodes, ...)
server/               # FastAPI tabanlı REST servis sarmalayıcı
tests/                # 47 test dosyası (unit + int + driver + llm_client + cross_encoder)
```

## Bellek modeli
- `Node` (soyut ABC, `graphiti_core/nodes.py:93`): `uuid`, `name`, `group_id`, `labels`, `created_at`.
- `EpisodicNode` (satır 318): ham olay verisi (`content`, `source`: message/json/text/fact_triple, `valid_at`, `entity_edges`). Graph'ta `Episodic` etiketi.
- `EntityNode` (satır 499): `name_embedding`, `summary`, `attributes` (özel tip alanları); graph'ta `Entity` + özel etiketler.
- `CommunityNode` (satır 687): `label_propagation` ile bulunan küme özetleri; `Community` etiketi.
- `SagaNode` (satır 867): yeni eklenmiş bir kavram — bir "saga" (ör. uzun bir konuşma/oturum akışı) için ilerlemeli özet tutar (`summary`, `first/last_episode_uuid`, `last_summarized_at`). `SagaNode.delete/get_by_uuid` vb. aynı dosyada.
- `Edge` (soyut, `graphiti_core/edges.py:49`): `uuid`, `group_id`, `source_node_uuid`, `target_node_uuid`, `created_at`.
- `EpisodicEdge` (satır 143): Episodic→Entity `MENTIONS` ilişkisi (kim hangi olayda geçti).
- `EntityEdge` (satır 263): asıl "fact" nesnesi — `name`, `fact`, `fact_embedding`, `episodes` (kaynak episode uuid listesi), zamansal alanlar (`valid_at`, `invalid_at`, `expired_at`, `reference_time`), `attributes`. Graph'ta `RELATES_TO` ilişkisi (Kuzu'da ayrı `RelatesToNode_` düğümü — Kuzu ilişkilere ek property/tip desteklemediği için).
- `CommunityEdge`: Community→Entity `HAS_MEMBER`.
- Şema: `graphiti_core/models/nodes/node_db_queries.py` ve `models/edges/edge_db_queries.py` içinde provider bazlı (Neo4j/FalkorDB/Kuzu/Neptune) ham CREATE/MERGE/RETURN sorguları.
- Kim yazar: `add_episode`/`add_episode_bulk`/`add_triplet` (LLM çıkarımı + kod tarafı kayıt). Kim okur: `search`/`search_`/`retrieve_episodes`/doğrudan `get_by_uuid(s)` çağrıları — hepsi `graphiti_core/graphiti.py` ve `search/` altında.

## Zamansal model ve bağlam yönetimi
Bi-temporal alanlar `EntityEdge` üzerinde (`graphiti_core/edges.py:271-282`):
- `valid_at` / `invalid_at`: **olay zamanı** — fact'in ne zaman doğru olmaya başladığı/bittiği (LLM'in metinden çıkardığı veya `dedupe_edges` akışında hesapladığı zaman).
- `created_at` / `expired_at`: **sistem zamanı** — kayıt ne zaman DB'ye yazıldı, ne zaman "artık geçersiz" olarak işaretlendi (wall-clock, `utc_now()`).

Bu ayrım "belleğin geçmişi geri alınabilir mi" sorusuna doğrudan cevap: **evet, geri alınabilir/sorgulanabilir**, çünkü invalidation bir DELETE değil bir UPDATE'tir — `resolve_edge_contradictions` (`graphiti_core/utils/maintenance/edge_operations.py:538-573`) çelişen kenarın `invalid_at`/`expired_at` alanlarını set eder, kenar graph'ta kalır. `SearchFilters` (`graphiti_core/search/search_filters.py:38-65`) `valid_at`/`invalid_at`/`created_at`/`expired_at` üzerinde `>`,`<`,`IS NULL` gibi operatörlerle filtre kurmaya izin verir → "T anındaki graph durumu" veya "hâlâ geçerli fact'ler" sorgusu mümkündür. Ayrıca `retrieve_episodes()` (`graphiti_core/utils/maintenance/graph_data_operations.py:67-90`) açıkça "point in time" sorgusu için `valid_at <= reference_time` filtresi kullanır (satır 80-82, 107).

**Önemli bulgu — varsayılan davranış filtre YAPMAZ**: `search_utils.py` içindeki tüm arama fonksiyonlarında filtre sadece `SearchFilters` nesnesi açıkça dolduruldukça eklenir (`edge_search_filter_query_constructor`, `search_filters.py:120-273`); `valid_at`/`invalid_at`/`expired_at` alanları `None` ise hiçbir WHERE koşulu eklenmez. Yani normal `search()`/`search_()` çağrısı **hem geçerli hem geçersiz kılınmış fact'leri birlikte döndürür** (`expired_at`/`invalid_at` alanları sonuçla beraber gelir, satırlar `search_utils.py:1458-1460` vb.) — "şu an geçerli olanı getir" filtrelemesi ajana/uygulamaya bırakılmıştır, varsayılan bir "current truth" filtresi yoktur.

Bağlam üretimi/sınırları: `Graphiti.search()` varsayılan `DEFAULT_SEARCH_LIMIT=10` (`search_config.py:29`) sonuç döner; `search_()` `SearchConfig.limit` ile kontrol edilir. BFS graph-traversal derinliği `MAX_SEARCH_DEPTH=3` (`search_utils.py:67`), tam-metin sorgu uzunluğu `MAX_QUERY_LENGTH=128` kelime (satır 68), minimum benzerlik skoru `DEFAULT_MIN_SCORE=0.6` (satır 65). Dolunca ne olur: sonuç `limit`'te kesilir (ekstra sayfalama yok, `uuid_cursor` bazlı cursor sadece `get_by_group_ids` gibi liste uçlarında var); episode içeriği çok uzunsa `graphiti_core/utils/content_chunking.py` ~4 char/token tahminiyle (`CHARS_PER_TOKEN=4`) parçalara bölünür (`CHUNK_TOKEN_SIZE`/`CHUNK_OVERLAP_TOKENS`, `graphiti_core/helpers.py`), extract_edges LLM çağrısı `max_tokens=16384` ile sınırlanır (`edge_operations.py:141`).

## Bellek yazma yetkisi ve güvenlik
**Soru A — kim çelişkiyi tespit eder, kim geçersiz kılmaya karar verir:**
- LLM'in rolü: `dedupe_edges.resolve_edge` prompt'u (`graphiti_core/prompts/dedupe_edges.py:41-100`) yeni fact'i mevcut fact listesiyle karşılaştırıp `duplicate_facts` ve `contradicted_facts` idx listeleri döndürür — "hangi fact'ler çelişiyor" kararı LLM'e ait (few-shot örnekler dahil, satır 79-92).
- Kodun rolü: LLM sadece "çelişiyor" der; **ne zaman geçersiz sayılacağını (invalid_at) ve ne zaman sistemde işaretleneceğini (expired_at) kural tabanlı kod belirler** — `resolve_edge_contradictions()` (`edge_operations.py:538-573`) iki fact'in `valid_at`/`invalid_at` aralıklarını karşılaştırır; çakışma yoksa dokunmaz, örtüşme varsa eski kenarın `invalid_at`'ini yeni kenarın `valid_at`'i yapar ve `expired_at = utc_now()` atar (satır 569-570). Ayrıca yeni kenarın kendisi de daha eski bir invalidation candidate'a göre geçersiz sayılabilir (`resolve_extracted_edge`, satır 820-839) — tamamen tarih karşılaştırmasıyla, LLM çağrısı yok.
- **Silme gerçek mi, geçersiz kılma mı:** Normal ingestion akışında **gerçek silme yok** — sadece `invalid_at`/`expired_at` set edilir, kenar graph'ta kalır (zamansal geçersizleştirme). **Gerçek (kalıcı) silme** ayrı ve açık bir API/yol: `Edge.delete()`/`Node.delete()` (`graphiti_core/edges.py:59-90`, `graphiti_core/nodes.py:111-167`) Cypher `DETACH DELETE`/`DELETE e` çalıştırır; MCP sunucusunda `delete_entity_edge` (`mcp_server/src/graphiti_mcp_server.py:659`) ve `delete_episode`→`Graphiti.remove_episode` (satır 685, yorum: "cascades... entities/facts created solely by this episode are removed") bunu tetikler. Yani: otomatik/LLM güdümlü yazma yolu sadece geçersiz kılar; kalıcı silme insan/uygulama tarafından açıkça çağrılan ayrı bir fonksiyondur.

**Soru C — PII / çok kiracılılık:**
- `group_id` her düğüm/kenarda zorunlu alan (`nodes.py:96`, `edges.py:51`) ve tüm CRUD sorgularında `WHERE n.group_id IN $group_ids` şeklinde kullanılır (`search_utils.py` içinde 98 referans, ör. satır 217-219, 325-327, 463-465, 584-586).
- **Sızma riski doğrulandı**: `group_ids` parametresi her yerde `list[str] | None = None` (`graphiti.py:1531`, `1592`) ve filtre kodu `if group_ids is not None: filter_queries.append(...)` (`search_utils.py:217-219` ve benzerleri) şeklinde — **`group_ids` geçilmezse (None), hiçbir group_id filtresi eklenmez ve arama tüm tenant'ların verisinde çalışır.** İzolasyon "varsayılan güvenli" değil, "opt-in" bir mekanizma.
- Benzer risk `clear_data()`'da da var (`graphiti_core/utils/maintenance/graph_data_operations.py:34-64`): `group_ids=None` verilirse `MATCH (n) DETACH DELETE n` ile **tüm graph** silinir (satır 43-44, 61-62) — tek bir yanlışlıkla parametre atlanan çağrı bütün tenant'ları siler.
- `group_id` enjeksiyona karşı doğrulanıyor: `validate_group_id`/`validate_group_ids` (`graphiti_core/helpers.py:136-171`) yalnız ASCII alfanumerik + tire/altçizgiye izin verir. Node etiketleri de benzer şekilde doğrulanıyor (`validate_node_labels`, `helpers.py:174+`) ve buna karşı açık Cypher-injection testleri var: `tests/test_node_label_security.py` (ör. `Entity\`) WITH n MATCH (x) DETACH DELETE x //` payload'ı reddediliyor, satır 12-18).
- PII/maskeleme/şifreleme/retention/TTL: `grep -ri "pii|redact|anonymi|encrypt|retention|ttl"` sonucu kod tabanında yalnız iki yorum satırı çıktı — `graphiti_core/llm_client/client.py:286` ("...without including full message content that may contain PII" — sadece log/tracing'de tam mesaj içeriği loglanmasın diye bir not) ve `graphiti_core/utils/maintenance/attribute_utils.py:177` ("Logging deliberately uses entity_uuid (not name) per AGENTS.md 'no PII in logs'"). **Gerçek bir maskeleme/redaction/şifreleme/TTL/retention mekanizması kodda yok** — sadece log disiplini var; ham fact/entity içerikleri (potansiyel PII dahil) şifrelenmeden DB'ye ve embedding provider'a gönderiliyor. Sonuç: **yok**.
- Telemetri: `graphiti_core/telemetry/telemetry.py` PostHog'a anonim kullanım istatistiği gönderir (sabit public API key, anonim UUID `~/.cache/graphiti/telemetry_anon_id`), `pytest` sırasında otomatik kapanıyor, `GRAPHITI_TELEMETRY_ENABLED=false` ile kapatılabiliyor — içerik/PII göndermiyor, sadece kullanım sinyali.

## RAG ve bilgi katmanı
Hibrit arama üç bacaklı: BM25 tam-metin (`fulltext_query`, `search_utils.py:85-111`, Lucene/openCypher sözdizimine göre `group_id` filtreleri sorgunun içine gömülür), cosine similarity (embedding, `EmbedderClient` üzerinden), ve BFS graph-traversal (`bfs_max_depth`, merkez düğümden komşuluk genişletme). Reranker seçenekleri `search_config.py:53-77`: `rrf` (reciprocal rank fusion, varsayılan), `mmr` (`mmr_lambda` ile çeşitlilik/alaka dengesi), `node_distance` (merkez düğüme graph mesafesi), `episode_mentions` (kaç episode'da geçtiği), `cross_encoder` (ayrı model ile yeniden puanlama — `graphiti_core/cross_encoder/client.py` soyut arayüz, `bge_reranker_client.py`/`openai_reranker_client.py`/`gemini_reranker_client.py` somut implementasyonlar). Hazır tarifler `search_config_recipes.py` içinde (`COMBINED_HYBRID_SEARCH_RRF/MMR/CROSS_ENCODER`, `EDGE_HYBRID_SEARCH_*`, vb.). Community detection: Louvain/Leiden değil, kendi `label_propagation()` implementasyonu (`graphiti_core/utils/maintenance/community_operations.py:93`), sonrasında LLM ile küme özeti (`summarize_pair`/`build_community`, aynı dosya satır 141-216).

## Ajan tasarımı
Graphiti kendisi bir ajan çerçevesi değil — bir bellek/graph kütüphanesi. Ajan entegrasyonu için ayrı bir MCP sunucusu var: `mcp_server/src/graphiti_mcp_server.py`. Makine-okur sözleşme: `@mcp.tool()` ile işaretli fonksiyonlar (`add_memory`:366, `search_nodes`:502, `search_memory_facts`:579, `delete_entity_edge`:659, `delete_episode`:685, `get_entity_edge`:714, `get_episodes`:741, `summarize_saga`:811, `build_communities`:864, `add_triplet`:918, `get_episode_entities`:992, `clear_graph`:1028, `get_status`:1071), tip-güvenli dönüş modelleri (`SuccessResponse`/`ErrorResponse`, `mcp_server/src/models/response_types.py`) — bu, ajanın araç şeması üzerinden çağırabileceği yapılandırılmış bir sözleşme. Ayrıca `server/` altında FastAPI tabanlı REST servis (incelenmedi ayrıntılı, sadece varlığı doğrulandı: `server/graph_service`).

## Hata yönetimi
- LLM çağrıları `tenacity` ile retry: `graphiti_core/llm_client/client.py:120-131`, `@retry(..., retry=retry_if_exception(is_server_or_retry_error), wait=wait_random_exponential, stop=stop_after_attempt(...))`; `is_server_or_retry_error` (satır 62-67) `RateLimitError`, `EmptyResponseError`, `json.decoder.JSONDecodeError` durumlarında retry tetikler — yani **structured-output/JSON parse hatası da retry kapsamında**.
- Özel hata tipleri: `graphiti_core/llm_client/errors.py` (`RateLimitError`, `RefusalError`, `EmptyResponseError`) ve `graphiti_core/errors.py` (`GraphitiError` taban sınıfı, `EdgeNotFoundError`, `EdgesNotFoundError`, `GroupsEdgesNotFoundError`, `GroupsNodesNotFoundError`, `NodeNotFoundError`, `NodeLabelValidationError`).
- Eşzamanlılık/rate-limit: `semaphore_gather()` (`graphiti_core/helpers.py:123-131`) tüm toplu LLM/DB çağrılarını `asyncio.Semaphore(SEMAPHORE_LIMIT)` (varsayılan 20, env `SEMAPHORE_LIMIT`) ile sınırlar.
- Kısmi yazma: `extract_edges`/`resolve_extracted_edges` içinde LLM'in döndürdüğü geçersiz index'ler (`duplicate_facts`/`contradicted_facts` aralık dışı) sessizce loglanıp atlanıyor (`edge_operations.py:736-742`, `761-767`) — kilitlenme yok ama sessiz veri kaybı riski var (sadece `logger.warning`).
- Driver hataları: her `*_ops.py` dosyası kendi provider'ının native exception'larını yakalamıyor gibi görünüyor (ayrıntılı incelenmedi); `graph_operations_interface` opsiyonel katmanı `NotImplementedError` fırlatırsa kod bir sonraki (native Cypher) yola düşüyor (`try/except NotImplementedError: pass` deseni, örn. `nodes.py:112-116`).

## Genişletilebilirlik
- Yeni **embedder** eklemek: `graphiti_core/embedder/client.py`'deki `EmbedderClient` soyut sınıfını implemente eden **1 dosya** yeterli (mevcut örnekler: `openai.py`, `azure_openai.py`, `gemini.py`, `voyage.py` — hepsi tek dosya).
- Yeni **LLM client** eklemek: `graphiti_core/llm_client/client.py`'deki `LLMClient` soyutunu implemente eden **1 dosya** (mevcut: `openai_client.py`, `anthropic_client.py`, `gemini_client.py`, `groq_client.py`, `azure_openai_client.py`, `gliner2_client.py`).
- Yeni **cross-encoder/reranker** eklemek: `CrossEncoderClient.rank()` metodunu implemente eden **1 dosya** (`cross_encoder/client.py:19-38`).
- Yeni **graph driver** (Neo4j/FalkorDB/Kuzu/Neptune örneğine bakarak) eklemek çok daha ağır: her mevcut driver **13-14 dosyalık** bir `operations/` klasörü içeriyor (`entity_node_ops.py`, `episode_node_ops.py`, `community_node_ops.py`, `saga_node_ops.py`, `entity_edge_ops.py`, `episodic_edge_ops.py`, `community_edge_ops.py`, `has_episode_edge_ops.py`, `next_episode_edge_ops.py`, `graph_ops.py`, `search_ops.py`, + driver dosyasının kendisi) — ayrıca `GraphProvider` enum'una (`driver/driver.py:59`) ve ilgili `models/*/​*_db_queries.py` dosyalarındaki provider-switch bloklarına eklenmesi gerekiyor. Yeni driver eklemek "1 dosya" değil, düzinelerce yeni dosya + var olan çoklu-provider switch'lerine dokunma işi.
- Özel entity/edge tipi tanımlama: destekleniyor — `edge_types: dict[str, type[BaseModel]]` ve `edge_type_map` parametreleri (`extract_edges()` imzası, `edge_operations.py:117-125`) kullanıcı tanımlı Pydantic modelleriyle özel fact şemaları (attribute extraction) tanımlamaya izin veriyor; MCP sunucusunda `mcp_server/src/models/entity_types.py` / `edge_types.py` bunun somut örneği.

## Güçlü yönler (kanıtlı)
- Bi-temporal model gerçek ve sorgulanabilir: `valid_at/invalid_at/created_at/expired_at` alanları + `SearchFilters` operatörleri (`search_filters.py:38-273`) ile "belirli andaki graph durumu" sorgusu mümkün.
- Çelişki çözümü net ayrık sorumluluk: LLM sadece "çelişiyor mu" der, kod tarihsel karşılaştırmayla ne zaman geçersiz sayılacağına karar verir (`edge_operations.py:538-573`) — denetlenebilir, test edilebilir bir kural seti.
- Injection'a karşı somut test kapsamı var (`tests/test_node_label_security.py`) — sadece "iyi niyet" değil, kanıtlı savunma.
- 4 farklı graph backend'i (Neo4j, FalkorDB, Kuzu, Neptune) gerçekten çalışır durumda, tutarlı operations-interface deseniyle.

## Zayıf yönler (kanıtlı)
- `group_ids=None` varsayılanı hem aramada hem `clear_data()`'da **izolasyonu sessizce devre dışı bırakıyor** — çok kiracılı bir sistemde tek bir unutulmuş parametre tüm kiracıların verisini sızdırabilir ya da tümünü silebilir (`search_utils.py` filtre deseni; `graph_data_operations.py:34-64`).
- Hiçbir PII maskeleme/redaction/şifreleme/retention/TTL mekanizması yok; tek önlem log disiplinine dair bir yorum satırı (`attribute_utils.py:177`).
- Varsayılan arama sonucu geçerli/geçersiz fact ayrımı yapmadan döner — "current truth" filtresi opt-in, unutulursa ajana modası geçmiş/çelişkili fact'ler karışabilir.
- LLM'in döndürdüğü geçersiz index'ler sessizce loglanıp atlanıyor (`edge_operations.py:736-742`) — sert hata yerine sessiz veri kaybı riski.
- Yeni graph driver eklemek gerçekte "eklenti" değil, 13-14 dosyalık paralel bir implementasyon + birden fazla dosyada provider-switch güncellemesi gerektiriyor.

## Puan (1–5)
- olgunluk: 4 — 47 test dosyası, 4 canlı backend, aktif commit geçmişi, ayrı MCP/server paketleri; ama PII/retention hiç yok, bu üretim-olgunluğunu sınırlıyor.
- mimari netlik: 4 — modeller/prompt'lar/arama/driver katmanları net ayrılmış, `graph_operations_interface` soyutlaması tutarlı.
- genişletilebilirlik: 3 — LLM/embedder/reranker için 1-dosya eklenti kolay (bu kısım 4-5 hak eder), ama yeni graph driver 13-14 dosyalık ağır iş; ortalama 3.
- güvenilirlik ilkelleri: 3 — tenacity retry + semaphore var, ama kısmi yazmalarda sessiz atlama ve driver-seviyesi hata sınıflandırması ayrıntılı incelenmedi (bu kısım "incelenmedi").
- gözlemlenebilirlik: 3 — OpenTelemetry entegrasyonu var (`graphiti_core/tracer.py`, opsiyonel bağımlılık `tracing` extra), ama zorunlu değil ve varsayılan kurulumda aktif değil.
- güvenlik duruşu: 2 — Cypher-injection'a karşı somut test var (iyi), ama group_id izolasyonu opt-in ve varsayılan olarak sızdırıyor/silebiliyor, PII/retention hiç yok — bu ikisi ciddi düşürücü.

## Alınacak fikir
- **Bi-temporal alan ayrımı (valid_at/invalid_at vs created_at/expired_at)** — neden: "ne zaman doğruydu" ile "ne zaman sistemde öğrenildi/geçersiz sayıldı" ayrımı, bizim bellek katmanımızda "ajan şu an ne biliyor" ile "ajan ne zaman yanılmıştı" sorularını ayrı ayrı cevaplamamızı sağlar; ajans-os'ta checkpoint/geri-alma tasarımı için doğrudan uygulanabilir model.
- **LLM karar + kod kural ayrımı (contradiction detection LLM, invalidation timing kod)** — neden: LLM'e "hangisi çelişiyor" gibi doğal-dil muhakeme sorulur, "ne zaman geçersiz" gibi belirlenimci hesap koda bırakılır; bizim onay-kapısı/insan-kapısı tasarımımızda da "LLM önerir, kural karar verir" ayrımı aynı şekilde uygulanabilir.
- **SearchFilters ile opt-in zaman/etiket filtreleme deseni** — neden: tek bir sorgu arayüzü üstüne katmanlı, birleştirilebilir filtre nesnesi (`valid_at`/`invalid_at`/`node_labels`/`property_filters`) — bizim bağlam sorgu API'mizde de "varsayılan geniş, gerekirse daralt" yerine bunun tersini (varsayılan güvenli, gerekirse genişlet) uygulamak gerektiğini gösteren iyi bir negatif-örnek + iyi bir arayüz şekli.
- **MCP tool sözleşmesi + SuccessResponse/ErrorResponse tip modeli** — neden: ajanın çağırabileceği her aracın girdi/çıktısı Pydantic ile tipli; bizim ajan-araç sözleşmesi dokümantasyonumuz için doğrudan örnek alınabilir bir kalıp.

## Alınmayacak
- **group_id=None → filtresiz global arama davranışı** — neden: "kolaylık" için varsayılan güvenliği feda ediyor; bizde tenant/oturum izolasyonu her zaman zorunlu (whitelist) olmalı, "unutulursa hepsini getir/sil" davranışını hiç kopyalamamalıyız.
- **PII önlemi olmadan ham içeriği doğrudan embedding/LLM'e ve DB'ye yazma** — neden: Graphiti bunu bilerek kapsam dışı bırakmış (sadece log disiplini var); bizim bellek katmanımızda bunu kabul edilebilir bulmayıp en azından yazma öncesi bir redaction/sınıflandırma adımı eklemeliyiz.

## Matris cevapları
- saglayici_bagimsiz: evet — LLM (`llm_client/`: openai/anthropic/gemini/groq/azure/gliner2), embedder (`embedder/`: openai/azure/gemini/voyage) ve graph driver (`driver/`: neo4j/falkordb/kuzu/neptune) katmanları ayrı soyut arayüzlerle değiştirilebilir; kanıt: `graphiti_core/llm_client/client.py`, `graphiti_core/embedder/client.py`, `graphiti_core/driver/driver.py:90-113`.
- sozlesme_var: evet (kısmen makine-okur) — MCP `@mcp.tool()` fonksiyonları + `SuccessResponse`/`ErrorResponse` tipli dönüşler (`mcp_server/src/graphiti_mcp_server.py:365-1071`) ajan tarafından şema üzerinden tüketilebilir bir sözleşme oluşturuyor; ama OpenAPI/JSON-Schema düzeyinde ayrı bir belge yok, sözleşme kod içi tip tanımlarına gömülü.
- insan_kapisi: kısmen — kalıcı silme (`delete_entity_edge`, `delete_episode`, `clear_graph`) ve `clear_data()` gibi geri-dönüşsüz işlemler var ama kod seviyesinde bir onay/kapı mekanizması yok; bunları çağırmak tamamen çağıran tarafın (insan/ajan) sorumluluğunda, sistem kendiliğinden durup onay istemiyor.
- checkpoint: evet (temporal, silme-değil) — `expired_at`/`invalid_at` ile geçmiş durum korunuyor ve `SearchFilters`/`retrieve_episodes` ile geçmişe dönük sorgulanabiliyor (`graph_data_operations.py:67-90`); ama tam "snapshot/rollback" (bütün graph'ı bir ana geri alma) mekanizması yok, sadece kenar-bazlı zaman filtreleme var.
