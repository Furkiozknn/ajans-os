# Temporal Python SDK

## Kimlik
temporalio/sdk-python · 1.178 yıldız · 21 watcher · son push 2026-09-05 · MIT · Python · haftalık PyPI indirme: doğrulanmadı
Sürüm (kodda doğrulandı): `pyproject.toml:3` → `version = "1.32.0"`, `requires-python = ">=3.10"` (`pyproject.toml:6`).
canlılık: geçti — arşivlenmemiş, son push 2026-09-05, klon HEAD `22a9e41` (2026-09-04), 190 test dosyası (`tests/`).

**ÖNEMLİ KAPSAM UYARISI:** Temporal'ın durum motoru (event history, replay kararı, timer/retry zamanlayıcı, non-determinism tespiti) **sunucu tarafındadır ve Go ile yazılmıştır**; bu klonda yok. Bu klonda ayrıca Rust SDK-Core (`temporalio/bridge` altındaki Python arayüzünün arkasındaki asıl motor, bu depoda yalnızca derlenmiş/`*.pyi` arayüz olarak var, Rust kaynağı yok) da yer almıyor. Bu analiz yalnızca Python SDK'sını (etkinleştirme/komut üretme katmanı) ve `temporalio/api/**` altındaki proto tanımlarını kapsar. Sunucu/core tarafı davranışı olarak yazılan her cümle proto veya SDK yorumuna dayanır; dayandırılamayan yerlerde açıkça "SDK'dan doğrulanamadı" yazıldı.

**İnceleme kapsamı:** `temporalio/exceptions.py` (486 satır, tamamı), `temporalio/common.py` (RetryPolicy, ~130 satır), `temporalio/activity.py` (Info sınıfı, `heartbeat()`), `temporalio/worker/_activity.py` (1125 satır, tamamı), `temporalio/worker/_workflow_instance.py` (4023 satır — `activate()`, `_apply_resolve_activity`, `workflow_patch` bölümleri okundu, satır satır tamamı taranmadı), `temporalio/worker/_replayer.py` (nondeterminism eviction kısmı), `temporalio/workflow/_context.py` (`now`, `time`, `patched`, `deprecate_patch`), `temporalio/workflow/_exceptions.py` (tamamı), `temporalio/workflow/_activities.py` (ActivityConfig, timeout parametreleri), `temporalio/worker/_interceptor.py` (StartActivityInput/ExecuteActivityInput), `temporalio/client/_client.py` (start_workflow imzası — retry_policy, execution_timeout docstring'i), `temporalio/api/common/v1/message_pb2.pyi` (RetryPolicy proto), `temporalio/api/failure/v1/message_pb2.pyi` (Failure/ApplicationFailureInfo proto), `tests/worker/test_workflow.py` içinde patch/heartbeat/cancel örnekleri (grep ile hedefli). **Okunmadı:** `temporalio/bridge/` (Rust köprüsünün Python tarafı, C-extension arayüzü — event history / komut kuyruğu asıl mantığı burada değil, derlenmiş core'da), `temporalio/nexus/`, `temporalio/contrib/`, `temporalio/testing/` (zaman-hızlandırma test ortamı), `scripts/`, proto'ların `.proto` kaynak dosyaları (bu klonda yalnızca üretilmiş `*_pb2.py`/`*_pb2.pyi` var, `.proto` kaynağı yok — `find . -iname "*.proto"` boş sonuç verdi).

## Çözdüğü problem
Uzun süren (saatler, günler, aylar) iş akışlarını, süreç çökse/worker öldürülse/deploy edilse bile kaldığı yerden doğru şekilde devam ettirmek. Hedef kitle: para transferi, sipariş orkestrasyonu, insan onayı bekleyen süreç gibi "hatasız bitmeli" iş akışı yazan backend geliştiricisi. Çözdüğü acı: bu tür süreçleri elle yazınca her adımda "DB'ye durum yaz, hata olursa oku, kaldığın yerden devam et" boilerplate'i tekrar tekrar yazılır ve genelde eksik/hatalı olur; Temporal bunu dile (Python `async`/`await`) gömülü, otomatik olarak dayanıklı hâle getirir.

