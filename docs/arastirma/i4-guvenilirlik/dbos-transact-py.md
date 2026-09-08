# DBOS Transact (Python)

## Kimlik
repo: dbos-inc/dbos-transact-py · yıldız 1.563 · watcher 10 · son push 2026-09-04 · lisans MIT · dil Python · arşivlenmemiş · canlılık: **geçti**

`pyproject.toml:4` açıklaması: "Ultra-lightweight durable execution in Python". `requires-python = ">=3.10"`, bağımlılıklar arasında `sqlalchemy[asyncio]>=2.0.43` ve `psycopg[binary]>=3.1` var (`pyproject.toml:8-14`) — yani çekirdek üzerine kurulu olduğu şey bir mesaj kuyruğu ya da özel bir runtime değil, SQLAlchemy ile konuşan bir Postgres (varsayılan) ya da SQLite şeması.

## Çözdüğü problem
`README.md:24-27`: "You should consider using DBOS if your application needs to reliably handle failures... a payments service that must reliably process transactions even if servers crash mid-operation... resume seamlessly from checkpoints rather than restart from the beginning." Yani hedef: sunucu/süreç çökmesinden sonra bir iş akışının kaldığı yerden devam etmesi, sıfırdan değil.

## Mimari
DBOS'un tamamı uygulamanın kendi sürecinde çalışan bir kütüphane; ayrı bir orkestratör süreci yok (`README.md:19-20`: "there's no additional infrastructure for you to configure or manage"). Durum tamamen ilişkisel veritabanında (`dbos/_sys_db.py`, iki somut alt sınıf: `PostgresSystemDatabase` — `dbos/_sys_db_postgres.py:29` — ve `SQLiteSystemDatabase` — `dbos/_sys_db_sqlite.py:17`) tutuluyor. Şema `dbos/_schemas/system_database.py` içinde SQLAlchemy `Table` nesneleri olarak tanımlı; gerçek DDL `dbos/_migration.py` üzerinden uygulanıyor.

Çalışma zamanı akışı: `@DBOS.workflow` dekore edilmiş fonksiyon çağrıldığında `dbos/_core.py` içindeki sarmalayıcı, workflow'u `workflow_status` tablosuna PENDING olarak yazar, sonra fonksiyonu senkron çalıştırır. Fonksiyon içinde her `@DBOS.step` / `@DBOS.transaction` çağrısı, bağlamdaki (`DBOSContext`) monoton artan bir `function_id` sayacıyla numaralanır (`dbos/_context.py:219-240`) ve bu numara `operation_outputs` tablosunun birincil anahtarının parçasıdır.

## Klasör yapısı
- `dbos/_core.py` (3473 satır) — workflow/step/transaction dekoratörlerinin çekirdek yürütme mantığı, OAOO (once-and-only-once) kontrolü.
- `dbos/_sys_db.py` (7045 satır) — sistem veritabanı erişim katmanı: kuyruk, checkpoint okuma/yazma, recovery sorguları, dead-letter.
- `dbos/_sys_db_postgres.py`, `dbos/_sys_db_sqlite.py` — motora özel alt sınıflar.
- `dbos/_recovery.py` (72 satır, tamamı okundu) — pending workflow'ları yeniden kuyruğa alma.
- `dbos/_schemas/system_database.py` — `workflow_status`, `workflow_input`, `workflow_output`, `operation_outputs`, `notifications`, `workflow_events` tablo tanımları.
- `dbos/_error.py` — hata sınıfları (`MaxRecoveryAttemptsExceededError`, `DBOSMaxStepRetriesExceeded`, `DBOSUnexpectedStepError` vb.).
- `dbos/_queue.py` — durable kuyruk (concurrency limiti, rate limit, dedup).
- `dbos/_migration.py` (1813 satır) — Postgres/SQLite şema göçleri.
- `dbos/_workflow_commands.py` — CLI'dan workflow listeleme/iptal/resume komutları.
- `dbos/_serialization.py` — girdi/çıktı/istisna serileştirme (pickle + "portable"/JSON modu).

