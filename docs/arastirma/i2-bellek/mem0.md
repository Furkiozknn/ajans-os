# mem0

## Kimlik
mem0ai/mem0 · 64.820 yıldız · 248 watcher · son push 2026-09-04 · Apache-2.0 · Python · haftalık PyPI indirme: doğrulanmadı (PyPI'ye erişilmedi)
Sürüm (kodda doğrulandı): `pyproject.toml:6` → `version = "2.0.20"`, `requires-python = ">=3.10,<4.0"`.
canlılık: geçti — arşivlenmemiş, son push 2026-09-04, klon HEAD `dae67f7` (2026-09-04), 102 test dosyası (`tests/`).
İnceleme kapsamı: `mem0/memory/` (main.py 3.868 satır, storage.py, telemetry.py, utils.py), `mem0/configs/prompts.py`, `mem0/proxy/`, `mem0/reranker/`, `server/` (FastAPI + auth). Kapsam dışı: `mem0-ts/` (TypeScript port), `evaluation/`, `integrations/*`, tekil vector store adapter'ları.

## Çözdüğü problem
Sohbet geçmişini olduğu gibi saklamak yerine, konuşmadan **atomik olgular** (fact) çıkarıp bunları kalıcı, aranabilir bir katmana yazan bir "kullanıcı hafızası" katmanı. Hedef kitle: bir asistanın kullanıcıyı oturumlar arası hatırlamasını isteyen uygulama geliştiricisi. Çözdüğü acı: bağlam penceresine tüm geçmişi doldurmanın hem pahalı hem de bir noktadan sonra imkânsız olması — mem0 geçmişi sıkıştırmaz, geçmişten **çıkarım** yapar ve yalnızca çıkarılan cümleleri saklar.

## Mimari
İki katman: (1) `Memory` / `AsyncMemory` sınıfı — LLM + embedding + vector store + SQLite geçmişi orkestrasyonu; (2) opsiyonel FastAPI sunucusu (`server/main.py`) ve OpenAI-uyumlu proxy (`mem0/proxy/main.py`).

`add()` yolunun v2 hâli — kodda "V3 PHASED BATCH PIPELINE" olarak işaretli (`mem0/memory/main.py:915`) — sekiz fazlı, **tek LLM çağrılı** bir boru hattı:

```
messages
  │  Faz 0: son 10 mesajı SQLite'tan çek (db.get_last_messages, main.py:918-920)
  │  Faz 1: mesajları embed et → vector store'da top_k=10 benzer anı ara (main.py:923-930)
  │         UUID'ler 0,1,2… tamsayılarına eşlenir (main.py:933-938, "anti-hallucination")
  │  Faz 2: TEK LLM çağrısı — ADDITIVE_EXTRACTION_PROMPT (main.py:941-960)
  │         çıktı: {"memory": [{"text": ..., "attributed_to": ..., "linked_memory_ids": [...]}]}
  │  Faz 3: çıkarılan metinleri toplu embed (embed_batch, main.py:987-989)
  │  Faz 4-5: md5 hash ile yinelenen eleme (main.py:1005-1020)
  │  Faz 6: toplu insert + toplu history kaydı (main.py:1039-1075)
  │  Faz 7: varlık (entity) çıkarımı ve entity store'a bağlama (main.py:1077-1180)
  └  Faz 8: ham mesajları SQLite'a yaz, sonucu döndür (main.py:1183-1199)
```

Kritik mimari bilgi: bu boru hattının ürettiği **tek olay türü ADD'dir** (`main.py:1188`). Sistem promptu bunu açıkça söylüyor: "Your sole operation is ADD" (`mem0/configs/prompts.py:472`).

Depolama üç parçaya bölünmüş:
- **Vector store** — anının metni + payload'ı (`data`, `hash`, `created_at`, `user_id`/`agent_id`/`run_id`, `expiration_date`).
- **Entity store** — ayrı bir koleksiyon (`_entity_collection_name`, `main.py:422`); varlık metni + `linked_memory_ids` listesi. Graf veritabanı **değil**, ikinci bir vektör koleksiyonu.
- **SQLite** (`mem0/memory/storage.py`) — iki tablo: `history` (her yazma/silme olayının denetim kaydı, `storage.py:108-121`) ve `messages` (ham mesajlar, scope başına son 10 tanesi, `storage.py:134-145`).

## Klasör yapısı
```
mem0/
├── memory/
│   ├── main.py         Memory + AsyncMemory — tüm iş mantığı burada (3.868 satır)
│   ├── storage.py      SQLiteManager: history + messages tabloları, migration
│   ├── telemetry.py    PostHog anonim telemetri (varsayılan AÇIK)
│   ├── utils.py        prompt seçimi, mesaj düzleştirme, varlık çıkarımı
│   └── notices.py      kullanıcıya "platform sürümüne geç" bildirimleri (1.667 satır)
├── configs/
│   ├── prompts.py      ADDITIVE_EXTRACTION_PROMPT (aktif) + ölü kalmış eski promptlar
│   ├── llms/           14 sağlayıcı config'i (anthropic, gemini, ollama, vllm…)
│   └── vector_stores/  ~20 vector store config'i
├── llms/ embeddings/ vector_stores/ reranker/   adapter aileleri (factory ile seçilir)
├── proxy/main.py       OpenAI-uyumlu sarmalayıcı: anıyı otomatik prompt'a enjekte eder
└── client/             hosted platform (mem0.ai) HTTP istemcisi

server/                 FastAPI REST sunucusu + auth + dashboard (Next.js)
skills/                 Claude Code skill paketleri (mem0-cli, mem0-integrate…)
integrations/           n8n, Vercel AI SDK, Strands, Zapier vb. bağlayıcılar
tests/                  102 test dosyası
```

## Bellek modeli
Tek bir düz anı listesi + üç eksende **etiket** (scope): `user_id`, `agent_id`, `run_id` (`_build_filters_and_metadata`, `main.py:314`). Katman hiyerarşisi yok; "oturum belleği" ile "kalıcı profil" aynı tabloda, yalnızca hangi id'nin dolu olduğuyla ayrılıyor.

Ayrı bir tür olarak yalnızca **procedural memory** var (`_create_procedural_memory`, `main.py:1993`): `agent_id` ile çağrılır, konuşmanın tamamından tek bir "şu ana kadar ne yapıldı" özeti üretir (`PROCEDURAL_MEMORY_SYSTEM_PROMPT`, `prompts.py:326`).

Yinelenen eleme iki katmanlı: (1) LLM'e mevcut anılar gösterilip "semantik olarak aynıysa atla" deniyor (`prompts.py` ADDITIVE bloğu), (2) kod tarafında md5 hash eşleşmesi (`main.py:1012-1018`). İkinci katman yalnızca **birebir aynı metni** yakalar; ifade değişirse yeni anı yazılır.

**En önemli bulgu — v2'de UPDATE/DELETE kararı kaldırılmış.** `DEFAULT_UPDATE_MEMORY_PROMPT` (`prompts.py:176`) ve onu kullanan `get_update_memory_messages()` (`prompts.py:406`) hâlâ dosyada duruyor, ama repo genelinde **hiçbir yerden çağrılmıyor** (`grep -rn "get_update_memory_messages" --include=*.py` → yalnızca tanım satırı). Aynı şey `FACT_RETRIEVAL_PROMPT` için de geçerli: yalnızca `utils.py:31`'deki `get_fact_retrieval_messages_legacy` içinde, o da çağrılmıyor. Yani mem0'ın en çok bilinen özelliği olan "LLM eski anıyı görüp ADD/UPDATE/DELETE/NOOP'a karar verir" mekanizması bu sürümde **ölü koddur**; yerini yalnızca-ekleyen (append-only) bir boru hattı almıştır. Çelişen anılar artık birbirini ezmez, yan yana yaşar; `linked_memory_ids` ile ilişkilendirilir ama hangisinin geçerli olduğu okuma anında çözülmez.

**Graf belleği OSS'ten çıkmış.** v1'de `mem0/memory/graph_memory.py` vardı; bu klonda `mem0/` altında graf modülü yok (`find . -name "*graph*"` → yalnızca `examples/graph-db-demo/` notebook'u ve `exceptions.py:396`'da kuzu paketi için bir hata mesajı). `relations` alanı proxy'de hâlâ okunuyor (`proxy/main.py:182`) ama OSS `search()` bunu üretmiyor.

## Bağlam yönetimi
Görev sorusu: "bağlam penceresi dolunca ne oluyor?" mem0'ın cevabı: **mem0 bunu çözmez, çağıranın problemi olarak bırakır.** Kanıt:

- Repoda token sayan hiçbir şey yok: `grep -rn "tiktoken\|count_tokens\|token_limit" --include=*.py mem0/` → sıfır eşleşme (yalnızca LLM adapter'larındaki `max_tokens` yanıt sınırı ve reranker'ın `max_tokens: 100` ayarı çıkıyor).
- `search()` sabit sayıda anı döndürür: `top_k: int = 20` (`main.py:1383`), `threshold: float = 0.1`. Sınır **adet** cinsindendir, token cinsinden değil.
- Proxy, dönen anıların hepsini son kullanıcı mesajının içine düz metin olarak yapıştırır: `_format_query_with_memories` → `"- Relevant Memories/Facts: {memories_text}\n\n- Entities: {entities}\n\n- User Question: ..."` (`proxy/main.py:176-186`). Kırpma, önceliklendirme, bütçe yok.
- Yazma tarafında bağlam sabit ve küçük tutulmuş: LLM'e verilen geçmiş yalnızca son 10 mesaj (`db.get_last_messages(..., limit=10)`, `main.py:919`) ve top_k=10 mevcut anı (`main.py:926`). Geçmiş mesajlar prompt'a girerken 300 karakterde kesiliyor (`PAST_MESSAGE_TRUNCATION_LIMIT = 300`, `prompts.py:965`).
- SQLite `messages` tablosu scope başına yalnızca son 10 satırı tutar; fazlası her `save_messages` çağrısında silinir (`storage.py:281-292`).

Yani mem0'ın bağlam stratejisi "pencereyi yönet" değil, **"pencereye hiç girme"**: ham konuşma vektör katmanına hiç yazılmaz, yalnızca çıkarılmış kısa cümleler yazılır. Bu, taşmayı geciktirir ama kaldırmaz — 5.000 anısı olan bir kullanıcıda `top_k=20` isabetli değilse cevap sessizce kötüleşir; bunu ölçen bir mekanizma kodda yok. `rerank=True` (`main.py:1386`, `mem0/reranker/`) ikinci bir sıralama katmanı sunar ama varsayılan kapalıdır ve yine adet bazlıdır.

## Bellek yazma yetkisi ve güvenlik
**Kim yazar:** LLM. `add()` çağrıldığında hangi cümlenin anı olacağına tek LLM çağrısı karar verir (`main.py:951-960`) ve çıktı doğrudan kalıcılaşır — arada insan onayı, kural motoru veya şema doğrulaması yoktur. Uygulamanın tek kontrolü prompt üzerinden: `custom_instructions` / `prompt` parametresi (`main.py:944`) ve `includes`/`excludes` konu listeleri. Bunlar **öneri düzeyinde** kontrollerdir; promptun kendisi "custom_instructions: highest priority" der ama zorlayıcı bir mekanizma yoktur.

Deterministik kaçış yolu var: `infer=False` (`main.py:879-913`) LLM'i tamamen atlar, mesajı olduğu gibi anı olarak yazar. Yani "yazmaya kim karar verir" sorusunun cevabı çağrı başına seçilebilir: LLM (varsayılan) veya çağıran uygulama.

**Scope bir yetki sınırı değil, bir etikettir.** REST sunucusunda `POST /memories` kimlik doğrulaması ister (`_auth=Depends(verify_auth)`, `server/main.py:368`) ama `_auth` değişkeni kullanılmaz; `user_id` gövdeden gelir ve doğrulanmış kimlikle **karşılaştırılmaz** (`server/main.py:373-375`). Kimliği doğrulanmış herhangi bir çağıran, başka bir kullanıcının `user_id`'sine anı yazabilir veya (`POST /search` ile) okuyabilir. Ayrıca `AUTH_DISABLED` ortam değişkeni tüm doğrulamayı kapatan bir kaçış yolu bırakır (`server/auth.py:167-169`). Yalnızca `POST /reset` admin rolü ister (`server/main.py:548`).

**PII:** içerik tarafında **hiçbir** PII tespiti, maskeleme veya sınıflandırma yok. Tam tersi: varsayılan çıkarım promptu kendini "Personal Information Organizer" olarak tanımlar (`prompts.py:15`, `prompts.py:63`) ve kişisel olguları toplamayı görev edinir. Kodda geçen tek "sensitive" mekanizması telemetriye aittir: `_is_sensitive_field()` (`main.py:254`) yalnızca **config alan adlarını** (api_key, password, *_secret) redakte eder ki PostHog'a giden config kopyasında sızmasınlar (`_safe_deepcopy_config`, `main.py:270`). Anı metnine dokunmaz.

**Telemetri varsayılan açık.** `MEM0_TELEMETRY = os.environ.get("MEM0_TELEMETRY", "True")` (`telemetry.py:14`), sabit gömülü PostHog anahtarı ve `https://us.i.posthog.com` hedefi (`telemetry.py:15-16`), hot-path olayları %10 örneklemeyle, yaşam döngüsü olayları %100 (`telemetry.py:32,50-53`). Gönderilen alanlar `process_telemetry_filters` ile kodlanmış id'ler ve anahtar adlarıdır (`main.py:1191-1196`), anı metni değil — ama kapatmak için ortam değişkeni bilmek gerekir.

**Silme gerçek silme değil.** `_delete_memory()` vektörü siler, ancak silinen anının **metnini** `history` tablosuna `old_memory` olarak yazar ve satırı `is_deleted=1` ile işaretler (`main.py:2113-2122`). `history` için bir temizleme/rotasyon yolu kodda yok. GDPR "unutulma hakkı" senaryosunda `delete()` yeterli değildir; `reset()` (`main.py:2130`) veya doğrudan SQLite'a müdahale gerekir. Aynı şekilde `expiration_date` (`main.py:427`, `_payload_is_expired` `main.py:442`) **saklama süresi değil, görünürlük filtresidir**: süresi dolan anı `search`/`get_all` sonuçlarından gizlenir (`show_expired=True` ile geri gelir), diskten silinmez.

## RAG ve bilgi katmanı
mem0 klasik RAG değil: belge parçalama (chunking), yeniden çekme (ingestion) boru hattı, kaynak belgesi kavramı yok. Vektör araması yalnızca **LLM'in ürettiği kısa cümleler** üzerinde çalışır. Sonuç: kaynağa geri izlenebilirlik zayıf — anı metni yanlışsa hangi mesajdan türediği ancak `attributed_to` alanı ve son 10 mesaj penceresi kadar izlenebilir.

Arama tarafı melez: vektör benzerliği + BM25 için lemmatize edilmiş metin alanı (`text_lemmatized`, `main.py:1031`) + varlık eşleşmesine göre skor artırımı (`_compute_entity_boosts`, `main.py:1733`) + opsiyonel reranker (5 sağlayıcı). `explain=True` skor ayrıntısını döndürür (`main.py:1387`) — bu, "neden bu anı geldi" sorusuna cevap veren nadir bir özellik.

Bilgi katmanı (entity store) graf değil, düz bir varlık→anı id listesi eşlemesidir; ilişki türü (kim-kimin-nesi) taşımaz. Varlık birleştirme iki eşikli: birebir metin eşleşmesi veya vektör skoru ≥ 0.95 (`main.py:1155`).

## Ajan tasarımı
mem0 bir ajan çerçevesi değildir; ajanı yalnızca bir **id** olarak tanır (`agent_id`). Ajan sözleşmesi, yetenek tanımı, araç kavramı yok. `agent_id` dolu ve `user_id` boşsa çıkarım promptuna `AGENT_CONTEXT_SUFFIX` eklenir (`main.py:939-943`, `prompts.py:947`) — yani "ajanın kendisi hakkındaki olgular" ile "kullanıcı hakkındaki olgular" ayrı prompt'larla çıkarılır. Bu, çok-ajanlı bir sistemde "ajanın kendi öz-belleği" için kullanılabilecek küçük ama net bir ayrımdır.

## Hata yönetimi
- LLM çıkarımı hatası artık **yutulmuyor**: `raise LLMError(...)` (`main.py:962-969`); koddaki yorum eski davranışı ("sessizce `return []`") ve neden değiştirildiğini açıkça anlatıyor — çağıranın "LLM erişilemedi" ile "olgu çıkmadı" durumlarını ayırabilmesi için. Retry/fallback **çağırana** bırakılmış; mem0 içinde retry yok.
- JSON parse hatası iki aşamalı kurtarılıyor: `json.loads` → `extract_json()` regex kurtarması → boş liste (`main.py:971-983`).
- Toplu işlemlerin hepsinde "batch başarısız olursa tek tek dene" fallback'i var: embed (`main.py:991-1000`), insert (`main.py:1046-1053`), history (`main.py:1067-1075`).
- Varlık bağlama katmanı tamamen best-effort: en dıştaki `except Exception` yalnızca uyarı basar (`main.py:1179-1180`) — anı yazılır, varlık bağlantısı kaybolur. Sessiz kısmi başarı riski.
- Atomiklik yok: vector store insert ile SQLite history yazımı ayrı işlemlerdir; ikisi arasında çökme olursa anı vektörde vardır ama denetim kaydında yoktur.
- İnsan onayı kapısı: **yok**. Kodda hiçbir yazma yolunda onay bekleyen bir adım bulunmadı.

## Genişletilebilirlik
Yeni LLM/embedding/vector store/reranker eklemek iki dosyaya dokunur: `mem0/configs/<aile>/<ad>.py` + `mem0/utils/factory.py` kaydı. Adapter aileleri gerçekten geniş (14 LLM config'i, ~20 vector store). Çekirdek bozulmaz.

Bunun tersi çekirdek mantık için geçerli değil: bellek boru hattının kendisi `main.py` içinde 3.868 satırlık iki dev sınıfa (`Memory`, `AsyncMemory`) gömülü ve ikisi **birbirinin kopyası** (`_add_to_vector_store` sync `main.py:879`, async `main.py:2533` — aynı sekiz faz iki kez yazılmış). Boru hattına bir adım eklemek iki yerde aynı değişikliği yapmayı gerektirir; senkronizasyon kayması bu tasarımda zaman meselesidir.

## Güçlü yönler (kanıtlı)
- **Tek LLM çağrısı ile toplu çıkarım.** Eski tasarımda çıkarım + güncelleme kararı iki ayrı çağrıydı; v2'de tek çağrı (`main.py:951`) ve tüm embed/insert/history işlemleri toplu (`embed_batch`, `vector_store.insert(vectors=...)`, `batch_add_history`). Yazma maliyeti anı sayısından bağımsız hâle gelmiş.
- **UUID→tamsayı eşlemesi (`main.py:933-938`, kodda "anti-hallucination" yorumu).** LLM'e uzun UUID göstermek yerine "0,1,2" verilip dönüşte geri çevriliyor. Ucuz ve etkili bir halüsinasyon önlemi.
- **Değişmez denetim kaydı.** Her ADD/DELETE ayrı bir `history` satırı; `old_memory`/`new_memory`/`event`/`actor_id`/`role` alanlarıyla (`storage.py:108-121`). "Bu anı nereden geldi" sorusu cevaplanabilir.
- **Kimlik alanları metadata'dan yazılamaz.** `_strip_identity_keys` (`main.py:143`) çağıranın `metadata={"user_id": ...}` ile scope'u kaçırmasını engelliyor, uyarı basıyor. Küçük ama doğru bir sınır.
- **Şema migration'ı var.** `_migrate_history_table` (`storage.py:20-100`) eski tabloyu yeniden adlandırıp ortak sütunları kopyalıyor; sürüm yükseltmede veri kaybı yok.
- **`explain=True`** ile skor kırılımı döndürülüyor (`main.py:1387`) — geri getirme kalitesini hata ayıklanabilir kılıyor.

## Zayıf yönler (kanıtlı)
- **Çelişki çözümü yok.** Append-only tasarım (`prompts.py:472`) "Ali vegan" ve "Ali et yiyor" anılarını yan yana saklar; okuma anında hangisinin geçerli olduğunu belirleyen bir mekanizma (zaman ağırlıklandırma, geçersizleştirme) kodda yok. Yalnızca `created_at` payload'da durur, sıralamada kullanılmaz.
- **Ölü kod olarak duran eski mimari.** `DEFAULT_UPDATE_MEMORY_PROMPT` (150 satır) ve `FACT_RETRIEVAL_PROMPT` çağrılmıyor. README ve blog anlatısı hâlâ ADD/UPDATE/DELETE modelini anlatıyor — protokolün "README'ye güvenme" kuralının somut örneği.
- **Yetkilendirme scope'a bağlanmamış.** REST katmanında doğrulanmış kimlik ile gövdedeki `user_id` karşılaştırılmıyor (`server/main.py:368-375`); çok kiracılı kullanımda yatay yetki aşımı açık.
- **PII için hiçbir şey yok**, üstelik prompt aktif olarak kişisel bilgi toplamaya yönlendiriyor (`prompts.py:15`).
- **Silme kalıcı değil**; silinen metin `history.old_memory` içinde kalıyor (`main.py:2113-2122`), temizleme yolu yok.
- **Sync/async kod ikizlenmesi**: aynı 8 fazlı boru hattı `main.py`'de iki kez (satır 879 ve 2533).
- **Telemetri varsayılan açık** (`telemetry.py:14`) — kapalı ağda çalışan bir kurulumda bile PostHog'a bağlanmayı dener (0,5 sn timeout'lu feature flag isteği, `telemetry.py:17`).
- **Bağlam bütçesi kavramı yok**; adet bazlı `top_k` tek kontrol.

## Puan (1-5)
- olgunluk: 4 — 64k yıldız, 102 test dosyası, migration altyapısı, aktif geliştirme; ama v2 geçişi belgelenmemiş ölü kod bırakmış ve README kodla çelişiyor.
- mimari netlik: 3 — boru hattı fazları kodda numaralandırılmış ve okunaklı, fakat 3.868 satırlık `main.py` ve sync/async ikizlenmesi netliği düşürüyor.
- genişletilebilirlik: 4 — adapter ailelerine (LLM/embed/vector/reranker) yeni sağlayıcı eklemek iki dosya; çekirdek boru hattını genişletmek ise iki kopyayı birden değiştirmek demek.
- güvenilirlik ilkelleri: 3 — her toplu işlemde tek tek fallback ve açık hata yükseltme var; ama retry/checkpoint/atomiklik yok, varlık katmanı sessizce başarısız olabiliyor.
- gözlemlenebilirlik: 3 — `history` tablosu + `explain=True` skor kırılımı iyi; OpenTelemetry/trace yok, olan tek telemetri satıcıya gidiyor.
- güvenlik duruşu: 2 — kimlik alanlarının metadata'dan yazılamaması olumlu; ama scope yetki sınırı değil, PII kontrolü yok, silme kalıcı değil, telemetri varsayılan açık.

## Alınacak fikir
- **Yazma boru hattının fazlara bölünmesi ve tek LLM çağrısı** (`main.py:915-1199`) — bizim Memory Manager'ımızda "çıkarım" ile "kalıcılaştırma" arasını net ayırmak, LLM çağrısını tek noktaya hapsetmek maliyeti ve hata yüzeyini birlikte küçültür.
- **UUID→tamsayı eşlemesi** (`main.py:933-938`) — LLM'e kimlik gösterirken kısa yerel indeks verip dönüşte geri çevirmek; bizde ajan/görev id'lerini prompt'a koyduğumuz her yerde uygulanabilir, halüsinasyonu ucuza kesiyor.
- **`infer=False` kaçış yolu** (`main.py:879`) — "bu yazımı LLM yorumlamasın, aynen kaydet" seçeneği. Bizde deterministik olayların (görev tamamlandı, onay verildi) belleğe LLM'e sorulmadan yazılması için doğru desen.
- **Yazma olayının değişmez geçmiş kaydı** (`storage.py:108-121`, `main.py:2113-2122`) — her bellek mutasyonunun ayrı satır olması; bizde "bu bilgi belleğe nasıl girdi" sorusunun tek cevabı bu olmalı. Ancak silmenin metni koruması hatasını tekrarlamamak için `history`'de içerik değil **içerik hash'i + kaynak referansı** tutulmalı.
- **`explain=True` skor kırılımı** (`main.py:1387`) — geri getirmenin neden bu sonucu verdiğini döndürmek; değerlendirme ve hata ayıklama için ucuz, yüksek getirili.
- **Kimlik alanlarının metadata'dan yazılamaması** (`_strip_identity_keys`, `main.py:143`) — scope'u yalnızca çağrı parametresinden almak, metadata'dan gelen aynı adlı alanı uyarı basarak düşürmek. Bizde ajanın kendi scope'unu değiştirememesi için aynı sınır gerekli.

## Alınmayacak
- **Append-only bellek (çelişki çözümü olmayan)** (`prompts.py:472`) — otonom bir sistemde "kullanıcı X istiyor" ve "kullanıcı artık X istemiyor" anılarının ikisinin de geçerli sayılması doğrudan yanlış karar üretir. Bizde her anı için geçersizleştirme (supersedes) alanı ve okuma anında en güncelin seçilmesi zorunlu.
- **Scope'un yetki sınırı sayılmaması** (`server/main.py:368-375`) — `user_id`'nin çağıran tarafından serbestçe verilebilmesi. Bizde bellek okuma/yazma yetkisi Permission Manager'dan geçmeli, etiketle değil.
- **Varsayılan açık, satıcıya giden telemetri** (`telemetry.py:14-16`) — yerel çalışan bir ajan sisteminde kabul edilemez; varsayılan kapalı, açıksa hedefi kullanıcının seçtiği bir toplayıcı olmalı.
- **Sync ve async boru hatlarının elle ikizlenmesi** (`main.py:879` ve `main.py:2533`) — aynı mantığın iki kopyası; bizde tek uygulama + ince sarmalayıcı.
- **Silmenin içeriği geçmişte bırakması** (`main.py:2113-2122`) — "unutulma hakkı" ve kullanıcı güveni açısından zararlı; sil dediğimizde metin gitmeli.
- **`expiration_date`'in yalnızca görünürlük filtresi olması** (`main.py:442`) — saklama süresi (retention) gerçek bir silme işi tetiklemeli, aksi hâlde uyum (compliance) iddiası yanıltıcı olur.

## Matris cevapları
- saglayici_bagimsiz: evet — 14 LLM config'i (`mem0/configs/llms/`: anthropic, gemini, ollama, vllm, deepseek, xai, bedrock, azure…), ~20 vector store config'i, hepsi `mem0/utils/factory.py` üzerinden seçiliyor. Yalnızca `openai>=1.90.0` sabit bağımlılık olarak `pyproject.toml:20`'de duruyor (SDK olarak, zorunlu sağlayıcı olarak değil).
- sozlesme_var: kısmen — anı kaydının payload şeması kodda örtük (`data`, `hash`, `created_at`, scope alanları, `main.py:1024-1034`) ve REST katmanında Pydantic modelleriyle (`server/main.py`) makine-okur hâle geliyor; ancak "ajan sözleşmesi" anlamında bir şema yok, ajan yalnızca bir string id. Bu yüzden "kısmen".
- insan_kapisi: hayır — hiçbir yazma/silme yolunda onay adımı bulunmadı; `add()` LLM çıktısını doğrudan kalıcılaştırıyor (`main.py:1039-1064`), `delete()` doğrudan siliyor (`main.py:1869`). Tek kısmi kontrol `POST /reset` için admin rolü (`server/main.py:548`).
- checkpoint: hayır — durumdan devam etme kavramı yok; `add()` ortasında çökme olursa vektör ile SQLite arasında tutarsızlık kalır ve kurtarma yolu kodda yok. `history` tablosu denetim içindir, yeniden oynatma (replay) için değil.
