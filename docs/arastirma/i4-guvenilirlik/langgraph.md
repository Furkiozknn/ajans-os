# LangGraph

## Kimlik
langchain-ai/langgraph · 41.194 yıldız · 179 watcher · son push 2026-09-06 · MIT · Python · haftalık indirme: doğrulanmadı (PyPI'ye erişilmedi)
Sürüm (kodda doğrulandı): `libs/langgraph/pyproject.toml:7` → `version = "1.2.11"`; `libs/checkpoint/pyproject.toml:7` → `version = "4.2.0"`.
canlılık: geçti — arşivlenmemiş, son push 2026-09-06, klon HEAD `81bf17b` (2026-09-03).

İnceleme kapsamı: `libs/checkpoint/langgraph/checkpoint/base/__init__.py` (Checkpoint/CheckpointMetadata/BaseCheckpointSaver tam), `libs/checkpoint/langgraph/checkpoint/memory/__init__.py` (InMemorySaver — `put`/`put_writes`/`get_delta_channel_history` tam), `libs/checkpoint-postgres/langgraph/checkpoint/postgres/base.py` (SQL şema/migration), `libs/langgraph/langgraph/pregel/_loop.py` (SyncPregelLoop — checkpoint_pending_writes, durability, fork, `_reapply_writes_to_succeeded_nodes`), `libs/langgraph/langgraph/pregel/_algo.py` (prepare_next_tasks, apply_writes), `libs/langgraph/langgraph/pregel/_runner.py` (PregelRunner.tick/commit/_should_stop_others), `libs/langgraph/langgraph/pregel/_retry.py` (run_with_retry/arun_with_retry), `libs/langgraph/langgraph/_internal/_retry.py` (default_retry_on), `libs/langgraph/langgraph/types.py` (RetryPolicy, TimeoutPolicy, CachePolicy, Durability, interrupt()), `libs/langgraph/langgraph/errors.py`, `libs/langgraph/langgraph/channels/delta.py` (DeltaChannel), `libs/prebuilt/langgraph/prebuilt/tool_node.py` ve `interrupt.py` (kısmi), `libs/langgraph/langgraph/graph/state.py` (retry_policy parametreleri, kısmi).
Kapsam dışı (bakılmadı): `libs/sdk-py`, `libs/sdk-js`, `libs/cli`, `libs/checkpoint-conformance` (yalnızca varlığı doğrulandı), `libs/langgraph/langgraph/func/` (Functional API), `examples/`, subgraph/Send/Command mekaniğinin tam detayı, `libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py` (create_react_agent) yalnızca satır aranarak doğrulandı, içeriği okunmadı. `docs/` klasörü bu klonda yalnızca `llms.txt` ve `redirects.json` içeriyor — kavram belgeleri (muhtemelen ayrı bir `oss-docs` deposunda) bu klonda yok, incelenmedi.

## Çözdüğü problem
LLM ajanlarını bir Pregel-tarzı (Google'ın toplu-eşzamanlı graf hesaplama modeli) durum makinesi olarak çalıştırıp, her "superstep" sonunda durumu kalıcı bir checkpoint'e yazan bir çalışma zamanı. Hedef kitle: üretimde çöken/kesintiye uğrayan uzun süren ajan çalışmalarını kaldığı yerden devam ettirmek, insan onayı için duraklatmak (`interrupt`) ve zaman içinde geri gidip alternatif dallar denemek (time-travel) isteyen geliştiriciler. Çözdüğü acı: LLM çağrıları pahalı ve kırılgan olduğundan, bir düğüm ortasında ağ hatası/süreç çökmesi olduğunda tüm çalışmayı baştan tekrarlamak yerine yalnızca eksik kısmı yeniden yürütmek.

## Mimari
Çekirdek "Pregel" motoru (`libs/langgraph/langgraph/pregel/`) bir grafı düğüm (`PregelNode`) ve kanal (`BaseChannel`) kümesi olarak modelliyor; her superstep'te tetiklenen düğümler paralel çalıştırılıp yazdıkları değerler kanallara uygulanıyor (`_algo.py:apply_writes`). Checkpoint katmanı (`libs/checkpoint/`) bundan tamamen ayrı bir paket: `BaseCheckpointSaver` soyut arayüzünü sağlıyor, somut backend'ler ayrı paketler (`libs/checkpoint-sqlite`, `libs/checkpoint-postgres`).

Akış: `Pregel.stream()`/`invoke()` (`libs/langgraph/langgraph/pregel/main.py`) → `SyncPregelLoop`/`AsyncPregelLoop` (`_loop.py`) her superstep'te `prepare_next_tasks` (`_algo.py:392`) ile çalıştırılacak görevleri hesaplıyor → `PregelRunner.tick` (`_runner.py:176`) görevleri thread havuzunda paralel yürütüyor, her görev bittiğinde `commit()` çağrılıp `put_writes()` ile checkpointer'a yazılıyor → superstep sonunda `after_tick()` (`_loop.py:681`) tüm yazmaları kanallara uygulayıp (`apply_writes`) yeni bir tam checkpoint kaydediyor (`_put_checkpoint`).

```
invoke/stream
   │
   ▼
SyncPregelLoop.tick()  ──►  prepare_next_tasks (_algo.py)
   │                              │  hangi düğüm hangi kanaldan tetiklendi
   ▼                              ▼
PregelRunner.tick()  ──►  run_with_retry (her görev, kendi RetryPolicy'siyle)
   │  (ThreadPoolExecutor, her future ayrı)
   ├─ görev başarılı  → commit() → put_writes() (checkpointer'a delta yazı)
   ├─ görev hata      → commit() → put_writes(ERROR, exc)
   └─ görev interrupt → commit() → put_writes(INTERRUPT, value)
   │
   ▼
after_tick(): apply_writes() kanalları günceller → _put_checkpoint()
   (tam channel_values + channel_versions + versions_seen → checkpointer.put)
```

## Klasör yapısı
```
libs/
├── langgraph/langgraph/
│   ├── pregel/          çekirdek yürütme motoru: main.py (Pregel sınıfı, invoke/stream/
│   │                    update_state/get_state_history), _loop.py (superstep döngüsü,
│   │                    durability, fork), _runner.py (paralel görev yürütme, commit),
│   │                    _algo.py (görev hazırlama, kanal uygulama), _retry.py (retry/backoff)
│   ├── channels/        BaseChannel alt sınıfları (LastValue, Topic, BinaryOperatorAggregate,
│   │                    delta.py: DeltaChannel — yeni, beta)
│   ├── graph/           StateGraph builder (state.py: add_node, retry_policy, cache_policy)
│   ├── func/             "Functional API" (@task/@entrypoint) — incelenmedi
│   └── types.py          RetryPolicy, TimeoutPolicy, CachePolicy, Durability, interrupt(), Command
├── checkpoint/langgraph/checkpoint/
│   ├── base/__init__.py  Checkpoint TypedDict, BaseCheckpointSaver soyut arayüzü, put/put_writes
│   ├── memory/           InMemorySaver — referans/test implementasyonu
│   └── serde/            JsonPlusSerializer, EncryptedSerializer (checkpoint şifreleme)
├── checkpoint-sqlite/langgraph/checkpoint/sqlite/   SqliteSaver/AsyncSqliteSaver + _delta.py
├── checkpoint-postgres/langgraph/checkpoint/postgres/  Postgres şema (checkpoints/
│                                                        checkpoint_blobs/checkpoint_writes)
├── checkpoint-conformance/   backend'ler arası davranış uygunluk test paketi (incelenmedi)
├── prebuilt/langgraph/prebuilt/   ToolNode (handle_tool_errors), create_react_agent
└── cli/, sdk-py/, sdk-js/    incelenmedi
```

## Ajan tasarımı
LangGraph bir "ajan sözleşmesi" tanımlamıyor; ajan yalnızca bir `StateGraph` düğümüdür — Python fonksiyonu (`state -> dict`) veya Runnable. `libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py:278` `create_react_agent()` bir kısayol sağlıyor (LLM + tool listesi → hazır ReAct grafı) ama bu bir "ajan sınıfı" değil, StateGraph'ın önceden kurulmuş bir örneği. Yetenek/izin bildirimi yok; araç çağırma yetkisi doğrudan LLM'in `tools` argümanına verdiği listeye bağlı, `ToolNode` (`tool_node.py:622`) bunları çalıştırır.

## Orkestrasyon / iş akışı modeli
Graf tabanlı, Pregel (BSP — bulk synchronous parallel) modeli: her superstep'te tetiklenen tüm düğümler paralel çalışır, superstep sonunda tüm yazmalar tek seferde kanallara uygulanır (`_algo.py:apply_writes`, çağrıldığı yer `_loop.py:692`). Dinamik plan üretimi `Send` / `Command` primitifleriyle mümkün — bir düğüm çalışma anında yeni görevler (`Send(node, input)`) üretebilir, bu klasik statik DAG'dan farkı. Paralellik: aynı superstep'te tetiklenen bağımsız düğümler `ThreadPoolExecutor` üzerinde eşzamanlı koşuyor (`_runner.py:258-260`, `self.submit()`).

## Durum ve bellek
**Checkpoint modeli — tam snapshot + ayrı write-log melezi (Q1).** `Checkpoint` TypedDict (`libs/checkpoint/langgraph/checkpoint/base/__init__.py:93-124`) her superstep sonunda **tüm** kanalların o anki değerini (`channel_values: dict[str, Any]`) ve versiyonlarını (`channel_versions`) taşıyor — yani mantıksal olarak tam bir durum kopyası. Ama depolama seviyesinde bu tam kopya bile delta-benzeri optimize ediliyor: Postgres şemasında (`libs/checkpoint-postgres/langgraph/checkpoint/postgres/base.py:57-64`) `checkpoint_blobs` tablosu `(thread_id, checkpoint_ns, channel, version)` anahtarıyla **kanal başına, versiyon başına** bir blob satırı tutuyor; bir superstep'te değişmeyen kanal aynı `version`'ı referans ettiği için blob'u yeniden yazmıyor (yalnızca `checkpoints` tablosundaki JSONB `channel_versions` haritası o versiyona işaret etmeye devam ediyor). `InMemorySaver.put()` (`libs/checkpoint/langgraph/checkpoint/memory/__init__.py:421-464`) aynı deseni uyguluyor: `values = c.pop("channel_values")`, her `(thread_id, ns, kanal, versiyon)` için `self.blobs[...]` ayrı yazılıyor.

`put()` vs `put_writes()` ayrımı netleştirilmiş bir sözleşme: `put()` (`base/__init__.py:278`) superstep sonunda **tam checkpoint**'i kaydeder (yeni `Checkpoint` satırı + değişen kanal blob'ları); `put_writes()` (`base/__init__.py:301`) ise superstep **içinde**, her görev bittiğinde onun `(kanal, değer)` yazma listesini `task_id`'ye bağlı olarak kaydeder — Postgres'te `checkpoint_writes` tablosu (`base.py:66-73`, PK `(thread_id, ns, checkpoint_id, task_id, idx)`). Bunlar checkpoint'in kendisine değil, henüz kanal olarak "uygulanmamış" ara yazmalara karşılık gelir.

`pending_writes` (`CheckpointTuple.pending_writes`, `base/__init__.py:147`) bu `checkpoint_writes` satırlarının okuma anındaki karşılığı: bir superstep yarıda kesildiyse (görevlerden bazıları bitip yazdı, bazıları bitmedi/çöktü), süreç yeniden başladığında `checkpoint_pending_writes` (`_loop.py:252`) bu satırları belleğe yükler ve `_reapply_writes_to_succeeded_nodes()` (`_loop.py:733-745`) biten görevlerin yazmalarını doğrudan görev nesnesine geri koyar — bkz. Hata yönetimi bölümü.

**Yeni (beta) `DeltaChannel`** (`libs/langgraph/langgraph/channels/delta.py:25`) yukarıdaki modeli gerçek bir event-log'a yaklaştırıyor: büyüyen bir kanal (ör. mesaj geçmişi) her superstep'te tam değerini `channel_values`'a yazmak yerine yalnızca deltayı `checkpoint_writes`'a yazıyor, periyodik olarak (`snapshot_frequency`, varsayılan 1000, `delta.py:74`) tam bir `_DeltaSnapshot` blob'u üretiyor. `get_delta_channel_history()` (`base/__init__.py:583`, `InMemorySaver` implementasyonu `memory/__init__.py:142-220`) okuma anında en yakın snapshot'tan itibaren ata zincirini gezip deltaları biriktiriyor. Bu, "tam snapshot" modelinin O(mesaj sayısı) depolama maliyetini sınırlamak için eklenmiş — ama yalnızca `DeltaChannel` tipiyle işaretlenmiş kanallar için; varsayılan davranış hâlâ tam kopya.

**Rollback gerçek bir geri alma değil, fork (Q2).** `update_state()`/`bulk_update_state()` (`libs/langgraph/langgraph/pregel/main.py:1590-1780`) her zaman `checkpointer.put()` ile **yeni** bir checkpoint satırı yazar (`main.py:1729-1738`, `metadata={"source": "update", ...}`); eski checkpoint hiçbir zaman silinmez veya üzerine yazılmaz — yalnızca thread'in "en son" işaretçisi yeni checkpoint'e kayar. Eski bir `checkpoint_id` ile zaman-yolculuğu (time-travel) yapılıp graf tekrar çalıştırıldığında da aynı desen: `_loop.py:960-971`'deki yorum bunu açıkça belgeliyor — *"When time-traveling (replaying from a specific checkpoint), save a fork checkpoint so the replayed execution creates a new branch... the parent's latest checkpoint remains the old one"* — ve kod `self._put_checkpoint({"source": "fork"})` (`_loop.py:971`) ile yeni bir dal başlatıyor. Sonuç: **telafi (compensation) yoktur, yalnızca durum işaretçisi yeni bir dala (fork) yönlendirilir; eski checkpoint zinciri korunur, silinmez.** Bir düğümün yan etkileri (tool çağrısı, dış API'ye yazma, e-posta gönderme) checkpoint mekanizmasının hiçbir yerinde geri alınmaz — bu, kütüphanenin ele almadığı, kullanıcıya bırakılmış bir sorumluluktur (kodda telafi/saga birimi yok, `grep -rn "compensat" libs/langgraph/langgraph/` → sıfır eşleşme, doğrulandı). Ayrıca `interrupt()` sonrası devam ederken düğüm **baştan yeniden çalışır** (`types.py:864`, docstring: *"The graph resumes from the start of the node, re-executing all logic"*) — yani `interrupt`'tan önceki yan etkiler idempotent değilse resume'de tekrar tetiklenir.

## Hata yönetimi
**Retry (Q3).** `RetryPolicy` (`libs/langgraph/langgraph/types.py:418-437`): `initial_interval=0.5`, `backoff_factor=2.0`, `max_interval=128.0`, `max_attempts=3` (ilk deneme dahil), `jitter=True`, `retry_on=default_retry_on`. Varsayılan `retry_policy=None` — **hiçbir düğüm varsayılan olarak retry edilmez**; `add_node(..., retry_policy=...)` ile düğüm başına veya `StateGraph.compile(retry_policy=...)` ile grafa varsayılan olarak ayarlanır (`libs/langgraph/langgraph/graph/state.py:275-328`). Hangi hatalar retry edilir: `default_retry_on()` (`libs/langgraph/langgraph/_internal/_retry.py:1-29`) ağ hatalarını (`ConnectionError`, 5xx `httpx.HTTPStatusError`/`requests.HTTPError`) retry eder; `ValueError/TypeError/ArithmeticError/ImportError/LookupError/NameError/SyntaxError/RuntimeError/ReferenceError/StopIteration/OSError` gibi "programlama hatası" sınıflarını **retry etmez**; listede olmayan her şey varsayılan olarak retry edilir (`return True`, satır 29). Backoff hesaplaması `run_with_retry()` (`_retry.py:573-679`) içinde: `interval = min(max_interval, initial_interval * backoff_factor**(attempts-1))`, üzerine `jitter=True` ise `random.uniform(0,1)` eklenir.

**Paralel düğümlerden biri patlarsa tamamlananların işi kaybolmaz.** `PregelRunner.tick()` (`_runner.py:176-360`) her görevi ayrı bir future olarak `ThreadPoolExecutor`'a gönderiyor; her future tamamlandığında (başarı ya da hata fark etmeksizin) callback olarak `self.commit()` çağrılıyor (`_runner.py:189`, `weakref.ref(self.commit)`), ve `commit()` başarılı görevin yazmalarını **hemen** `put_writes()` ile checkpointer'a kaydediyor (`_runner.py:608-611`). Bir görev hata verdiğinde `_should_stop_others()` (`_runner.py:616-633`) `True` döner ve ana döngü yeni görev **beklemeyi** bırakır (`break`, `_runner.py:330-332`), ama zaten çalışmakta olan diğer future'lar zorla iptal edilmez; `futures.event.wait()` (`_runner.py:346-348`) onların `commit` callback'lerinin bitmesini bekleyip sonra istisnayı `_panic_or_proceed` ile yükseltir — yani **başarıyla tamamlanmış paralel görevlerin yazmaları kaybolmadan checkpointer'a işlenir.** Süreç bu noktada çökse bile (ör. process kill), bu yazmalar `checkpoint_writes` tablosunda (`pending_writes`) kalıcıdır. Süreç yeniden başlatıldığında `_reapply_writes_to_succeeded_nodes()` (`_loop.py:733-745`) bu pending_writes'ı okuyup ilgili görev nesnesine (`task.writes.append`) geri koyuyor; `main.py:2968`'deki `[t for t in loop.tasks.values() if not t.writes]` filtresi sayesinde **yazması zaten var olan görevler yeniden çalıştırılmıyor** — yalnızca çökme anında hiç tamamlanmamış görevler tekrar koşuyor. `ERROR`/`INTERRUPT` yazmaları bu geri-uygulamadan hariç tutuluyor (`_loop.py:746-747`, `if k in (ERROR, ERROR_SOURCE_NODE, INTERRUPT, RESUME): continue`) — böylece daha önce hata veren görev yeniden denenmeye (veya hata işleyiciye yönlendirilmeye) uygun kalıyor.

**Hata işleyici düğüm (error handler node)** — `_should_route_to_error_handler` / `schedule_error_handler` (`_loop.py:684-711`) bir düğüme bağlı hata işleyicisi varsa, hatayı `ERROR`/`ERROR_SOURCE_NODE` olarak checkpoint'e yazıp yeni bir görev olarak handler'ı zamanlıyor — bu bir tür yerleşik "fallback" düğümü, ama kullanıcı tarafından ayrıca tanımlanması gerekiyor (kod incelemesi düzeyinde tam API'si araştırılmadı, yalnızca `_loop.py` içindeki çağrı zinciri doğrulandı).

**Timeout.** `TimeoutPolicy` (`types.py:451-478`) `run_timeout` (sert duvar saati) ve `idle_timeout` (ilerleme sinyali olmadan geçen süre) ayrımı yapıyor; asyncio iptaline dayanıyor, senkron `time.sleep`/CPU-bound işlerde tetiklenmeyeceği açıkça belgelenmiş (`types.py:456-459`).

**Durability modları (Q4).** `Durability = Literal["sync", "async", "exit"]` (`libs/langgraph/langgraph/types.py:89`). Docstring (`main.py:2705-2711`): `"sync"` — bir sonraki adım başlamadan önce değişiklikler eşzamanlı kalıcılaştırılır (en güvenli, en yavaş); `"async"` (varsayılan, `_loop.py` çağrı yerlerinde `config.get(CONF,{}).get(CONFIG_KEY_DURABILITY,"async")`, `main.py:2603`) — değişiklikler bir sonraki adım çalışırken arka planda yazılır (gecikmeyi gizler, çok kısa bir pencerede checkpoint gecikebilir); `"exit"` — checkpoint yalnızca graf çıkışında yazılır (en hızlı, ama ara adımlarda süreç çökerse **hiçbir** ara superstep kalıcı olmaz — `_loop.py:1023,1324` bu modda pending_writes'ı belleğe hiç yazmadığını gösteriyor). Eski `checkpoint_during: bool` parametresi kullanımdan kaldırılmış, `durability`'ye eşleniyor (`main.py:2725-2735`: `True→"async"`, `False→"exit"`).

**Araç (tool) hataları.** `ToolNode.handle_tool_errors` (`libs/prebuilt/langgraph/prebuilt/tool_node.py:749-775`, varsayılan `_default_handle_tool_errors`, satır 383) bir aracın attığı istisnayı LLM'e okunabilir bir `ToolMessage` hatasına çeviriyor — grafı çökertmek yerine LLM'in hatayı görüp yeniden denemesine izin veren bir desen; bu retry değil, "hatayı konuşmaya geri besleme" (bir tür kaba self-correction girdisi).

## Genişletilebilirlik
Yeni düğüm eklemek tek dosyaya dokunur (`add_node` çağrısı); yeni checkpoint backend'i eklemek `BaseCheckpointSaver`'ı (sync+async, `get_tuple/list/put/put_writes/delete_thread/...`) implemente eden ayrı bir paket gerektirir — repo bunu üç kez yapmış (memory/sqlite/postgres), arayüz istikrarlı görünüyor. Yeni kanal tipi eklemek (`BaseChannel` alt sınıfı) çekirdek Pregel döngüsünü bozmadan mümkün — `DeltaChannel`'ın ayrı bir dosyada (`channels/delta.py`) eklenmiş olması buna kanıt. Retry/timeout/cache politikaları düğüm başına parametre olarak geçiliyor, merkezi bir kayıt dosyası değiştirmeyi gerektirmiyor.

## Güçlü yönler (kanıtlı)
- **Tamamlanan paralel iş kaybolmuyor.** Her görevin yazması bittiği anda (superstep sonunu beklemeden) `put_writes()` ile kalıcılaşıyor (`_runner.py:608-611`), resume'de `not t.writes` filtresiyle (`main.py:2968`) yeniden çalıştırılmıyor (`_loop.py:733-745`). Bu, çoğu "checkpoint = tam superstep sonu" tasarımının kaçırdığı bir dayanıklılık ilkesi.
- **Durability ödünleşimi kullanıcıya açık ve üç kademeli** (`types.py:89`, `main.py:2705-2711`) — "sync" ile "exit" arasında bilinçli bir hız/güvenlik seçimi yapılabiliyor.
- **Retry hangi hataların "programlama hatası" (retry edilmez) vs "geçici/ağ hatası" (retry edilir) olduğunu ayırt eden bir varsayılan sınıflandırma sunuyor** (`_internal/_retry.py:1-29`) — kör "her şeyi retry et" değil.
- **Fork tabanlı time-travel açıkça belgelenmiş ve kasıtlı**: `_loop.py:960-971`'deki yorum, tasarım kararını ve önceki bir hatayı ("parent'ın son checkpoint'i eski kalırdı") anlatıyor — bu, kod tabanının kendi geçmiş hatasından ders çıkardığının izlenebilir kanıtı.
- **Postgres şeması checkpoint/blob/write ayrımını normalize etmiş** (`checkpoint-postgres/.../base.py:47-73`) — değişmeyen kanallar yeniden yazılmıyor, depolama büyümesi kanal-versiyon bazında kontrol ediliyor.

## Zayıf yönler (kanıtlı)
- **Yan etkiler hiç geri alınmıyor.** Rollback yalnızca durum işaretçisini forklar; bir düğümün yaptığı dış API çağrısı, DB yazımı veya e-posta gönderimi checkpoint mekanizmasının kapsamı dışında — telafi (saga/compensation) birimcik yok (`grep -rn "compensat"` → 0 eşleşme).
- **`interrupt()` sonrası düğüm baştan yeniden çalışıyor** (`types.py:864` docstring) — düğüm içinde `interrupt`'tan önce yan etkili (non-idempotent) kod varsa, resume'de tekrar tetiklenir; kütüphane bunu önleyen bir mekanizma sunmuyor, sorumluluk kullanıcıya bırakılmış.
- **Birinci sınıf evaluator/critic/reflection deseni yok.** `interrupt()` yalnızca insan onayı primitifi; "bir ajanın çıktısını değerlendirip düzelten ikinci bir ajan" deseni kütüphanede modellenmemiş — kullanıcı bunu sıradan bir graf düğümü + koşullu kenar olarak kendisi kurmak zorunda. `libs/prebuilt/langgraph/prebuilt/interrupt.py`'deki `HumanInterruptConfig`/`ActionRequest` gibi insan-onayı yardımcı tipleri bile bu depodan `langchain.agents.interrupt`'a taşınmış ve burada yalnızca `@deprecated` sarmalayıcı olarak duruyor (`interrupt.py:7-11`) — HITL şablonlarının bakımı kısmen bu repodan çıkmış.
- **Retry varsayılan kapalı.** `retry_policy=None` varsayılan (`graph/state.py:106`) — kullanıcı elle açmazsa hiçbir düğüm retry edilmiyor; "üretime hazır varsayılan" beklentisiyle çelişir.
- **`durability="exit"` modunda ara superstep'ler kalıcı değil** — hız için seçilirse, süreç ortada çökerse tüm ilerleme kaybolur (dokümante edilmiş bir ödünleşim, ama kolayca yanlış seçilebilecek bir varsayılan-değiştirme).
- **`DeltaChannel` beta ve budama (prune) ile kırılgan etkileşimi belgelenmiş bir risk**: `base/__init__.py:377-407`'deki `prune()` docstring'i, naif "keep_latest" stratejisinin delta zincirini sessizce kırıp boş veri döndürebileceğini (hata fırlatmadan) açıkça uyarıyor — kütüphanenin kendisi bunu "dikkatli implement et" diyerek kullanıcıya devrediyor.

## Puan (1-5)
- olgunluk: 5 — 41k yıldız, çok sayıda backend paketi (memory/sqlite/postgres), ayrı bir `checkpoint-conformance` uygunluk test paketi, 51 test dosyası (`libs/langgraph/tests`), sürüm 1.2.11 (çekirdek) — üretimde kanıtlanmış, LangGraph Platform üzerinden ticari olarak da işletiliyor.
- mimari netlik: 4 — Pregel/checkpoint/prebuilt paket ayrımı temiz, `put` vs `put_writes` sözleşmesi net; ama `_loop.py` ve `main.py` çok büyük dosyalar (2000+ satır) ve `is_time_traveling`/`is_replaying`/`exiting` gibi durum bayrakları arasındaki etkileşim kod okumadan çıkarılması zor.
- genişletilebilirlik: 4 — yeni checkpoint backend'i veya kanal tipi net bir arayüzle eklenebiliyor (kanıt: üç ayrı backend, `DeltaChannel`'ın ayrı dosyada eklenmiş olması); düğüm/retry/timeout/cache eklemek tek çağrı.
- güvenilirlik ilkelleri: 4 — retry+backoff+jitter, checkpoint+pending_writes ile kısmi-superstep kurtarma, üç kademeli durability, timeout policy hepsi kodda çalışır durumda; eksik olan yalnızca telafi/saga ve birinci sınıf evaluator deseni (bu puanı 5'ten indiren neden).
- gözlemlenebilirlik: 3 — `debug.py`/`map_debug_tasks` ile adım bazlı olay akışı var, `get_state_history` tam checkpoint geçmişini gösteriyor; ama OpenTelemetry/trace entegrasyonu bu klasörlerde görülmedi (incelenmedi, doğrulanmadı), yerleşik metrik/log standardizasyonu yok.
- güvenlik duruşu: 3 — `EncryptedSerializer` (`checkpoint/serde/encrypted.py`, var olduğu doğrulandı, içeriği okunmadı) checkpoint şifreleme seçeneği sunuyor; ama tool/düğüm izin modeli, sandboxing veya kimlik doğrulama kütüphanenin kapsamında değil — bu bilinçli bir kapsam dışı bırakma (orkestrasyon katmanı, güvenlik katmanı değil).

## Alınacak fikir
- **`put()` (tam checkpoint) / `put_writes()` (görev bazlı ara yazma) ayrımı** (`base/__init__.py:278,301`) — bizim Task Runner'ımızda "superstep sonu durumu" ile "görev bazlı ilerleme" ayrı yazılırsa, bir görev grubunun ortasında çökme olduğunda tamamlananları kaybetmeyiz. Doğrudan uygulanabilir desen.
- **`not t.writes` filtresiyle tamamlanmış görevleri resume'de atlama** (`main.py:2968`, `_loop.py:733-745`) — kaldığı yerden devam etmenin somut mekanizması budur; bizde de "bu görev için zaten bir sonuç kaydı var mı" kontrolü tek bir yerde (görev zamanlayıcı girişinde) yapılmalı.
- **Üç kademeli durability (`sync`/`async`/`exit`)** (`types.py:89`) — hız/güvenlik ödünleşimini kullanıcıya açık bir parametre olarak sunmak; bizde varsayılanın en güvenli tarafta (`sync`'e yakın) olması, hız isteyenin bilinçli olarak gevşetmesi gerekir.
- **`default_retry_on`'daki hata sınıflandırması** (`_internal/_retry.py:1-29`) — "programlama hatası" (retry etmeye değmez) ile "geçici/ağ hatası" (retry et) ayrımını açık bir liste olarak tutmak; bizim retry katmanımızda kör retry yerine bu ayrımı uygulamalıyız.
- **Fork-tabanlı time-travel + `parents` haritası** (`CheckpointMetadata.parents`, `base/__init__.py:57-61`; `_loop.py:960-971`) — geri alma yerine dallandırma: eski durumu koruyup yeni bir dal açmak, hem denetlenebilirlik hem de "birden fazla alternatifi paralel dene" senaryosu için bizim checkpoint modelimize uygun bir birincil desen olmalı.
- **`prune()` uyarısının kendisi** (`base/__init__.py:377-407`) — bir depolama optimizasyonu (delta/event-log) eklerken budama stratejisinin bu optimizasyonla etkileşimini **açıkça belgelemek**; bizde de herhangi bir "yalnızca son N'i tut" temizliği eklenirse, bağımlı zincirleri kırmadığından emin olunmalı ve bu belgelenmeli.

## Alınmayacak
- **Yan etkiler için telafi mekanizması yokluğu** — bunu örnek almayacağız, tam tersi: bizim güvenilirlik ilkelerimizde araç çağrısı gibi geri alınamaz eylemler için ya idempotency-key ya da açık bir telafi adımı zorunlu olmalı; LangGraph'ın "kullanıcıya bırak" tavrı bizim İ4 hedefimizle (arıza kurtarma) doğrudan çelişir.
- **`interrupt()` sonrası düğümün baştan yeniden çalışması** (`types.py:864`) — bizde insan onayı bekleyen bir adımdan sonra devam ederken, onay öncesi yapılan yan etkili işlemlerin tekrar tetiklenmemesi gerekir; bu, LangGraph'ın bilinçli olarak basit tuttuğu ama bizim için kabul edilemez bir nokta.
- **Retry'nin varsayılan kapalı olması** — kütüphane düzeyinde makul bir seçim (kullanıcı düğüm bazında karar versin) ama bizim orkestratörümüzde ağ çağrısı yapan her görev için retry varsayılan **açık** olmalı; LangGraph'ın "opt-in" modelini birebir kopyalamayacağız.
- **DeltaChannel'ın beta/kırılgan prune etkileşimi** — kavram (event-log + periyodik snapshot) alınacak ama LangGraph'ın implementasyonunu (henüz "budama ile birlikte güvenli değil" uyarısı taşıyan) doğrudan taşımayacağız; kendi event-log tasarımımızda budama stratejisini baştan event-log'a göre tasarlayacağız.
- **`create_react_agent` gibi hazır ajan şablonları** — incelenmedi/derinlemesine değerlendirilmedi, bu yüzden ne alınacak ne alınmayacak listesine kanıtla giremez; ayrı bir turda değerlendirilmeli.

---
saglayici_bagimsiz: evet — çekirdek Pregel/checkpoint katmanı hiçbir LLM sağlayıcısına bağlı değil; `create_react_agent` bir `Runnable`/model nesnesi kabul ediyor (LangChain'in model soyutlaması üzerinden), incelenen dosyalarda sağlayıcıya özel sabit kod görülmedi.
sozlesme_var: kısmen — `Checkpoint`/`CheckpointMetadata` (TypedDict) ve `BaseCheckpointSaver` arayüzü makine-okur ve istikrarlı bir sözleşme; ama "ajan" için (yetenek/girdi-çıktı/izin) herhangi bir şema yok, düğüm yalnızca bir Python callable'ı — bu yüzden "kısmen".
insan_kapisi: evet — `interrupt()` (`types.py:851`) ve `Command(resume=...)` ile grafı duraklatıp insan girdisi bekleme birinci sınıf, checkpointer zorunluluğuyla belgelenmiş bir mekanizma (`types.py:869`).
checkpoint: evet — `BaseCheckpointSaver` + üç backend (memory/sqlite/postgres) ile durumdan devam etme tam olarak çalışıyor; `pending_writes` ile kısmi-superstep kurtarma da dahil (bkz. Hata yönetimi).