## Ajan tasarımı
Bakmadım demiyorum, dürüstçe: **DBOS bir ajan çatısı değil.** Kod tabanında ajan, araç-çağırma, LLM entegrasyonu ya da çok-adımlı planlayıcı kavramı yok. Bu bir *dayanıklı yürütme (durable execution)* kütüphanesi: sıradan Python fonksiyonlarını (workflow/step/transaction) çökme sonrası devam edebilir hale getiren bir checkpoint katmanı. LangGraph/Temporal ile karşılaştırma bağlamında değeri, "ajan" seviyesinde değil "iş akışı adımı" seviyesinde dayanıklılık sağlamasında. Zorlamıyorum: bu iznin sorduğu şey zaten "checkpoint modeli", ajan tasarımı değil.

## Orkestrasyon / iş akışı modeli
Orkestrasyon merkezi bir motor tarafından değil, **iş akışı fonksiyonunun kendisinin yeniden çalıştırılmasıyla** yapılıyor (bkz. Durum ve bellek). `dbos/_recovery.py:14-27` bunu açıkça söylüyor: `_recover_workflow` doğrudan yürütmüyor, workflow'u kuyruğun ENQUEUED→PENDING atomik alımından geçirecek şekilde yeniden kuyruğa yazıyor ("Recovery re-enqueues rather than executing directly... makes duplicate recovery requests idempotent" — `dbos/_recovery.py:19-22`). Kuyruk mekanizması `dbos/_queue.py` içinde; concurrency limiti, dedup id (`workflow_status.deduplication_id`, `dbos/_schemas/system_database.py:97`), öncelik (`priority` kolonu, satır 65) destekleniyor.

## Durum ve bellek

**1) Checkpoint durum modeli — üçüncü bir model: "kalıcı adım-sonucu tablosu"**

İki tablo:
- `workflow_status` (`dbos/_schemas/system_database.py:30-156`): workflow'un tekil durumu (PENDING/ENQUEUED/SUCCESS/ERROR/CANCELLED/MAX_RECOVERY_ATTEMPTS_EXCEEDED — bkz. `dbos/_sys_db.py:142`), `output`/`error` (satır 38-39), `recovery_attempts` (satır 54-58), `executor_id`, `queue_name`, `inputs`. Bu satır **mutasyona uğrar** (UPDATE ile), bir olay günlüğü değil — her yeni durum eskisinin üzerine yazılıyor.
- `operation_outputs` (`dbos/_schemas/system_database.py:177-198`): her adımın (step/transaction/child-workflow-await/send/recv) sonucu, `PrimaryKeyConstraint("workflow_uuid", "function_id")` (satır 194) ile tekilleştirilmiş. Kolonlar: `function_name`, `output`, `error`, `child_workflow_id`, `started_at_epoch_ms`, `completed_at_epoch_ms`, `serialization`.

Bu ne LangGraph'ın immutable snapshot'ı ne de Temporal'ın event-log replay'i: satır sayısı adım sayısıyla orantılı (Temporal'a benziyor gibi görünür) ama her satır **sadece nihai sonucu** tutuyor, aradaki komutları/eventleri değil (LangGraph'a benziyor gibi görünür). Gerçekte bu bir **memoization / idempotency-key tablosu**: "bu workflow_id + bu function_id daha önce çalıştı mı, çalıştıysa sonucu neydi" sorusuna cevap veriyor.

Yazma zamanlaması **adım bittikten sonra**, adım başlamadan önce değil: `dbos/_core.py:2538` (`record_step_result` fonksiyonunun tanımı), adım `func()` çağrısı `dbos/_core.py:2551`'de çalıştırıldıktan sonra hem başarı hem hata yolunda `dbos._sys_db.record_operation_result(step_output)` çağrılıyor — satır 2562 hata durumunda, satır 2567 başarı durumunda. Başlangıç zaman damgası (`step_start_time`, `dbos/_core.py:2514`) sadece bellekte tutuluyor, adım başlamadan DB'ye yazılmıyor — yani "adım X başladı" diye ayrı bir checkpoint yok, sadece "adım X bitti, sonucu şu" var.