## Mimari
İki taraflı bir sistem: **worker süreci** (bu SDK'nın çalıştığı yer) durum taşımaz, yalnızca sunucudan gelen "activation" (uygulanacak iş listesi) alır, workflow kodunu bir kez ileri sarar, üretilen "command"ları geri gönderir. **Sunucu** (bu depoda yok) event history'yi tutar, zamanlayıcıları (timer/retry) işletir, hangi worker'ın hangi activity'yi çalıştıracağına karar verir.

```
Sunucu (Go, bu klonda YOK)
  │  event history (immutable log) ──┐
  │                                   ▼
  │  WorkflowActivation (bridge/proto/workflow_activation) ──► _workflow_instance.py: activate()
  │                                                                  │
  │                                                    _apply() her job'ı işler
  │                                                    (sinyal/update/patch/activity-sonucu/timer)
  │                                                                  │
  │                                                     workflow kod'u BİR KEZ ileri sarılır
  │                                                     (coroutine resume, I/O yok)
  │                                                                  │
  │  ◄── WorkflowActivationCompletion (commands: start_activity, ...) ┘
  │
  │  ActivityTask ──► worker/_activity.py: _handle_start_activity_task() ──► kullanıcı fonksiyonu ÇALIŞTIRILIR
  │  ◄── ActivityTaskCompletion / heartbeat
```

Aktiviteler her denemede gerçekten **çalıştırılır** (yan etkili kod, örn. HTTP çağrısı); workflow kodu ise replay sırasında **çalıştırılmaz**, yalnızca geçmiş sonuçlar coroutine'e enjekte edilerek aynı kod yolu tekrar yürütülür (bkz. "Durum modeli").

## Klasör yapısı
```
temporalio/
├── worker/
│   ├── _workflow_instance.py   4023 satır — activate()/_apply()/replay/patch — çekirdek etkinleştirme döngüsü
│   ├── _activity.py            1125 satır — activity çalıştırma, heartbeat gönderimi, iptal
│   ├── _replayer.py            geçmiş event history'yi worker olmadan yeniden oynatma (test/debug aracı)
│   └── _worker.py              worker süreç döngüsü, task queue polling
├── workflow/
│   ├── _context.py             now(), time(), patched(), deprecate_patch(), random() — determinizm sarmalayıcıları
│   ├── _activities.py          start_activity/execute_activity, ActivityConfig (timeout aileleri)
│   ├── _sandbox.py             workflow.unsafe.is_replaying() vb.
│   └── _exceptions.py          NondeterminismError, ReadOnlyContextError
├── exceptions.py               ApplicationError, ActivityError, ChildWorkflowError, RetryState, TimeoutType
├── common.py                   RetryPolicy (kullanıcı tarafı dataclass) + proto dönüşümü
├── client/_client.py           start_workflow (retry_policy, execution_timeout, cron_schedule)
├── api/**                      sunucu proto sözleşmesi (generated *_pb2.py/*_pb2.pyi, .proto kaynağı yok)
└── bridge/                     Rust core'a Python arayüzü (okunmadı — asıl motor burada değil, C-extension'da)
tests/worker/test_workflow.py   ~8300+ satır, patch/heartbeat/cancel/retry davranışlarının canlı örnekleri
```

## Ajan tasarımı
Kapsam dışı — Temporal bir çoklu-ajan çerçevesi değil, genel amaçlı dayanıklı yürütme motoru. "Ajan" kavramı yok; workflow ve activity fonksiyonları `@workflow.defn`/`@activity.defn` dekoratörleriyle tanımlanır (`temporalio/workflow/_definition.py` — incelenmedi, yalnızca dekoratör isimleri `workflow/__init__.py` export listesinden doğrulandı).

## Orkestrasyon / iş akışı modeli
Kod-öncelikli (code-first): workflow bir Python coroutine'idir, DAG veya YAML tanımı yok. Paralellik `asyncio.gather`/`asyncio.wait` ile ifade edilir (workflow'un kendi event loop'u `_workflow_instance.py` içinde, gerçek I/O'suz, deterministik olarak koşar — ayrıntısı okunmadı, yalnızca `activate()`/`_run_once` çağrı zinciri doğrulandı, `temporalio/worker/_workflow_instance.py:448-604`).

## Durum ve bellek

**Temporal checkpoint almaz, event history'yi replay eder.** Bu, protokolün istediği en kritik ayrımdır ve kodda doğrudan görülebilir:

`temporalio/worker/_workflow_instance.py:448` — `activate()` metodu her çağrıldığında `self._is_replaying = act.is_replaying` (satır 468) ile sunucudan gelen bayrağı okur. Bu, "şu an gerçek zamanlı mı yoksa geçmişi tekrar mı oynatıyorum" bilgisinin **tek kaynağıdır** — worker kendi başına bunu bilemez, sunucu söyler.

`temporalio/worker/_workflow_instance.py:606-644` (`_apply`) — activation içindeki her `job` (sinyal, timer ateşlemesi, activity sonucu, patch bildirimi...) sırayla işlenir; ardından `_run_once` çağrılarak workflow coroutine'i **tek adım ileri sarılır**. Workflow kodunun kendisi её activation'da baştan çalıştırılır (Python fonksiyon çağrısı anlamında değil — coroutine suspend/resume anlamında): ilk çalıştırmada `await workflow.execute_activity(...)` satırına gelindiğinde coroutine askıya alınır, sonraki activation'da execute_activity'nin sonucu hazırsa kaldığı yerden devam eder.

