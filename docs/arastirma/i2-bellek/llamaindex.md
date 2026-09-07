# LlamaIndex (core: bellek ve bağlam katmanı)

## Kimlik
run-llama/llama_index · 52.045 yıldız · 286 watcher · son push 2026-09-05 · MIT · Python · haftalık indirme: incelenmedi (PyPI'ye erişilmedi).
canlılık: geçti — klon içindeki git log son commit `d2ac544` (2026-09-02), aktif geliştirme.
İnceleme kapsamı: sparse checkout. İncelenen: `llama-index-core/llama_index/core/memory/`, `storage/` (chat_store, docstore, index_store, kvstore), `ingestion/`, `indices/` (üst düzey + `__init__.py`, `postprocessor.py`, `base.py`), `postprocessor/`, `node_parser/`. Kapsam dışı (bu klonda yok, "yok" değil kasıtlı budanmış): `workflows/`, `agent/`, `tools/`, `llms/`, `embeddings/`, `vector_stores/` somut implementasyonları, `readers/`, `evaluation/`, `multi_modal_llms/`, tüm entegrasyon paketleri (`llama-index-integrations/*`).

## Çözdüğü problem
LLM uygulamalarında (ajan/chatbot/RAG) sohbet geçmişinin token limitini aşması, uzun vadeli kullanıcı bilgisinin korunamaması ve harici belgelerin sorgulanabilir bir bilgi katmanına dönüştürülmesi problemlerini standart, değiştirilebilir bileşenlerle (Memory, docstore, ingestion pipeline, index tipleri) çözer.

## Mimari
```
ChatMessage akışı
   │  Memory.aput()/aput_messages()
   ▼
[SQLAlchemyChatStore]  <-- storage/chat_store/sql.py (FIFO, status=ACTIVE/ARCHIVED)
   │  token limiti aşılınca _manage_queue() waterfall
   ▼
[BaseMemoryBlock*]  <-- memory/memory_blocks/{static,fact,vector}.py
   │  aget() (priority sırası) + atruncate()
   ▼
Memory.aget() -> RichPromptTemplate ile sistem/user mesajına enjekte -> LLM'e giden chat_history

Bağımsız RAG hattı:
Document -> [node_parser/*] -> Node
         -> [ingestion/pipeline.py IngestionPipeline] (cache + docstore dedup)
         -> [indices/* (VectorStoreIndex, SummaryIndex, ...)]
         -> Retriever -> [postprocessor/*] (rerank/filter/PII/optimize) -> LLM
```

## Klasör yapısı
```
memory/
  memory.py            Memory sınıfı, BaseMemoryBlock, waterfall mantığı (satır 1-874)
  types.py             BaseMemory / BaseChatStoreMemory soyut arayüzleri
  memory_blocks/       StaticMemoryBlock, FactExtractionMemoryBlock, VectorMemoryBlock
  chat_memory_buffer.py, chat_summary_memory_buffer.py, vector_memory.py, simple_composable_memory.py
                       -- hepsi __init__.py'de "Deprecated" olarak işaretli, Memory'nin selefleri
storage/
  chat_store/          SQLAlchemyChatStore (sql.py) — Memory'nin fiili backend'i; simple_chat_store.py (RAM)
  docstore/            keyval_docstore.py — hash/id tabanlı belge deposu, ingestion dedup için
  index_store/         index metadata KV üzerinde saklanır
  kvstore/             BaseKVStore soyut taban, SimpleKVStore (RAM/dosya)
ingestion/
  pipeline.py          IngestionPipeline, DocstoreStrategy (satır 242-259), run/arun
  cache.py             IngestionCache — transformation hash -> node listesi
node_parser/           TextSplitter/NodeParser soyut taban (interface.py), sentence/token/semantic splitters
postprocessor/         node.py (prev/next, similarity, reorder), pii.py, optimizer.py, rerank'lar
indices/               VectorStoreIndex, SummaryIndex, TreeIndex, KeywordTableIndex, PropertyGraphIndex, vb.
```

## Bellek modeli
`Memory` sınıfı (`memory/memory.py:188`) tek bir bileşende hem kısa hem uzun süreliyi yönetir:
- **Kısa süreli**: `sql_store` (varsayılan `SQLAlchemyChatStore`, SQLite in-memory) üzerinde tutulan ham `ChatMessage` FIFO kuyruğu (`memory.py:250-258`).
- **Uzun süreli**: `memory_blocks: List[BaseMemoryBlock]` (`memory.py:217-220`) — kuyruktan taşan mesajlar buraya "waterfall" edilir.

`BaseMemoryBlock` (`memory.py:103-185`) soyut sözleşmesi: `_aget`/`_aput` zorunlu, `atruncate` opsiyonel; her blok `priority` (0 = asla kırpma) ve `accept_short_term_memory` (varsayılan `True`) alanlarına sahip.

Storage bileşenleri: `docstore` (belge/node depolama + hash dedup, `storage/docstore/types.py:24` `BaseDocumentStore` soyut), `index_store` (index metadata), `chat_store` (mesaj depolama — `Memory` artık `BaseChatStoreMemory` değil doğrudan `AsyncDBChatStore`/`SQLAlchemyChatStore` kullanıyor, `memory.py:250-254`), `kvstore` (hepsinin temel anahtar-değer katmanı, `storage/kvstore/types.py:11` `BaseKVStore`). Graph store bu klonda ayrı bir dosya olarak görülmedi (property_graph indeksleri kapsamda ama `graph_store` modülü incelenmedi — muhtemelen entegrasyon paketlerinde).

Kim yazar / kim okur: `Memory.aput()/aput_messages()` sohbet mesajlarını `sql_store`'a yazar (`memory.py:811-829`); `Memory.aget()` hem kuyruğu hem blokları okuyup birleştirir (`memory.py:624-670`).

## Bağlam yönetimi
Bu, `Memory` sınıfının en ayrıntılı parçası.

**Parametreler** (`memory.py:205-216`): `token_limit` (varsayılan 30000, `DEFAULT_TOKEN_LIMIT`), `chat_history_token_ratio` (varsayılan 0.7 — kısa süreli kuyruğa ayrılan pay), `token_flush_size` (varsayılan `token_limit*0.1`, bir defada ne kadar tahliye edileceği).

**Doğrulama** (`memory.py:264-286`, `validate_memory`): `token_limit < 1` ise hata; `token_flush_size` geçersiz veya `token_limit`'ten büyükse otomatik `token_limit*0.1`'e çekilir; `from_defaults` içinde ayrıca `token_flush_size > token_limit` ise `token_limit*0.7`'ye çekilir (`memory.py:325-326`) — iki farklı yerde iki farklı düzeltme oranı var (0.1 vs 0.7), tutarsızlık potansiyeli.

**Token sayımı** `_estimate_token_count` (`memory.py:343-444`): metin için gerçek `tokenizer_fn`, görsel/ses/video/döküman blokları için sabit tahmini boyutlar (`image_token_size_estimate=256`, `document_token_size_estimate=2048` vb., `memory.py:229-244`) — yani gerçek token sayımı değil, medya için kaba yaklaşık.

**Dolunca ne olur — `_manage_queue`** (`memory.py:672-809`): Eşik `token_limit * chat_history_token_ratio` (varsayılan 30000*0.7=21000). Kuyruk bunu aşarsa:
1. Kuyruk ters çevrilip en eskiden başlanarak `token_flush_size`'a ulaşana kadar mesajlar `messages_to_flush`'a toplanır (`memory.py:709-721`).
2. **Konuşma bütünlüğü korunur**: kalan kuyruğun ilk mesajının `role == "user"` olması zorunlu tutulur; değilse ilave mesajlar da tahliyeye eklenir (`memory.py:737-746`).
3. Eğer kuyruk boşalırsa veya tek kalan mesaj user değilse, tahliye listesi içinde geriye doğru taranıp **son tam tur** (user → assistant → tool → assistant zinciri) bulunur ve kuyruğa geri konur (`memory.py:761-778`, yorum: "correctly handles tool calling") — bu, araç çağrısı/yanıt çiftlerinin kesme sırasında bozulmamasını sağlayan asıl mekanizma.
4. Tahliye edilen mesajlar `sql_store.archive_oldest_messages()` ile durumu `ARCHIVED` yapılır (silinmez, `sql.py:372-406`), sonra **tüm** `memory_blocks`'a `asyncio.gather` ile paralel `aput(..., from_short_term_memory=True)` çağrılır (`memory.py:781-797`) — yani hafızadan atılan mesajlar bloklara "aktarılır", kaybolmaz (block `accept_short_term_memory=False` ise yine de reddedebilir, `memory.py:158-159`).
5. Döngü, tahliye edilecek bir şey kalmayana kadar tekrarlanır (`memory.py:704-809`).

**Bloklar da limit aşarsa** — `_truncate_memory_blocks` (`memory.py:481-544`): önce `priority` düşük olan bloklardan başlanarak `atruncate()` çağrılır (varsayılan davranış: tüm içeriği sıfırlar, `memory.py:167-185`); hâlâ yetmiyorsa aynı öncelik sırasıyla bloklar tamamen listeden çıkarılır (`memory.py:533-544`). `priority == 0` olan bloklar hiçbir zaman kırpılmaz.

**Enjeksiyon**: nihai `_insert_memory_content` (`memory.py:574-622`) blok içeriğini `InsertMethod.SYSTEM` (varsayılan) ile sistem mesajına veya `InsertMethod.USER` ile son kullanıcı mesajına önceden ekler; `ChatMessage` döndüren bloklar doğrudan geçmişin başına eklenir.

**Postprocessor tarafında bağlam kısaltma**: `postprocessor/optimizer.py` (`SentenceEmbeddingOptimizer`, satır 17-167) node içeriğini cümle-embedding benzerliğine göre kırpar (RAG retrieval sonrası, chat memory'den bağımsız bir mekanizma); `postprocessor/node.py` içindeki `LongContextReorder` (satır 366+) ve `SimilarityPostprocessor` (satır 70+) de retrieval sonrası bağlam boyutunu/sırasını ayarlar, ama bunlar `Memory`'nin token-limit akışına bağlı değil, retriever çıktısına uygulanan ayrı bir katman.

## Bellek yazma yetkisi ve güvenlik
**A) Yazma yetkisi**: `StaticMemoryBlock._aput` no-op'tur (`memory_blocks/static.py:38-39`) — içerik sadece constructor'da geliştirici tarafından `static_content` ile verilir, hiçbir zaman otomatik değişmez; yazan taraf **insan/geliştirici**. `FactExtractionMemoryBlock._aput` (`memory_blocks/fact.py:119-166`) her waterfall'da LLM'e (`self.llm.achat`) mesajları gönderip XML `<fact>` etiketleri çıkarttırır, `max_facts` (varsayılan 50) aşılırsa yine LLM'e "condense" ettirir ve **koşulsuz** (kullanıcı onayı yok) `self.facts` listesine ekler/değiştirir — yani yazma tamamen LLM çıkarımına bırakılmış, deterministik doğrulama yok. `VectorMemoryBlock._aput` (`memory_blocks/vector.py:170-201`) hiçbir filtreleme/karar yapmadan tahliye edilen her mesajı embed edip vektör deposuna yazar — **otomatik ve koşulsuz**.
Bloklar arası **öncelik**: `_get_memory_blocks_content` bloğu `priority` azalan sırada okur (`memory.py:460`), `_truncate_memory_blocks` ise kırpma sırasında `priority` artan sırada (düşük öncelik önce feda edilir, `memory.py:497-499, 533`) işler; `priority=0` dokunulmaz.

**C) PII/hassas veri**: `grep -rniE "pii|redact|anonymi|encrypt|retention|ttl"` core genelinde yalnızca `postprocessor/pii.py` ve onu re-export eden `postprocessor/__init__.py` / `indices/postprocessor.py` dosyalarında eşleşti — **retention, TTL, encrypt kavramları core'da hiç yok**; mesajlar `ARCHIVED` durumuna geçse de kalıcı silme/sona erdirme mekanizması bulunmuyor (`sql.py`'de `delete_messages` var ama otomatik tetiklenmiyor).
`PIINodePostprocessor` (`pii.py:40-95`) bir retrieval-sonrası node postprocessor'dür, `Memory` akışına hiç bağlı değildir (yalnızca query engine'de elle takılırsa çalışır): LLM'e "PII'ı maskeleyip JSON mapping döndür" diye tek seferlik prompt gönderir (`DEFAULT_PII_TMPL`, satır 12-37), yanıtı `"Output Mapping:"` string'iyle bölüp `json.loads` eder — **kırılgan**: LLM formatı bozarsa (örn. mapping'i döndürmezse) `IndexError`/`JSONDecodeError` fırlatır, hiçbir regex/deterministik doğrulama veya retry yok; güvenilirliği tamamen LLM'in talimata uyma tutarlılığına bağlı, üretim-sınıfı bir redaksiyon garantisi değildir. `NERPIINodePostprocessor` (satır 98-147) alternatif olarak HuggingFace `transformers` NER pipeline'ı kullanır — daha deterministik ama modelin varlık tanıma kalitesine bağlı, kod satırında hiçbir güven eşiği/doğrulama filtresi yok. Her iki postprocessor da `Memory`/`FactExtractionMemoryBlock`/`VectorMemoryBlock` tarafından otomatik çağrılmıyor; entegrasyon geliştiriciye bırakılmış.