`@DBOS.transaction` için farklı ve daha güçlü bir garanti var: adımın SQL yan etkisi ile `operation_outputs`'a (aslında uygulama veritabanındaki `transaction_outputs` tablosuna, `dbos/_core.py:2267-2268`'te `dbos._app_db.record_transaction_output`) yazılması **aynı SQLAlchemy `session.begin()` bloğu içinde**, yani aynı DB transaction'ında oluyor (`dbos/_core.py:2197` `with session.begin():` ... `output = func(*args, **kwargs)` satır 2258 ... `record_transaction_output` satır 2267). Bu, transaction'lar için checkpoint'in **atomik** olduğu anlamına gelir; sıradan `@DBOS.step`'ler için değil.

**2) Recovery sırasında tamamlanmış adım okunuyor mu, yeniden mi çalışıyor?**

Okunuyor, yeniden çalışmıyor. Kanıt: `dbos/_sys_db.py:3142-3208` (`_check_operation_execution_txn`) hem `workflow_status` hem `operation_outputs`'u sorgulayıp, `operation_outputs` satırı varsa `RecordedResult` (output/error/serialization/child_workflow_id) döndürüyor. Bu sonuç `dbos/_core.py:2570-2596`'da (`check_existing_result` fonksiyonu, adı geçmeyen adımlar için) ve `dbos/_core.py:2205-2247`'de (`@DBOS.transaction` için, `session.begin()` bloğunun içinde) tüketiliyor: kayıt varsa `func()` **hiç çağrılmıyor**, doğrudan deserialize edilip döndürülüyor (`dbos/_core.py:2586-2594`) veya kayıtlı hata yeniden fırlatılıyor (`dbos/_core.py:2579-2585`). Sadece kayıt yoksa (`recorded_output is None`) gerçek fonksiyon çalıştırılıyor. Ayrıca `function_name != recorded_function_name` durumunda `DBOSUnexpectedStepError` fırlatılıyor (`dbos/_sys_db.py:3196-3201`) — bu, replay sırasında adım sırasının/adının kaymasına karşı bir determinizm koruması.

Workflow'un **tamamı** ise her recovery'de yeniden çalıştırılıyor (fonksiyon en baştan çağrılıyor); sadece zaten tamamlanmış adımlar bu mekanizmayla atlanıyor. `dbos/_recovery.py:14-27`'deki `_recover_workflow` doğrudan bunu yapıyor: workflow'u kuyruğa geri koyup normal dispatch akışına (`execute_dequeued_workflow`, `dbos/_core.py:1184`) sokuyor; bu da workflow fonksiyonunu satır 1'den itibaren tekrar çağırıyor.

**3) Garanti: "en az bir kez" mi, "tam bir kez" mi — çelişki var**

`README.md:139` "Exactly-Once Event Processing" başlığı altında, `README.md:151` "Use the event ID as an idempotency key to start the workflow exactly-once", `README.md:163` "This workflow runs exactly-once for each message sent to the topic" deniyor. `dbos/_dbos.py:2218-2219` ve `2241-2242`'de de iç yardımcı metotlar için "it runs exactly once even if the workflow is recovered" ifadesi var.

Bu iddia **workflow'un başlatılması** ve **DB içi durum güncellemeleri** için doğru (idempotency key / dedup id ile korunuyor, `operation_outputs` PK'sı ile korunuyor). Ama genel `@DBOS.step` için tam doğru değil: adımın gövdesi (`func()`, `dbos/_core.py:2551`) çalıştırılıyor, sonuç DB'ye ancak **bundan sonra** yazılıyor (`dbos/_core.py:2562/2567`). Süreç, adım gövdesi bitip DB yazması commit olmadan önce çökerse, recovery bu adımı `check_existing_result` None döndürdüğü için **yeniden çalıştırır** — adım harici bir yan etki içeriyorsa (HTTP çağrısı, e-posta, ödeme API'si) bu yan etki iki kez gerçekleşebilir. Kodda ya da `dbos/*.py` docstring'lerinde bunun için "at-least-once" veya "may execute more than once" uyarısı **bulunamadı** (aranan dosyalarda yok). Yani: **kod, sıradan step'ler için at-least-once sağlıyor; belge (README) "exactly-once" diye pazarlıyor** — çelişki, sadece `@DBOS.transaction` (DB yan etkisi aynı transaction'da checkpoint'lendiği için) ve dedup'lu mesajlaşma/workflow-başlatma için gerçek exactly-once'a yakın; genel step'ler için değil. Bu ayrım README'de yapılmıyor.