**Activity sonucu yeniden hesaplanmaz, okunur — bu, "event log ile immutable snapshot" farkının somut kanıtıdır:** `temporalio/worker/_workflow_instance.py:875` (`_apply_resolve_activity`). Bu fonksiyon bir `ResolveActivity` job'ı aldığında activity'yi **tekrar çalıştırmaz**; `job.result.completed.result` alanındaki (event history'den gelen, önceden kaydedilmiş) payload'ı deserialize edip (satır 895-903) bekleyen future'a `handle._resolve_success(ret)` ile enjekte eder (satır 906). Başarısızlık da aynı şekilde `job.result.failed.failure`'dan okunur (satır 907-911). Yani: **activity kodu yalnızca gerçek zamanlı çalıştırıldığında (worker'da `_execute_activity`) yan etkisini üretir; replay sırasında workflow tarafı yalnızca "sonuç neydi" sorusuna event history'den cevap alır.** Bu, mem0 tarzı bir "checkpoint dosyası" değil — tüm event history'nin (her karar, her sonuç) sırayla tekrar uygulanmasıdır; snapshot yoktur, yeniden oynatılan bir loglar dizisi vardır.

Determinizm sarmalayıcıları — workflow kodunun `datetime.now()`, `random.random()`, `time.sleep()` gibi doğrudan sistem çağrıları kullanması replay'i bozar (aynı kod, replay anında farklı gerçek saatte çalıştığı için farklı sonuç üretir). SDK bunun yerine deterministik sürümler sağlar:
- `temporalio/workflow/_context.py:749` — `now()`: gerçek `datetime.now()` değil, `_Runtime.current()` üzerinden **workflow'un mevcut activation zaman damgasından** türetilir (`time()` çağrısı üzerinden, satır 850: `def time() -> float: return time_ns() / 1e9`, ki bu da activation'daki `act.timestamp`'e dayanır — `_workflow_instance.py:466`: `self._time_ns = act.timestamp.ToNanoseconds()`). Replay'de bu zaman damgası event history'den gelir, gerçek saatten değil; bu yüzden replay her seferinde aynı `now()` değerini üretir.
- `temporalio/workflow/_context.py` — `random()`: deterministik seed'li `Random` nesnesi döner (docstring: "deterministically-seeded pseudo-random number generator").

**Determinizm kırılırsa ne olur:** Asıl kontrol (üretilen komutların event history'deki kayıtlarla eşleşip eşleşmediği) sunucu/core tarafındadır — bu SDK'da doğrulanamadı. Python tarafı yalnızca sonucu yüzeye çıkarır: `temporalio/worker/_replayer.py:224-229` — worker cache'den tahliye edilirken (`RemoveFromCache`) sebep `EvictionReason.NONDETERMINISM` ise `temporalio.workflow.NondeterminismError(remove_job.message)` fırlatılır. Hata sınıfı `temporalio/workflow/_exceptions.py:17` — `class NondeterminismError(temporalio.exceptions.TemporalError)`, tek satır docstring: "Error that can be thrown during replay for non-deterministic workflow." Sunucu tarafında bu hatanın workflow task'ı sürekli fail ettirip etmediği (retry loop'a mı girdiği) bu klondan doğrulanamadı.

**Versioning / patching — "kodu değiştirince eski çalışan işler ne olur" sorusunun cevabı:**
- `temporalio/workflow/_context.py:762` (`patched(id)`) — mevcut kodda hem eski hem yeni dal tutulur; fonksiyon "yeni dalı mı almalı" sorusuna cevap verir. Gerçek karar mekanizması `temporalio/worker/_workflow_instance.py:1441` (`workflow_patch`): eğer replay yapılıyorsa ve bu patch daha önce bu run'da görülmemişse (`id in self._patches_notified` değilse) `use_patch = False` döner — yani **event history'de bu patch marker'ı yoksa, eski kod yolu zorlanır**, kod tabanında yeni yol aktif olsa bile. Yeni (replay olmayan) çalıştırmalarda `use_patch = True` ve bir `set_patch_marker` komutu event history'ye yazılır (satır 1466-1467).
- `temporalio/workflow/_context.py:553` (`deprecate_patch(id)`) — eski dalın artık hiç sorgulanmayacağı garantilendiğinde eski kod yolu tamamen kaldırılabilir; docstring: "This marks a workflow that had patched in a previous version of the code as no longer applicable... the old code path is removed as well."
- Canlı örnek: `tests/worker/test_workflow.py:3391-3398` — `PatchWorkflow.run()` içinde `if workflow.patched("my-patch"): self._result = "post-patch" else: self._result = "pre-patch"`; `tests/worker/test_workflow.py:3401-3406` — `DeprecatePatchWorkflow.run()` içinde `workflow.deprecate_patch("my-patch")`.

**Bellek katmanı yok, kalıcı durum yok.** Bu bir "bellek" ürünü değil; workflow'un tüm "durumu" Python coroutine'inin yerel değişkenleridir ve her activation'da event history'den yeniden inşa edilir (replay). Uygulama tarafı bir veri saklamak istiyorsa bunu `workflow.execute_activity` ile dış bir depoya (DB) yazmak zorundadır — SDK bunun için bir soyutlama sunmaz.

## Hata yönetimi

### 1) ROLLBACK — motor otomatik geri almaz, telafi (compensation) elle yazılır
Bu klonda `saga`, `compensat`, `undo` kelimeleriyle **hiçbir eşleşme yok** (`grep -rin "saga\|compensat\|undo\b" --include=*.py .` → sıfır sonuç; tek "rollback" eşleşmesi `tests/nexus/test_temporal_operation.py:1023`'teki `FailedStartRollbackWorkflowCaller` sınıfıdır, ki bu Nexus operasyon **başlatma** başarısızlığında sunucunun kendi tekilleştirme/idempotency davranışını test eder — bir kullanıcı telafi deseni değildir). Yani **SDK'da veya `tests/` altında elle yazılmış bir saga/compensation örneği yok** — protokolün istediği "var mı yok mu" sorusunun cevabı: **yok**, bu klonda.

Bunun yerine iptal (`cancel`) mekanizması var, ki telafi kalıbının üzerine inşa edildiği yapı budur: `tests/worker/test_workflow.py:910-929` — `ActivityWaitCancelNotify.wait_cancel` activity'si `try: ... except asyncio.CancelledError: ... finally: self.wait_cancel_complete.set()` deseniyle iptali yakalar ve `finally` bloğunda temizlik yapar. Bu, standart Python `try/finally` dışında Temporal'a özgü bir "otomatik geri alma" API'si **olmadığının** kanıtıdır — geliştirici kendi `finally`/`except CancelledError` bloğunda, isterse bir telafi activity'si çağırarak (`await workflow.execute_activity(compensate, ...)`) geri almayı elle yazar. Bu deponun kendisinde böyle bir *workflow seviyesinde* telafi örneği bulunmadı; yalnızca activity seviyesinde iptal temizliği örneği var.

**Sonuç, açıkça:** geri alma = telafi aktivitesi, ve bu SDK'da bunu **motor değil geliştirici** yazar; motorun sağladığı tek şey iptal sinyalinin (`CancelledError`) workflow/activity koduna standart Python istisnası olarak ulaşmasıdır.

### 2) Retry — `RetryPolicy`
Kullanıcı tarafı dataclass: `temporalio/common.py:37-61` (`class RetryPolicy`):
```python
initial_interval: timedelta = timedelta(seconds=1)      # common.py:40
backoff_coefficient: float = 2.0                          # common.py:43
maximum_interval: timedelta | None = None                 # common.py:48
maximum_attempts: int = 0                                  # common.py:53, 0 = sınırsız
non_retryable_error_types: Sequence[str] | None = None     # common.py:59
```
Proto karşılığı (sunucuya giden/gelen tel formatı): `temporalio/api/common/v1/message_pb2.pyi:393-426` (`class RetryPolicy(google.protobuf.message.Message)`) — aynı beş alan: `initial_interval` (Duration, satır 404), `backoff_coefficient` (satır 406), `maximum_interval` (Duration, satır 412), `maximum_attempts` (satır 416), `non_retryable_error_types` (repeated string, satır 421). Python ↔ proto dönüşümü `common.py:62-75` (`from_proto`) ve `common.py:77-89` (`apply_to_proto`) — bu ikinci fonksiyon `common.py:91-107`'deki `_validate()`'i çağırır (Go SDK'nın test paketinden alınmış kurallar, yorum satırı `common.py:92`: "Validation taken from Go SDK's test suite"): `backoff_coefficient < 1` reddedilir, `maximum_interval < initial_interval` reddedilir, `maximum_attempts == 1` ise diğer tüm doğrulamalar atlanır (retry zaten kapalı).

**Hangi hata retry edilir, hangisi edilmez:** `ApplicationError.non_retryable` — `temporalio/exceptions.py:132` (`__init__` parametresi), `temporalio/exceptions.py:159-166` (`non_retryable` property, docstring: "Whether the error was set as user creation... not whether the error is non-retryable via other means such as retry policy"). Bu proto'da `ApplicationFailureInfo.non_retryable: bool` alanına yazılır (`temporalio/api/failure/v1/message_pb2.pyi:34`). İkinci mekanizma `RetryPolicy.non_retryable_error_types` — bir hata `type` alanı bu listedeki bir stringle **birebir** eşleşirse retry durur (proto yorumu, `message_pb2.pyi:424-425`: "Note that this is not a substring match, the error type... must match exactly"). **Bu eşleştirmenin nerede yapıldığı** (hata tipini alıp listeyle karşılaştıran kod) bu Python SDK'sında bulunamadı — `grep -rn "non_retryable_error_types"` yalnızca `common.py`'deki proto dönüşüm noktalarını buluyor, bir karşılaştırma/karar mantığı yok; bu, sunucu veya Rust core tarafında olmalı — **SDK'dan doğrulanamadı**.

**Activity retry ile workflow retry farkı:**
- Activity retry: tek bir activity çağrısı başarısız olursa, **yalnızca o activity** yeniden çalıştırılır; workflow'un geri kalan durumu (değişkenler, hangi adımda olduğu) korunur. `RetryState` enum'u (`temporalio/exceptions.py:266-282`) bu sürecin nasıl bittiğini anlatır: `NON_RETRYABLE_FAILURE`, `TIMEOUT`, `MAXIMUM_ATTEMPTS_REACHED`, `RETRY_POLICY_NOT_SET`, `CANCEL_REQUESTED`. `ActivityError` (`temporalio/exceptions.py:288-330`) bu bilgiyi taşır (`retry_state` alanı, satır 330 civarı).
- Workflow retry: `temporalio/client/_client.py:584` — `start_workflow`'un `retry_policy` parametresi ("Retry policy for the workflow."). Workflow-seviyesi retry, activity retry'sinden temelde farklıdır: workflow başarısız/timeout olursa **tüm run sıfırdan yeni bir run olarak başlar** (yeni event history), var olan değişkenler/ilerleme **kaybolur** — `client/_client.py:574-575` docstring'i bunu doğrudan söylüyor: `execution_timeout: Total workflow execution timeout including retries and continue as new.` Yani workflow retry = "yeniden dene" değil, "temiz bir sayfayla yeniden başlat"; activity retry = "aynı workflow durumunda kaldığı yerden bir adımı tekrar dene." Varsayılan: `retry_policy=None`, yani **workflow'lar varsayılan olarak retry edilmez** — yalnızca `cron_schedule` veya açıkça geçilen `retry_policy` ile.

### 3) Heartbeat ve arıza tespiti
`temporalio/activity.py:327-334` — `heartbeat(*details)` modül fonksiyonu, `_Context.current().heartbeat` çağrılabilirine delege eder; "Can only execute heartbeat after interceptor init" hatası activity dışında çağrılırsa fırlatılır.

Worker tarafı gönderim: `temporalio/worker/_activity.py:221-236` (`_heartbeat`) — heartbeat çağrısı senkron ama veri dönüşümü async olduğundan, detaylar bir `asyncio.Queue`'ya konur (satır 233) ve `_heartbeat_async` task'ı zamanlanır (satır 234-236). `temporalio/worker/_activity.py:238-289` (`_heartbeat_async`) — kuyruk boşaltılır, yalnızca **en son** detay tutulur (satır 246-248, ara heartbeat'ler atılabilir — sık heartbeat atan bir activity ağı boğmaz), sonra `self._bridge_worker().record_activity_heartbeat(heartbeat)` (satır 282) ile Rust core'a, oradan sunucuya iletilir. Heartbeat kaydı başarısız olursa (satır 283-289) activity **yerel olarak iptal edilir** (`activity.cancel(cancelled_due_to_heartbeat_error=err)`).

**"Worker öldü" tespiti sunucu tarafıdır — SDK'dan doğrulanamadı.** Bu Python deposunda, sunucunun heartbeat'i ne kadar süre görmeyince activity'yi "worker öldü" sayıp yeniden zamanladığına dair bir karar mekanizması yok (bu, `heartbeat_timeout` sınırının sunucu tarafında izlenmesiyle ilgilidir). SDK yalnızca gönderim ucunu (`record_activity_heartbeat`) ve alım ucunu (`heartbeat_details` — bkz. aşağı) sağlar.

**`heartbeat_details` ile aktivite ortasından devam — bu bir checkpoint biçimidir:** `temporalio/worker/_activity.py:583-591` — activity yeniden başlatıldığında (önceki deneme heartbeat atıp sonra öldüyse), sunucunun sakladığı son heartbeat detayları `start.heartbeat_details`'tan decode edilir; decode başarısız olursa `ApplicationError("Failed decoding heartbeat details", non_retryable=True)` fırlatılır (satır 592-594, non_retryable=True olması dikkat çekici: bozuk checkpoint verisiyle sonsuz retry döngüsüne girilmesin diye). Bu değer `temporalio.activity.Info.heartbeat_details` alanına konur (`temporalio/activity.py:111`, `_activity.py:605`) ve **kullanıcı kodu bunu okuyup "kaldığım yerden devam" mantığını kendisi yazmak zorundadır** — SDK otomatik olarak bir döngü değişkenini geri yüklemez, yalnızca son gönderilen serbest-biçimli veriyi (`*details`) taşır. Bu, protokolün "dikkatle incele" dediği noktadır: Temporal'ın **tek** yerleşik checkpoint biçimi budur — workflow seviyesinde checkpoint yoktur (yukarıya bakınız, event history replay edilir), ama uzun süren tek bir activity için heartbeat detayları gerçek bir ilerleme-kaydı görevi görür.

### 4) Timeout aileleri
Tanım noktaları: `temporalio/workflow/_activities.py:85-94` (`ActivityConfig` TypedDict) ve `temporalio/worker/_interceptor.py:249-259` (`StartActivityInput`) — dört alan: `schedule_to_close_timeout`, `schedule_to_start_timeout`, `start_to_close_timeout`, `heartbeat_timeout`. Hata sınıflandırması `temporalio/exceptions.py:211-224` (`class TimeoutType(IntEnum)`): `START_TO_CLOSE`, `SCHEDULE_TO_START`, `SCHEDULE_TO_CLOSE`, `HEARTBEAT` — dördü de sunucu proto enum'una (`temporalio.api.enums.v1.TimeoutType`) eşlenir. Worker'a gelen activity görevinde bu değerler `temporalio/worker/_activity.py:598-628`'de proto'dan `Info` nesnesine kopyalanır (`heartbeat_timeout` satır 606, `schedule_to_close_timeout` satır 611, `start_to_close_timeout` satır 617 — dikkat: `schedule_to_start_timeout` bu `Info` nesnesinde **yok**, çünkü zamanı worker'ın kendisi görmeden geçer: schedule-to-start süresi, görev sunucu kuyruğunda beklerken dolar, worker task'ı hiç almadan timeout olabilir; bu nedenle worker'a ulaşan `start` mesajında bu alan taşınmıyor olabilir — bu ayrım SDK'dan doğrulanamadı, yalnızca `Info` alanlarında `schedule_to_start_timeout`'un eksik olduğu gözlemlendi).

Anlamları (proto/alan adlarından ve genel Temporal sözleşiminden — sunucu tarafı zamanlayıcı mantığı bu klonda yok, bu satır SDK'dan doğrulanamadı, yalnızca alan varlığı ve `TimeoutType` eşlemesi doğrulandı):
- `schedule_to_start_timeout`: görev kuyruğa düşürülüp bir worker tarafından alınana kadarki süre — worker kapasitesi/yokluğu sinyali.
- `start_to_close_timeout`: worker görevi aldıktan itibaren tek bir deneme için verilen süre.
- `schedule_to_close_timeout`: kuyruğa düşmeden tamamlanana kadarki toplam süre (tüm retry denemeleri dahil).
- `heartbeat_timeout`: art arda iki heartbeat arası izin verilen maksimum süre; aşılırsa `TimeoutType.HEARTBEAT` ile activity fail sayılır (kesin sunucu davranışı bu klonda yok).

## Genişletilebilirlik
Kapsam dışı bırakıldı (İ4 odağı retry/rollback/heartbeat); yalnızca not: yeni bir activity/workflow eklemek `@activity.defn`/`@workflow.defn` dekoratörü ile tek fonksiyon/sınıf, worker'a `activities=[...]`/`workflows=[...]` listesine eklemekten ibaret (dekoratör mekanizması `temporalio/workflow/_definition.py` — incelenmedi).

## Güçlü yönler (kanıtlı)
- **Activity sonucu replay'de yeniden hesaplanmıyor, event history'den okunuyor** (`_apply_resolve_activity`, `temporalio/worker/_workflow_instance.py:875-921`) — yan etkili kodun (dış API çağrısı) replay sırasında tekrar tetiklenmemesini garanti eden mimari; bu olmasa her replay gerçek dünyada ikinci bir yan etki üretirdi.
- **Patch mekanizması event history'ye bağlı, kod tabanına değil** (`workflow_patch`, `_workflow_instance.py:1441-1467`) — canlıda çalışan eski run'lar, kod deploy edilse bile kendi kaydettikleri patch marker'ına göre eski dalda kalır; yeni run'lar otomatik yeni dala girer. Manuel migration script'i gerekmiyor.
- **Heartbeat detaylarının debounce edilmesi** (`_heartbeat`/`_heartbeat_async`, `temporalio/worker/_activity.py:221-289`) — sık heartbeat çağrıları kuyruğa yığılıp yalnızca sonuncusu gönderiliyor; sık heartbeat atan koddan sunucuya trafik patlaması gitmiyor.
- **Bozuk heartbeat checkpoint verisi non_retryable olarak işaretleniyor** (`_activity.py:592-594`) — kötü durumdan sonsuz retry döngüsüne düşmeyi engelleyen küçük ama isabetli bir karar.

## Zayıf yönler (kanıtlı)
- **Saga/compensation için hiçbir yerleşik yapı veya örnek yok** — grep ile bu klonda sıfır eşleşme; geliştirici telafiyi tamamen kendi `try/finally`/`except CancelledError` kodunda, sıfırdan tasarlamak zorunda; SDK bir "compensation stack" veya benzeri bir yardımcı sunmuyor.
- **`non_retryable_error_types` eşleştirme mantığı SDK'da görünmüyor** — kullanıcı yalnızca bir string listesi tanımlıyor, gerçek karşılaştırma kod olarak bu depoda yok (sunucu/core'da olmalı); bu, "hangi hata gerçekte retry edilmeyecek" sorusunun cevabını bu SDK'yı okuyarak tam veremiyor.
- **"Worker öldü" tespiti tamamen kod dışı** — Python tarafında bu kararı veren hiçbir mantık yok; heartbeat_timeout aşımının nasıl işlendiği yalnızca sunucu davranışına güvenerek kabul edilmek zorunda.
- **`Info.schedule_to_start_timeout` alanı eksik** — worker, kendi görevinin ne kadar kuyrukta beklediğini activity kodu içinden göremiyor (yalnızca `schedule_to_close_timeout` ve `start_to_close_timeout` `Info`'da var); bu gözlemlenebilirlik açısından küçük ama gerçek bir boşluk.

## Puan (1-5)
- olgunluk: 4 — 1.178 yıldız görece küçük ama proje resmi Temporal Technologies ürünü, 190 test dosyası, sürüm 1.32.0 (kararlı numaralandırma), aktif commit (son push 2026-09-05).
- mimari netlik: 4 — `activate()`/`_apply()`/`_apply_resolve_activity` zinciri kodda net, iyi yorumlanmış (`_workflow_instance.py:448-517`); ancak 4023 satırlık tek dosyaya yayılmış olması okunabilirliği düşürüyor.
- genişletilebilirlik: incelenmedi — İ4 kapsamı dışında bırakıldı, dekoratör/worker kayıt mekanizması ayrıntılı okunmadı.
- güvenilirlik ilkelleri: 5 — retry (activity+workflow, proto+dataclass ikisi de doğrulandı), heartbeat, timeout aileleri, versioning/patching hepsi kodda somut ve iyi belgelenmiş; yalnızca rollback/saga tamamen geliştiriciye bırakılmış (bu bir eksiklik değil, bilinçli tasarım — Temporal'ın kendi dokümantasyonu da bunu "saga pattern kodla yazılır" diye tanımlar, ancak bu klonda örneği yok).
- gözlemlenebilirlik: incelenmedi — metrik/tracing/logging entegrasyonu (`temporalio/runtime.py`, OpenTelemetry desteği varsa) bu turda okunmadı.
- güvenlik duruşu: incelenmedi — TLS/auth/mTLS konfigürasyonu (`temporalio/service.py`, `envconfig.py`) bu turda okunmadı.

## Alınacak fikir
- **Activity sonucunu replay'de yeniden hesaplamak yerine event history'den okumak** (`_apply_resolve_activity`, `temporalio/worker/_workflow_instance.py:875-921`) — bizim orkestratörümüzde bir görev (LLM çağrısı, dış API) tamamlandıktan sonra "bu adımı yeniden çalıştır" ile "bu adımın sonucunu geri oku" ayrımı net olmalı; aksi hâlde bir workflow'u durum kurtarma amacıyla yeniden oynatmak, LLM'i veya dış API'yi ikinci kez (parayla, yan etkiyle) çağırma riski taşır.
- **Patch/versioning'in kod tabanına değil, çalışan işin kendi geçmişine bağlanması** (`workflow_patch`, `_workflow_instance.py:1441-1467`) — bizde uzun süren bir ajan görevinin ortasında prompt/mantık değişse bile, o an çalışmakta olan görev örneği kendi başladığı "sürüm"de kalmalı; yeni görevler otomatik yeni mantığa geçmeli. Bu, "kodu değiştirince yarım kalan işler ne olur" sorusuna somut bir cevap.
- **Heartbeat + `heartbeat_details` ile uzun süren tek bir adımın ortasından devam etmek** (`_activity.py:583-594`, `_heartbeat_async` `_activity.py:238-289`) — uzun süren bir ajan aracı (örn. büyük dosya işleme, çok adımlı arama) periyodik olarak "şu ana kadar geldiğim yer" bilgisini heartbeat'e koyarsa, worker ölse bile yeni bir deneme sıfırdan değil kaldığı yerden başlayabilir. Bizim retry/checkpoint tasarımımızda bu ayrı bir birincil mekanizma olmalı, activity/workflow tekrarından bağımsız.
- **Non-retryable hata için açık bir bayrak** (`ApplicationError.non_retryable`, `temporalio/exceptions.py:132,159-166`) — bizde de "bu hata denemekle düzelmez" (örn. 400 Bad Request, geçersiz girdi) ile "bu hata geçicidir, tekrar dene" (örn. 429, timeout) ayrımının hata nesnesinin kendisinde taşınması, retry katmanının kör kör her şeyi tekrar denemesini engeller.
- **Workflow retry ile activity retry'nin bilinçli olarak farklı davranması** (`client/_client.py:574-584` execution_timeout/retry_policy docstring'i) — "küçük adımı tekrar dene" (ucuz, durumu koru) ile "tüm işi sıfırdan başlat" (pahalı, temiz sayfa) arasındaki seçim bizde de açık bir API kararı olmalı, ikisini aynı "retry" kelimesinin altında gizlememek gerekir.

## Alınmayacak
- **Otomatik rollback/compensation motoru beklemek** — Temporal bunu bilerek sağlamıyor (bu klonda sıfır saga/compensation kod/örnek var), çünkü telafi mantığı domain'e özgüdür ve genel bir motor bunu güvenle otomatikleştiremez. Bizde de "hata olursa otomatik geri al" diye bir genel mekanizma tasarlamak yanlış güvenlik hissi verir; her telafi elle, domain bilgisiyle yazılmalı — Temporal'ın kendisi de bunu yapmıyor.
- **Determinizm kısıtının LLM ajanlarına doğrudan taşınması** — Temporal'ın tüm modeli "workflow kodu replay'de bit-bit aynı kararları vermeli" varsayımına dayanır (`now()`, `random()` sarmalayıcıları, `NondeterminismError`). LLM çağrısı **doğası gereği** deterministik değildir (aynı prompt farklı zamanlarda farklı yanıt verebilir); bir ajan orkestratöründe "LLM çağrısını bir activity'ye hapsetmek" (Temporal'ın önerdiği desen — activity'ler deterministik olmak zorunda değil, workflow'un kendisi olmak zorunda) doğru çözüm, ama workflow katmanının kendisini LLM kararlarına göre dallandırmak (örn. `if llm_response: patched(...)` gibi) Temporal'ın modeliyle doğrudan çelişir. Bu ayrımı netleştirmeden Temporal'ı birebir kopyalamak riskli.
- **`schedule_to_start`/`heartbeat_timeout` gibi sunucu-taraflı zamanlayıcıları SDK seviyesinde yeniden icat etmek** — bu klonda bu zamanlayıcıların gerçek uygulanışı yok (sunucu/core'da); bizim kendi altyapımızda bunları "SDK'dan doğrulanamadı" diyerek kopyalamak yerine, kendi zamanlayıcı ihtiyacımızı kendi sunucu/kuyruk katmanımızda (varsa) ayrı tasarlamak gerekir — SDK'nın proto alan adlarını kopyalamak, davranışı kopyalamak anlamına gelmez.

## Matris cevapları
- saglayici_bagimsiz: evet — Temporal bir LLM/model sağlayıcısı içermez, genel amaçlı dayanıklı yürütme motorudur; sunucu tarafı (kendi barındırılan veya Temporal Cloud) tek bağımlılık, kod tarafında tek bir sağlayıcıya kilitlenme yok.
- sozlesme_var: kısmen — workflow/activity girdi-çıktısı proto/data-converter üzerinden makine-okur (`temporalio/converter/`, bu turda ayrıntılı incelenmedi), ama "ajan sözleşmesi" (yetenek, izin, araç listesi) kavramı Temporal'da yok — bu, protokolün istediği anlamda bir ajan sözleşmesi değil, bir RPC/serileştirme sözleşmesi. Bu yüzden "kısmen".
- insan_kapisi: hayır — bu klonda incelenen kod yollarında (retry, heartbeat, patch, cancel) hiçbir yerde bir onay/insan-kapısı adımı bulunmadı. Temporal'ın "signal" mekanizması (dışarıdan workflow'a insan onayı göndermek için kullanılabilir) teorik olarak bunu mümkün kılar ama bu klonda bir insan-onayı *deseni* olarak örneklenmiş/uygulanmış hâlde bulunmadı — bu yüzden "hayır", "kısmen" değil.
- checkpoint: evet — event history replay'i (tüm workflow durumu için) ve `heartbeat_details` (tek bir uzun activity için) iki farklı seviyede gerçek, kodda kanıtlanmış checkpoint/devam-etme mekanizmasıdır (`_apply_resolve_activity` `_workflow_instance.py:875-921`, `heartbeat_details` `_activity.py:583-594`).