## RAG ve bilgi katmanı
`node_parser/interface.py:50` `NodeParser(TransformComponent, ABC)` ve `TextSplitter`/`MetadataAwareTextSplitter` (satır 210-283) tüm chunker'ların taban sınıfı; somut örnekler `node_parser/text/sentence.py` (`SentenceSplitter`, varsayılan `DEFAULT_CHUNK_SIZE`/`chunk_size` parametreli, satır 9,34,44,71), `token.py`, `semantic_splitter.py`, `semantic_double_merging_splitter.py`, `code.py`; dosya-özel parser'lar `node_parser/file/` (html, json, markdown), ilişkisel/tablo çıkarımı `node_parser/relational/` (markdown_element, unstructured_element).

`ingestion/pipeline.py` `IngestionPipeline` üç dedup stratejisi tanımlar (`DocstoreStrategy`, satır 242-259): `UPSERTS` (id bazlı, hash değişmişse günceller — varsayılan), `DUPLICATES_ONLY` (yalnızca hash eşleşmesine bakar, silme yapmaz), `UPSERTS_AND_DELETE` (kaynakta olmayan belgeleri docstore'dan da siler). Bu strateji `docstore`'un (`storage/docstore/keyval_docstore.py`) persist edilmiş olmasını gerektirir. Ayrıca `IngestionCache` (`ingestion/cache.py:17-78`) her transformation zincirinin `sha256` hash'ini (`get_transformation_hash`, `pipeline.py:57-66`) anahtar yaparak node çıktısını `BaseKVStore` üzerinde önbelleğe alır — aynı belge+transform tekrar çalıştırılırsa LLM/embedding çağrısı atlanır.

İndeks tipleri (`indices/__init__.py:54-84`): `VectorStoreIndex`, `SummaryIndex` (eski `ListIndex`), `TreeIndex`, `KeywordTableIndex`/`RAKEKeywordTableIndex`, `DocumentSummaryIndex`, `KnowledgeGraphIndex`, `PropertyGraphIndex`, `SQLStructStoreIndex`, `MultiModalVectorStoreIndex`, `EmptyIndex` — hepsi tek bir modülden dışa aktarılıyor, ortak taban `indices/base.py`.

Postprocessor/reranker'lar `postprocessor/`: `llm_rerank.py`, `sbert_rerank.py`, `rankGPT_rerank.py`, `structured_llm_rerank.py` (LLM/cross-encoder tabanlı yeniden sıralama), `node.py` içinde `KeywordNodePostprocessor`, `SimilarityPostprocessor`, `PrevNextNodePostprocessor`/`AutoPrevNextNodePostprocessor` (komşu node ekleme), `LongContextReorder` (satır 26-381), `metadata_replacement.py`, `node_recency.py`.

## Ajan tasarımı
Bu klonda `workflows/`/`agent/` paketleri **kapsam dışı** — ajan orkestrasyon kodu incelenmedi. `Memory` sınıfının ajanla arayüzü yalnızca dolaylı gözlemlenebildi: `Memory.aget(input=...)` bir `str` veya `ChatMessage` alıp güncel chat geçmişini + enjekte edilmiş bellek içeriğini döndürür (`memory.py:624-670`), yani ajan çatısı her turn'de bu listeyi LLM'e chat mesajları olarak geçmesi bekleniyor — biçimsel/makine-okur bir sözleşme (JSON şema, function-calling kontratı) core/memory içinde tanımlı değil; sözleşme basitçe `List[ChatMessage]` tipi. `sql_store`/`session_id` alanları (`memory.py:255-258`) çoklu oturum desteğini gösteriyor ama oturum yönetimi (kim hangi session_id'yi seçer) ajan katmanına bırakılmış.

## Hata yönetimi
`Memory.aput`/`_manage_queue` senkron try/except veya retry içermiyor — SQL hataları olduğu gibi yükselir. `FactExtractionMemoryBlock._aput` (`fact.py:160-166`) condense LLM yanıtı boşsa/parse edilemezse eski `facts` listesini korur (silinmesini önleyen bilinçli guard, yorum satırında açıklanmış), ama LLM `achat` çağrısı retry/timeout mantığı içermiyor (üst seviye `LLM` sınıfına bırakılmış, incelenmedi). `PIINodePostprocessor.mask_pii` (`pii.py:59-73`) `response.split("Output Mapping:")` ve `json.loads` için hiç try/except yok — format sapması durumunda istisna doğrudan çağırana yayılır. `IngestionPipeline` cache tutarlılığı: `get_transformation_hash` (`pipeline.py:57-66`) node içeriği + transform config hash'ine dayanır; `remove_unstable_values` (satır 46-53) bellek adresi gibi kararsız repr'ları temizleyerek cache anahtarının stabilitesini artırır — ama pipeline `run`/`arun` içinde kısmi hata (bazı node'lar başarısız) durumunun nasıl ele alındığı bu okumada ayrıntılı izlenmedi (yalnızca imzalar görüldü, satır 539, 746).

## Genişletilebilirlik
Yeni bir **memory block** eklemek: `BaseMemoryBlock`'tan türetip `_aget`/`_aput` yazmak yeterli (`memory.py:103-185`), tek dosya. Yeni bir **kvstore**: `BaseKVStore` (`storage/kvstore/types.py:11`) 6 abstract metod (`put/aput/get/aget/get_all-variant/delete/adelete`) — tek dosya, `MutableMappingKVStore` üzerinden RAM tabanlıysa daha da az kod (satır 95-183). Yeni **docstore**: `BaseDocumentStore` (`storage/docstore/types.py:24`) ~15 abstract metod (persist, add/get/delete document, hash yönetimi, ref-doc-info) — biraz daha ağır bir sözleşme. Yeni **vector store** bu klonda `vector_stores/types.py` incelenmedi (kapsam dışı sayılabilir, sadece arayüz import edildiği görüldü — `memory_blocks/vector.py:15-20`). Genel olarak her katman (memory/storage/ingestion) ince, tek-sorumluluklu soyut taban sınıflara sahip; yeni entegrasyon tipik olarak tek dosyada, mevcut sınıfa dokunmadan eklenebilir.

## Güçlü yönler (kanıtlı)
- Kesme sırasında araç çağrısı/yanıt bütünlüğünü koruyan açık, satır satır izlenebilir algoritma (`memory.py:727-778`).
- Tahliye edilen mesajlar kaybolmuyor, tüm bloklara paralel (`asyncio.gather`) aktarılıyor (`memory.py:788-797`); mesajlar silinmiyor, `ARCHIVED` durumuna geçiyor (`sql.py:372-406`).
- Üç net dedup stratejisi (`UPSERTS`/`DUPLICATES_ONLY`/`UPSERTS_AND_DELETE`) + içerik-hash tabanlı ingestion cache (`pipeline.py:242-259`, `cache.py`).

## Zayıf yönler (kanıtlı)
- `token_flush_size` doğrulaması iki farklı yerde iki farklı katsayıyla düzeltiliyor (`memory.py:276-279` → `*0.1`, `memory.py:325-326` → `*0.7`) — tutarsız varsayılan davranış.
- `FactExtractionMemoryBlock` ve `VectorMemoryBlock` yazımı tamamen LLM çıktısına/otomatik embed'e bırakılmış, insan onayı veya deterministik doğrulama katmanı yok (`fact.py:144-147`, `vector.py:170-201`).
- Core'da PII maskeleme LLM string-split + `json.loads`'a dayanıyor, try/except yok, format sapmasında çöküyor (`pii.py:69-73`); retention/TTL/encrypt kavramı core'da hiç yok.

## Puan (1–5)
- olgunluk: 4 — `Memory` API'si aktif geliştirilmiş, eski `ChatMemoryBuffer`/`VectorMemory` deprecated edilip yerine konmuş (`memory/__init__.py`), ama iki farklı flush-size düzeltme değeri gibi cilalanmamış köşeler var.
- mimari netlik: 4 — waterfall akışı (kuyruk → blok → format → enjeksiyon) kod okuyarak kolayca izlenebiliyor, fonksiyonlar tek sorumluluklu.
- genişletilebilirlik: 4 — `BaseMemoryBlock`/`BaseKVStore` küçük, net soyut sözleşmeler; yeni blok/kvstore tek dosyada yazılabiliyor.
- güvenilirlik ilkelleri: 2 — retry/timeout mantığı bu katmanda görülmedi, LLM tabanlı fact/PII çıkarımı hatasız yanıt varsayıyor, kısmi hata senaryoları test edilmedi (kod okumasında).
- gözlemlenebilirlik: 2 — `postprocessor/optimizer.py` içinde `logger.debug` var ama `memory.py`'de log/metrik/telemetri çağrısı görülmedi.
- güvenlik duruşu: 2 — PII postprocessor'ları opt-in ve kırılgan; core'da retention/TTL/encrypt yok; `Memory` varsayılan olarak SQLite in-memory chat store kullanıyor (kalıcı olmayan ama şifrelemesiz).

## Alınacak fikir
- Waterfall + konuşma-turu bütünlüğü koruma algoritması (`memory.py:727-778`) — bağlam kesilirken araç çağrısı/yanıt çiftinin bozulmaması sorununu doğrudan çözüyor; bizim ajan bellek tasarımımızda context flush noktasında aynı "son tam turu geri koy" kuralını uygulayabiliriz.
- `priority` alanlı çok-bloklu bellek modeli (`BaseMemoryBlock.priority`, `memory.py:117-120`) — sabit/statik bilgiyi (priority=0, hiç kırpma) değişken/genişleyebilir bilgiden (fact/vector, düşük priority önce feda) ayırmak, bizde sistem talimatları vs. öğrenilen kullanıcı tercihleri ayrımına birebir oturur.
- Transformation-hash tabanlı ingestion cache + üç seviyeli dedup stratejisi (`pipeline.py`, `cache.py`) — tekrar eden belge işleme maliyetini kesmek için kendi ingestion hattımıza doğrudan taşınabilir bir desen.

## Alınmayacak
- LLM'e "PII'ı maskele ve JSON mapping döndür" dedirtip string-split ile parse eden `PIINodePostprocessor` yaklaşımı (`pii.py:59-73`) — hiçbir doğrulama/retry olmadan format sapmasında çöküyor; hassas veri maskeleme için üretimde güvenilmez, deterministik/regex+NER tabanlı bir çözüm tercih edilmeli.
- `FactExtractionMemoryBlock`'un insan onayı olmadan LLM çıkarımını doğrudan uzun süreli belleğe yazması (`fact.py:144-147`) — bizim "silmeden önce bak" ilkemizle çelişir; bellek yazımı bir insan kapısından geçmeli.

## Matris cevapları
- saglayici_bagimsiz: kismen — `Memory` LLM/embed model'i `Settings.llm`/`Settings.embed_model` üzerinden soyutluyor (`fact.py:63-64`, `vector.py:25-27`), somut sağlayıcı entegrasyonları bu klonda kapsam dışı; core kendisi sağlayıcıya bağlanmıyor ama soyutlama seviyesi entegrasyon paketine bağlı (incelenmedi).
- sozlesme_var: kismen — `List[ChatMessage]` ve `BaseMemoryBlock`/`BaseKVStore`/`BaseDocumentStore` Python soyut taban sınıfları net bir programatik sözleşme sunuyor (`memory/types.py`, `storage/kvstore/types.py:11`, `storage/docstore/types.py:24`), ama JSON-şema gibi dil-bağımsız makine-okur bir kontrat core'da tanımlı değil.
- insan_kapisi: hayir — waterfall, fact extraction ve vector memory yazımlarının hiçbiri insan onayı beklemiyor; hepsi otomatik/LLM-güdümlü (`memory.py:788-797`, `fact.py:144-166`, `vector.py:170-201`).
- checkpoint: kismen — mesajlar silinmek yerine `ARCHIVED` durumuna geçiyor (`sql.py:372-406`, geri alınabilir bir arşiv var) ama bu, tanımlı bir "checkpoint/restore" API'si değil; `Memory.aset`/`areset` var ama versiyon/snapshot kavramı yok.