**4) Rollback mi, yeniden deneme mi? Compensation/saga yok**

`grep -rn -i "compensat|saga|rollback" dbos/` sonucu (tüm `dbos/` altında, sadece 3 eşleşme, hepsi incelenen dosyalarda):
- `dbos/_core.py:2292` — sadece bir log mesajı: "Hint: Do not call commit() or rollback() within a DBOS transaction." (kullanıcının SQLAlchemy session'ında manuel commit/rollback çağırmasını engelleyen bir uyarı, workflow seviyesinde bir rollback mekanizması değil).
- `dbos/_sys_db.py:3318`, `5215` — docstring'lerde "Does not begin, commit, rollback, or retry" (bu fonksiyonların transaction yönetmediğini belirtiyor, tersi değil).

**Saga/compensation/telafi mekanizması kod tabanında yok.** `@DBOS.transaction` içindeki rollback tamamen SQLAlchemy `session.begin()`'in standart davranışı: `func()` istisna fırlatırsa (`dbos/_core.py:2258` sonrası `except` blokları), `with session.begin():` bloğundan istisnayla çıkılınca SQLAlchemy **o transaction'ın SQL değişikliklerini otomatik geri alır** (DB seviyesinde ROLLBACK) — bu, tek bir SQL transaction'ının ACID rollback'i, workflow seviyesinde "önceki adımların etkisini geri al" anlamına gelmiyor. Workflow seviyesinde "rollback" diye bir API yok; bir workflow N. adımda hata verirse ve retry tükenirse workflow ERROR durumuna geçer (`dbos/_core.py` içindeki hata yollarında `workflow_status.error` yazılıyor), ama 1..N-1. adımların yaptığı DB yazıları veya dış yan etkiler **geri alınmaz** — geliştiricinin kendi telafi adımını elle yazması gerekir (DBOS bunun için özel bir birincil sınıf yapı sunmuyor).

**5) Retry / max_recovery_attempts / dead-letter**

- Adım seviyesi retry: `@DBOS.step(retries_allowed=False, interval_seconds=1.0, max_attempts=3, backoff_rate=2.0, ...)` — varsayılanlar `dbos/_dbos.py:1224-1227`. Varsayılan olarak retry **kapalı** (`retries_allowed=False`); açıldığında üstel geri çekilme var, tavan `max_retry_interval_seconds: float = 3600` (`dbos/_core.py:2516`, 1 saat). Tükenince `DBOSMaxStepRetriesExceeded` fırlatılıyor (`dbos/_error.py:216-233`).
- Workflow seviyesi recovery sınırı: `max_recovery_attempts`, varsayılan **100** (`dbos/_registrations.py:10`: `DEFAULT_MAX_RECOVERY_ATTEMPTS = 100`). `dbos/_core.py:1236-1247`: `recovery_attempts > fi.max_recovery_attempts + 1` olduğunda `dbos._sys_db.dead_letter_workflows(...)` çağrılıp `MaxRecoveryAttemptsExceededError` fırlatılıyor.
- Dead-letter: `dbos/_sys_db.py:1060-1090` (`dead_letter_workflows`) — PENDING durumundaki ve deneme sayısı eşiği aşan workflow'ları `MAX_RECOVERY_ATTEMPTS_EXCEEDED` durumuna çekiyor (kuyruktan düşürüyor: `queue_name=None`, satır 1085). Bu bir ayrı dead-letter *tablosu* değil, `workflow_status.status` alanında ayrı bir **terminal durum**.
- Test kanıtı: `tests/test_queue.py:1960` (`test_dlq_enqueued_workflows`), `max_recovery_attempts=10` ile deneyip `tests/test_queue.py:2020-2023`'te `recovery_attempts == max_recovery_attempts + 2` ve durumun `MAX_RECOVERY_ATTEMPTS_EXCEEDED` olduğunu doğruluyor (ilk enqueue + PENDING resend'ler dahil "+2" ofseti var, bu iki artı kuyruğa ilk giriş anındaki sayaç davranışından kaynaklanıyor — `dbos/_sys_db.py:970`'teki `recovery_attempts=(1 if wf_status not in _enqueued_statuses else 0)` başlangıç mantığıyla tutarlı; detaylı ofset muhasebesi doğrulanmadı).

**6) Kısmi ilerleme (adım ortası) korunuyor mu?**

Hayır. Checkpoint granülerliği **adım sınırıdır** (bir `@DBOS.step`/`@DBOS.transaction` çağrısının tamamı), adım içi değil. Kanıt: `record_operation_result` yalnızca adım fonksiyonu tamamen dönüş yaptıktan (veya istisna fırlattıktan) sonra çağrılıyor (`dbos/_core.py:2551-2567`); adımın ortasında bir ara durum yazma noktası yok. Bir adım (örn. 10.000 satırlık bir dosya işleyen döngü) yarısında çökerse, recovery bu adımı **baştan** çalıştırır — `operation_outputs`'ta o `function_id` için hiç satır olmadığı için `check_existing_result` `None` döner (`dbos/_sys_db.py:3184-3186`). İnce bir istisna: `DBOSWorkflowCancelledError` özel olarak ele alınıyor — bu durumda sonuç hiç kaydedilmiyor ki adım resume'da yeniden çalışabilsin (`dbos/_core.py:2552-2555`: "Don't record an outcome — let the step be re-run on resume."), ama bu da adım-altı bir ilerleme kaydı değil, sadece "kayıt yapma" kararı.

Ayrıca `function_id` sayacı (`dbos/_context.py:219`, `237`) workflow fonksiyonunun **deterministik yeniden yürütülmesine** dayanıyor: her çağrıda aynı sırayla aynı adımların çağrıldığı varsayılıyor (Temporal'ın event-sourcing modeliyle aynı öncül). Bu, iki taraflı bir kısıt: workflow gövdesi non-deterministik olursa (örn. koşullu dallanma girdiye değil harici bir zamana bağlıysa), `function_id` kayması `DBOSUnexpectedStepError`'a yol açar (`dbos/_sys_db.py:3196-3201`).

## Hata yönetimi
Hata sınıfları `dbos/_error.py` içinde tek bir dosyada toplanmış (23 sınıf, hepsi `DBOSException` ya da `DBOSBaseException`'dan türüyor). Öne çıkanlar:
- `MaxRecoveryAttemptsExceededError` (`dbos/_error.py:187-197`) — workflow'un recovery bütçesi bittiğinde.
- `DBOSMaxStepRetriesExceeded` (`dbos/_error.py:216-232`) — adım retry bütçesi bittiğinde, hata listesini de taşıyor (`self.errors`).
- `DBOSUnexpectedStepError` (`dbos/_error.py:261-278`) — replay sırasında beklenmeyen adım adı (determinizm ihlali tespiti).
- `DBOSPatchNondeterminismError` (`dbos/_error.py:281-298`) — kod "patch" (sürüm geçişi) sırasında determinizm ihlali.
- `DBOSWorkflowConflictIDError` (`dbos/_error.py:362-369`, `DBOSBaseException`'dan, yani normal `except Exception` ile yakalanmaması amaçlanıyor) — aynı workflow_id/function_id için çelişen bir yazma denemesi (örn. iki executor aynı workflow'u aynı anda tamamlamaya çalışırsa).
- `DBOSWorkflowCancelledError` — iptal edilen workflow'un adımlarının devamını engellemek için kullanılıyor; yukarıda belirtildiği gibi bu durumda adım sonucu kaydedilmiyor (`dbos/_core.py:2552-2555`).

Genel desen: hatalar hem uygulama kodunun yakalayabileceği (`DBOSException`) hem de dahili akış kontrolü için kullanılan (`DBOSBaseException`, örn. `DBOSWorkflowConflictIDError`, `DBOSWorkflowCancelledError`) iki ayrı hiyerarşide. Retry mantığı adım seviyesinde (`_core.py`'deki `attempts = max_attempts if retries_allowed else 1` ve üstel backoff, satır 2515-2533) ile workflow/recovery seviyesinde (`recovery_attempts` sayacı, `_sys_db.py`) iki farklı katmanda ayrı ayrı uygulanıyor; birbirine karışmıyor.

## Genişletilebilirlik
İki sistem veritabanı backend'i var (Postgres, SQLite — `_sys_db_postgres.py`, `_sys_db_sqlite.py`), ortak temel sınıf `SystemDatabase(ABC)` (`dbos/_sys_db.py:593`) üzerinden. Uygulama veritabanı katmanı da ayrı bir soyutlama (`_app_db.py`, bu izin kapsamında okunmadı — bakmadım). Serileştirme (`dbos/_serialization.py`) pickle ile "portable"/JSON modu arasında değiştirilebilir (`serialization` kolonu her satırda ayrı ayrı tutuluyor, yani karma sürümler aynı workflow geçmişinde bir arada olabilir). Yeni bir DB motoru eklemek `SystemDatabase` alt sınıflamasını gerektiriyor — küçük ama sıfırdan yazılası bir yüzey değil.

## Güçlü yönler (kanıtlı)
- Tamamlanmış adımların sonucu gerçekten okunuyor, yeniden çalıştırılmıyor — `_check_operation_execution_txn` (`dbos/_sys_db.py:3142-3208`) ile kanıtlı, spekülasyon değil.
- `@DBOS.transaction` için checkpoint ile SQL yan etkisi **atomik** (aynı DB transaction'ında, `dbos/_core.py:2197-2268`) — bu gerçek exactly-once'a en yakın nokta.
- Dead-letter/terminal durum var, sonsuz retry döngüsü yok (`dbos/_sys_db.py:1060-1090`, testle doğrulanmış: `tests/test_queue.py:1960`).
- Determinizm ihlalleri sessizce yutulmuyor, açık hata fırlatılıyor (`DBOSUnexpectedStepError`, `DBOSPatchNondeterminismError`).
- Ayrı bir orkestratör süreci/altyapısı gerektirmiyor (`README.md:19-20`) — operasyonel yüzey küçük.

## Zayıf yönler (kanıtlı)
- README "exactly-once" diyor (`README.md:139,151,163`) ama sıradan `@DBOS.step` için kod at-least-once sağlıyor (adım gövdesi çalışıp DB yazması commit olmadan çökerse yeniden çalışır, `dbos/_core.py:2551-2567`); bu ayrım dokümantasyonda yapılmıyor.
- Workflow seviyesinde compensation/saga birincil sınıf desteği yok (`grep` boş döndü, sadece log mesajları ve docstring'ler); bu, çok adımlı iş akışlarında kısmi başarısızlık sonrası "geri alma"nın tamamen geliştiriciye bırakıldığı anlamına geliyor.
- Checkpoint granülerliği adım sınırıyla sınırlı; uzun süren tek bir adımın ortasında çökme, o adımı sıfırdan tekrar çalıştırır — büyük/pahalı adımlar için maliyetli olabilir, ince taneli ilerleme kaydı yok.
- Recovery, tüm workflow fonksiyonunun deterministik biçimde en baştan yeniden çağrılmasına dayanıyor (`function_id` sayacı, `dbos/_context.py:219`); bu Temporal'daki gibi kullanıcı kodunun determinizm disiplinine bağımlı — ihlal derin/geç fark edilebilir (sadece adım adı uyuşmazsa yakalanıyor, davranış farkı adı değiştirmiyorsa yakalanmıyor).
- Dead-letter "+2" ofseti gibi sayaç muhasebesi ince ve testle doğrulanan davranışı tam olarak açıklayamadım (`tests/test_queue.py:2020` civarı) — kısmen doğrulanmadı olarak işaretliyorum.

## Puan (1–5)
- olgunluk: 5 — "Production/Stable" sınıflandırması (`pyproject.toml:19`), 7000+ satırlık `_sys_db.py`, geniş kuyruk/dedup/rate-limit/DLQ testleri (`tests/test_queue.py`, 2500+ satır).
- mimari netlik: 4 — tek kavram (adım-sonucu tablosu) etrafında tutarlı, ama `_sys_db.py`'nin 7045 satıra çıkması tek dosyada çok fazla sorumluluk biriktiğini gösteriyor.
- genişletilebilirlik: 3 — iki backend var ama yeni backend eklemek `SystemDatabase(ABC)` alt sınıflaması gerektiren orta ağırlıkta bir iş; ajan/araç ekosistemi yok çünkü bu bir ajan çatısı değil.
- güvenilirlik ilkelleri: 4 — checkpoint, dead-letter, determinizm koruması var; ama saga/compensation yok ve README'nin exactly-once iddiası genel step'ler için abartılı.
- gözlemlenebilirlik: 4 — `_tracer.py`, span event'leri (`dbos/_core.py:2278-2281` transaction retry olayını span'e ekliyor), `_admin_server.py`, workflow/step süre kolonları (`started_at_epoch_ms`/`completed_at_epoch_ms`) hazır; bakmadım: `_tracer.py`'nin detayı.
- güvenlik duruşu: 3 — rol tabanlı yetkilendirme var (`DBOSNotAuthorizedError`, `dbos/_roles.py` — içeriğine bakmadım), ama bu izin kapsamında güvenlik dosyalarını derinlemesine incelemedim; sertifikalı bir değerlendirme değil.

## Alınacak fikir
Adım sonucunu **adım bittikten sonra, fonksiyon adı + sıra numarasıyla anahtarlanmış tek bir tabloya** yazma deseni (`operation_outputs`, PK = workflow_id+function_id) basit ve genelleştirilebilir: kendi ajan orkestrasyonumuzda da "bu adım bu çalıştırmada daha önce tamamlandı mı" sorusunu tek bir upsert + tek bir SELECT ile cevaplayabiliriz — LangGraph'ın tüm state'i snapshot'lama maliyetine kıyasla çok daha ucuz. `@DBOS.transaction`'ın checkpoint'i DB yan etkisiyle aynı transaction'a gömme fikri de (gerçek exactly-once) — kendi DB'ye yazan adımlarımız için doğrudan uygulanabilir.

## Alınmayacak
"Exactly-once" pazarlama dilini olduğu gibi kopyalamamak lazım — genel (DB dışı yan etkili) adımlar için bu iddia yanıltıcı; kendi belgemizde "adım en az bir kez çalışır, sonucu tam bir kez kaydedilir" gibi daha dürüst bir ifade kullanmalıyız. Ayrıca tüm workflow fonksiyonunu recovery'de deterministik varsayıp baştan yeniden çağırma modelini olduğu gibi almamak lazım — bu, kullanıcı koduna sessiz bir determinizm yükümlülüğü bindiriyor ve ihlali her zaman yakalayamıyor (sadece adım adı değişirse fark ediliyor).

saglayici_bagimsiz: kismen — Postgres/SQLite arasında seçim var ve bulut vendor kilidi yok, ama LLM/model sağlayıcısı kavramı bu projede yok (durable execution kütüphanesi, LLM'e bağımlı değil zaten).
sozlesme_var: evet — `@DBOS.workflow`/`@DBOS.step`/`@DBOS.transaction` dekoratörleri ve `function_name` eşleşme kontrolü (`DBOSUnexpectedStepError`) açık bir sözleşme oluşturuyor.
insan_kapisi: kismen — `DBOS.send`/`DBOS.recv` (`dbos/_dbos.py:1709,1823`) ve durable sleep ile elle bir onay-bekleme adımı kurulabilir, ama LangGraph'taki gibi birincil sınıf bir "interrupt/human-approval" API'si yok.
checkpoint: evet — `operation_outputs` + `workflow_status` ile kanıtlı, adım bazlı, adım tamamlandıktan sonra yazılan bir checkpoint tablosu.
