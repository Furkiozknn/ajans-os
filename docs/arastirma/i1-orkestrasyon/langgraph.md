# LangGraph

## Kimlik

langchain-ai/langgraph · 41.147 yıldız · 179 watcher · son push 2026-09-06 · MIT · Python (kütüphane sürümü `libs/langgraph/pyproject.toml:7` → `1.2.11`, `requires-python = ">=3.10"`) · arşivlenmemiş · canlılık: geçti.
PyPI haftalık indirme: doğrulanmadı (bu incelemede PyPI'ye erişilmedi).
Not: aynı repo altında ayrı sürümlenen çekirdek kütüphaneler var: `libs/checkpoint`, `libs/checkpoint-sqlite`, `libs/checkpoint-postgres`, `libs/prebuilt`, `libs/cli`, `libs/sdk-py`, `libs/sdk-js` — LangGraph tek paket değil, bir kütüphane ailesi.

## Çözdüğü problem

LLM tabanlı çok-adımlı/çok-ajanlı iş akışlarını, düz bir zincir (chain) yerine **durum makinesi + graf** olarak modelleme problemi: döngü (loop), koşullu dallanma, paralel fan-out/fan-in, uzun süren insan-onayı bekleyen adımlar ve süreç çöktüğünde kaldığı yerden devam etme ihtiyacı. LangChain'in doğrusal `Runnable` zincirleri bunu ifade edemiyordu; LangGraph, Google'ın Pregel/Bulk Synchronous Parallel (BSP) modelini uyarlayarak "aktörler kanallar üzerinden konuşur" soyutlamasını getiriyor (`libs/langgraph/langgraph/pregel/main.py:454` sınıf docstring'i: "Pregel combines actors and channels into a single application").

## Mimari

Veri akışı (BSP / superstep modeli):

```
Kullanıcı girdisi
   │
   ▼
Pregel.stream()/invoke()  ── pregel/main.py:2655, 3044
   │  (SyncPregelLoop / AsyncPregelLoop kurulur)
   ▼
PregelLoop.tick()  ── pregel/_loop.py:599
   │
   ├─ 1) prepare_next_tasks()      → pregel/_algo.py:349  (hangi node'lar tetiklendi?)
   ├─ 2) should_interrupt() kontrolü → pregel/_algo.py:155 (interrupt_before)
   ├─ 3) PregelRunner ile paralel çalıştırma → pregel/_runner.py:135
   │        (concurrent.futures / asyncio ile eşzamanlı task'lar)
   ├─ 4) her node run_with_retry() içinde çalışır → pregel/_retry.py:573
   └─ 5) after_tick(): apply_writes() → pregel/_algo.py:232
           (kanallara yaz, checkpoint'e versiyon bas, checkpointer.put())
   │
   ▼ (tasks kalmayınca) status="done"
```

Bileşen → dosya eşlemesi:
- **Graf tanımı (DSL)**: `graph/state.py:131` `StateGraph` — `add_node` (`:376`), `add_edge` (`:928`), `add_conditional_edges` (`:982`), `compile` (`:1177`).
- **Çalışma zamanı çekirdeği (Pregel)**: `pregel/main.py:454` sınıfı — `stream`/`astream` (`:2655`, `:3044`), `get_state`/`update_state` (`:1392`, `:2515`).
- **Superstep döngüsü**: `pregel/_loop.py:158` `PregelLoop`, somut alt sınıflar `SyncPregelLoop` (`:1469`) ve `AsyncPregelLoop` (`:1722`).
- **Görev planlama / yazma birleştirme**: `pregel/_algo.py` — `prepare_next_tasks` (`:349`), `apply_writes` (`:232`), `should_interrupt` (`:155`), `prepare_push_task_send` (`:938`, Send/Command→görev dönüşümü).
- **Paralel yürütücü**: `pregel/_runner.py:135` `PregelRunner`, arka plan havuzu `pregel/_executor.py:40` `BackgroundExecutor` / `:122` `AsyncBackgroundExecutor`.
- **Yeniden deneme/timeout**: `pregel/_retry.py:573` `run_with_retry` (sync), aynı dosyada async karşılığı.
- **Kanal (state merge) soyutlaması**: `channels/base.py:19` `BaseChannel`; somut kanallar `channels/last_value.py`, `channels/binop.py` (`BinaryOperatorAggregate`), `channels/topic.py`, `channels/ephemeral_value.py`.
- **Checkpoint arayüzü**: `libs/checkpoint/langgraph/checkpoint/base/__init__.py:177` `BaseCheckpointSaver`.
- **İnsan-döngüde / kesme**: `types.py:851` `interrupt()`, `errors.py:102` `GraphInterrupt`.
- **Dinamik dallanma ilkelleri**: `types.py:704` `Send`, `types.py:799` `Command`.
- **Uzun-vadeli bellek (store)**: `libs/checkpoint/langgraph/store/base/__init__.py:708` `BaseStore`.
- **Hazır ajan şablonu**: `libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py:278` `create_react_agent`, `libs/prebuilt/langgraph/prebuilt/tool_node.py:622` `ToolNode`.
- **Dağıtım manifestosu**: `libs/cli/examples/langgraph.json` — hangi python objesinin ("`./graphs/agent.py:graph`") sunulacağını bildiren dosya; CLI şeması `libs/cli/langgraph_cli/schemas.py`.

## Klasör yapısı

```
langgraph/                       (monorepo kökü)
├── libs/
│   ├── langgraph/                # çekirdek kütüphane (paket adı: langgraph)
│   │   └── langgraph/
│   │       ├── pregel/           # BSP yürütme motoru: loop, algo, runner, retry, checkpoint I/O
│   │       ├── channels/         # kanal (state alanı) tipleri: LastValue, BinaryOperatorAggregate, Topic...
│   │       ├── graph/            # StateGraph DSL: node/edge tanımlama, mesaj reducer'ları (message.py)
│   │       ├── managed/          # "yönetilmiş değerler" (ör. is_last_step) — kullanıcı yazmadığı otomatik alanlar
│   │       ├── func/             # @entrypoint / fonksiyonel API (graf yerine düz fonksiyonla ajan yazma)
│   │       ├── _internal/        # yeniden kullanılan yardımcılar (serde, retry, runnable sarmalayıcı, önbellek)
│   │       ├── types.py          # Command, Send, RetryPolicy, TimeoutPolicy, interrupt()
│   │       └── errors.py         # GraphInterrupt, GraphRecursionError, NodeTimeoutError...
│   ├── checkpoint/                # BaseCheckpointSaver + InMemorySaver + serde (jsonplus, msgpack, şifreli)
│   ├── checkpoint-sqlite/         # SQLite checkpoint backend'i
│   ├── checkpoint-postgres/       # Postgres checkpoint backend'i
│   ├── checkpoint-conformance/    # backend'lerin arayüze uygunluğunu test eden ortak test paketi
│   ├── prebuilt/                  # create_react_agent, ToolNode — hazır ReAct ajan kalıbı
│   ├── cli/                       # `langgraph.json` şeması, dev sunucusu, dağıtım paketleme
│   ├── sdk-py/ ve sdk-js/          # LangGraph Platform'a HTTP istemcisi (uzak graf çağırma)
│   └── ...
├── examples/                      # Jupyter defterleri: multi-agent, human_in_the_loop, rag, lats, rewoo...
└── docs/                          # mkdocs kaynak dosyaları (README'ye eşdeğer, koda dayanmaz)
```

## Ajan tasarımı

LangGraph'ta "ajan" birinci sınıf bir tip **değil**; bir graf üzerinde tekrarlayan bir kalıptır. Hazır şablon `create_react_agent` (`libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py:278`) şunu kurar: model-çağırma node'u → `should_continue` koşullu kenarı (`:831`, dönüş tipi `str | list[Send]`) → araç varsa `ToolNode`'a git, yoksa `END`'e git → `ToolNode` çalışınca tekrar model node'una dön. `ToolNode` (`tool_node.py:622`) LLM'in `tool_calls` alanını okuyup ilgili Python fonksiyonlarını (sync `_execute_tool_sync` `:922`) çalıştırıp `ToolMessage` üretir.

Çoklu-ajan (multi-agent) desenleri ayrı bir çekirdek soyutlamayla değil, aynı graf ilkelleriyle (alt-graf düğümleri, `Command(goto=...)` ile ajanlar arası devretme, `Send` ile map-reduce tipi fan-out) elde ediliyor — bkz. `examples/multi_agent/`. Yani ajan "kod" seviyesinde tanımlanır (Python düğüm fonksiyonu + LLM çağrısı), makine-okur bir "ajan sözleşmesi" dosyası (ör. YAML/JSON ile rol/araç/prompt tanımı) çekirdekte yoktur.

## Orkestrasyon / iş akışı modeli

Pregel/BSP superstep modeli: her "adım" (`step`) içinde tetiklenen tüm node'lar **paralel** çalışır (`pregel/_runner.py:135` `PregelRunner`, `concurrent.futures`/`asyncio` ile), hepsi bitince yazmalar tek seferde `apply_writes` (`pregel/_algo.py:232`) ile kanallara uygulanır, ardından hangi node'ların yeni versiyonlu kanalları "gördüğü" hesaplanıp bir sonraki superstep'in görev listesi çıkarılır (`prepare_next_tasks`, `pregel/_algo.py:349`). Node yoksa döngü biter (`pregel/_loop.py:648-651`: `if not self.tasks: self.status = "done"`).

Dinamik dallanma iki ilkelle sağlanıyor:
- `Send(node, arg)` (`types.py:704`): bir koşullu kenar fonksiyonu, farklı state'lerle aynı node'u N kez tetiklemek üzere `Send` listesi döndürebilir (map-reduce). Çalışma zamanında bunlar `TASKS` kanalına yazılır, sonraki superstep'te `prepare_push_task_send` (`pregel/_algo.py:938`) bu paketleri gerçek görevlere çevirir.
- `Command(graph=..., update=..., resume=..., goto=...)` (`types.py:799`): bir node'un dönüş değeri olarak hem state güncellemesi hem de sıradaki node'u (`goto`) veya (`Command.PARENT` ile) ebeveyn grafa mesaj göndermeyi tek nesnede birleştirir; `pregel/_retry.py:614-627`'de `ParentCommand` istisnası yakalanıp ilgili `task.writers`'a uygulanıyor ya da üst grafa "bubble up" ediliyor.

Adım sayısı `recursion_limit` ile sınırlı: `pregel/_loop.py:1701` `self.stop = self.step + recursion_limit + 1`; aşılırsa `GraphRecursionError` fırlatılır (`pregel/main.py:3011`).

## Durum ve bellek

İki katmanlı bellek modeli var:

1. **Kısa vadeli (thread/oturum) durum** — kanallar (`channels/base.py:19` `BaseChannel`) aracılığıyla: her state alanı bir kanal tipine bağlanır. `LastValue` (`channels/last_value.py:20`) tek node'un yazabileceği "son değer kazanır" alanlar için (birden fazla node aynı adımda yazarsa `InvalidUpdateError`); `BinaryOperatorAggregate` (`channels/binop.py`) `operator.add` gibi bir indirgeyici ile çoklu yazmaları birleştirir (ör. mesaj listesine ekleme) ve `Overwrite` sarmalayıcısıyla (`channels/binop.py:31`) reducer'ı atlayıp değeri tamamen değiştirmeye izin verir. Bu durum her superstep sonunda `apply_writes` ile checkpoint'e (`Checkpoint["channel_values"]`, `libs/checkpoint/langgraph/checkpoint/base/__init__.py:93`) yazılır.
2. **Uzun vadeli/paylaşılan bellek** — `BaseStore` (`libs/checkpoint/langgraph/store/base/__init__.py:708`): `namespace: tuple[str,...]` + `key` ile `get`/`put`/`search`/`delete` (satır `:756,856,779,937`) sağlayan, thread sınırlarını aşan (ör. kullanıcı bazlı) anahtar-değer + vektör arama deposu; checkpoint'ten bağımsız bir ilkel.

Checkpoint devam edebilirlik: `BaseCheckpointSaver` (`libs/checkpoint/langgraph/checkpoint/base/__init__.py:177`) `get`/`get_tuple`/`list`/`put`/`put_writes` (+ async eşdeğerleri) soyut arayüzünü tanımlar; somut backend'ler `InMemorySaver` (`libs/checkpoint/langgraph/checkpoint/memory/__init__.py`), SQLite (`libs/checkpoint-sqlite`), Postgres (`libs/checkpoint-postgres`). Her superstep sonunda üretilen `Checkpoint` nesnesi (id, ts, channel_values, channel_versions, versions_seen) kaydedilir; aynı `thread_id`/`checkpoint_id` ile `graph.stream(None, config)` veya `Command(resume=...)` çağrısı, `is_replaying`/`checkpoint_pending_writes` mekanizmasıyla (`pregel/_loop.py:664-666`) kaldığı superstep'ten devam eder.

## Hata yönetimi

- **İnsan-döngüde kesme**: `interrupt(value)` (`types.py:851`) node içinden çağrılır; scratchpad'de daha önce bir "resume" değeri yoksa `GraphInterrupt` fırlatır (`types.py:966-975`), bu istisna `GraphBubbleUp`'tan türer (`errors.py:50`) ve normal hata değildir — kasıtlı olarak yürütmeyi durdurup state'i checkpoint'e yazdırır. Devam ederken node **baştan yeniden çalıştırılır** (docstring, `types.py:864`: "re-executing all logic") ve `interrupt` çağrıları sıradaki kayıtlı resume değerlerini döndürür — bu yüzden node içinde interrupt'tan önceki yan etkilerin idempotent olması gerektiği örtük bir tasarım kısıtıdır.
- **Otomatik yeniden deneme**: `RetryPolicy` (`types.py:418`) — `initial_interval=0.5`, `backoff_factor=2.0`, `max_interval=128.0`, `max_attempts=3`, `jitter=True`, `retry_on` (varsayılan `default_retry_on`). `run_with_retry` (`pregel/_retry.py:573`) `GraphBubbleUp` (interrupt/parent-command) ve `asyncio.CancelledError`'ı **retry'a hiç sokmaz** (`pregel/_retry.py:626-635`), yalnız genel `Exception`'ları politika eşleşirse üstel geri çekilme + jitter ile yeniden dener.
- **Zaman aşımı**: `TimeoutPolicy` (`types.py`, `run_timeout`/`idle_timeout`), sync node'larda desteklenmiyor (`pregel/_retry.py:582-584`: `sync_timeout_unsupported` fırlatılır) — sadece async node'larda asyncio iptali ile çalışır.
- **Döngü/derinlik sınırı**: `GraphRecursionError` (`errors.py:67`), `recursion_limit` aşımında.
- **Diğer sınıflandırılmış hatalar**: `InvalidUpdateError` (`errors.py:90`, çakışan eşzamanlı yazma), `NodeTimeoutError`, `NodeCancelledError`, `EmptyInputError`, `TaskNotFound` (`errors.py` sırasıyla `:190,168,136,142`).
- Kesme/hata state'i checkpoint'e yazıldığından, çöken bir çalıştırma kaldığı superstep'ten yeniden başlatılabiliyor (bkz. Durum ve bellek).

## Genişletilebilirlik

- **Yeni kanal tipi**: `BaseChannel` (`channels/base.py:19`) alt sınıflanarak özel birleştirme mantığı (ör. son-N mesaj, öncelik kuyruğu) eklenebilir; state alanına `Annotated[T, MyChannel]` ile bağlanır.
- **Yeni checkpoint backend'i**: `BaseCheckpointSaver` (`libs/checkpoint/.../base/__init__.py:177`) 6 sync + 6 async metodu (`get/get_tuple/list/put/put_writes/delete_thread` + `a*`) implemente ederek eklenir; repo bunun ispatı olarak sqlite/postgres/memory olmak üzere 3 ayrı paket barındırıyor, artı `checkpoint-conformance` ile arayüz uyumluluğu ayrı test ediliyor.
- **Yeni store backend'i**: `BaseStore` (`store/base/__init__.py:708`) benzer şekilde soyut.
- **Fonksiyonel API**: `func/__init__.py` — graf çizmeden `@entrypoint`/`@task` dekoratörleriyle aynı checkpoint/retry altyapısını kullanma yolu (StateGraph'a alternatif, daha az boilerplate).
- **Serileştirme katmanı değiştirilebilir**: `libs/checkpoint/langgraph/checkpoint/serde/` altında `jsonplus`, `_msgpack`, `encrypted.py` (checkpoint'i şifreleme desteği) — `SerializerProtocol` üzerinden özelleştirilebilir.
- **Dağıtım/CLI katmanı ayrı paket**: `libs/cli` — graf tanımı ile dağıtım paketleme (`langgraph.json`) ayrıştırılmış, bu da çekirdek kütüphaneyi platform bağımsız tutuyor.

## Güçlü yönler (kanıtlı)

- Checkpoint+kanal versiyonlama tasarımı gerçekten "kaldığı yerden devam" garantisi veriyor: `versions_seen` (`checkpoint/base/__init__.py:116-121`) her node'un hangi kanal versiyonunu gördüğünü tutarak, replay sırasında hangi node'ların tekrar tetikleneceğini deterministik hesaplıyor (`_algo.py:349` `prepare_next_tasks`).
- İnterrupt/retry ayrımı net kodlanmış: `GraphBubbleUp` özel olarak retry mekanizmasının dışında tutuluyor (`pregel/_retry.py:626-627`), yani "kasıtlı duraklama" ile "gerçek hata" karışmıyor — insan-onay akışlarının retry fırtınasına yakalanmaması sağlanmış.
- Paralel superstep yürütmesi (fan-out/fan-in) hem sync (`concurrent.futures`) hem async (`asyncio`) yollar için ayrı ama simetrik `PregelRunner`/`BackgroundExecutor` sınıflarıyla uygulanmış (`pregel/_runner.py`, `pregel/_executor.py:40,122`), map-reduce tipi çok-node paralelliği (`Send`) çekirdek düzeyde destekleniyor.
- Checkpoint arayüzünün 3 farklı backend'de (`memory/sqlite/postgres`) ve ortak bir `checkpoint-conformance` test paketiyle doğrulanması, arayüzün soyutlama olarak olgunlaştığının somut kanıtı.

## Zayıf yönler (kanıtlı)

- `interrupt()` sonrası **tüm node fonksiyonu baştan çalışıyor** (`types.py:864` docstring'de açıkça yazıyor: "re-executing all logic") — node içinde interrupt'tan önce yan etkili bir çağrı (ör. dış API'ye yazma) varsa bu yan etki resume'da tekrar tetiklenir; framework bunu otomatik engellemiyor, geliştiricinin idempotent yazması gerekiyor. Bu, insan-onay akışlarında sessiz bir tuzak.
- Senkron node'larda zaman aşımı desteklenmiyor: `sync_timeout_unsupported` (`pregel/_retry.py:582-584`) sync bir node'a `TimeoutPolicy` verilirse çalışma zamanında hata fırlatıyor — belgelenmiş bir sınırlama ama pratikte "senkron kod yazan kullanıcı timeout koyamaz" demek.
- Ajan/araç tanımı makine-okur bir sözleşme değil, düz Python kodu (`create_react_agent`, `ToolNode`) — bu esneklik sağlarken, dışarıdan statik doğrulama/denetim (ör. "bu ajan hangi araçlara erişebilir" sorusunu koda girmeden cevaplama) zorlaşıyor; tek makine-okur parça dağıtım manifestosu `langgraph.json` (`libs/cli/examples/langgraph.json`) ve o da sadece "hangi python objesi sunuluyor" bilgisini taşıyor, rol/izin/araç kapsamını değil.
- Riskli/dışa-açılan işlemler (e-posta gönderme, ödeme, dosya silme) için çekirdekte özel bir "insan kapısı" birincil sınıfı yok; `interrupt()` genel amaçlı bir duraklatma ilkeli — güvenli/riskli ayrımı tamamen uygulama geliştiricisinin `interrupt()`'ı doğru yere koymasına bağlı, çerçeve seviyesinde zorunlu kılınmıyor.

## Puan (1-5)

olgunluk: 5 — 3 farklı checkpoint backend'i, ayrı conformance test paketi ve v1.2.11 sürüm numarası, uzun süredir üretimde kullanılan bir API yüzeyine işaret ediyor.
mimari netlik: 4 — Pregel/BSP modeli net dosya ayrımıyla (`_loop.py`/`_algo.py`/`_runner.py`/`_retry.py`) uygulanmış, ama `pregel/main.py` tek dosyada 3500+ satır olup `Pregel` sınıfının sorumluluk alanı geniş.
genişletilebilirlik: 5 — kanal, checkpoint, store, serde katmanlarının hepsi ayrı soyut arayüzlerle (`BaseChannel`, `BaseCheckpointSaver`, `BaseStore`) değiştirilebilir olarak tasarlanmış ve gerçek 3.-parti implementasyonlarla kanıtlanmış.
güvenilirlik ilkelleri: 4 — retry (üstel geri çekilme+jitter), timeout (yalnız async), recursion limit ve checkpoint-tabanlı devam etme mevcut; sync timeout eksikliği ve interrupt-sonrası yeniden-çalıştırma riski notu düşüyor.
gözlemlenebilirlik: 3 — `debug.py`/`map_debug_tasks`/`map_debug_checkpoint` (`pregel/_loop.py:629-648`) ile adım/checkpoint olayları stream edilebiliyor, ama çekirdekte yerleşik metrik/iz (tracing) sağlayıcısı yok; bu iş LangSmith gibi harici bir üst pakete bırakılmış.
güvenlik duruşu: 2 — kodda risk sınıflandırması, izin/scope kontrolü veya "onay gerektir" birincil kurulumu yok (`interrupt()` genel amaçlı, güvenlik odaklı değil); şifreli checkpoint serde (`serde/encrypted.py`) var olması tek somut güvenlik ilkeli.

## Alınacak fikir

- **Superstep + kanal-versiyonlama tabanlı checkpoint modeli** — `checkpoint/base/__init__.py:93-121` (`channel_versions`, `versions_seen`) — neden: kaldığı-yerden-devam'ı "son mesajı hatırla" seviyesinde değil, hangi node'un hangi veri versiyonunu gördüğü seviyesinde çözüyor; ajans-os'un ADR-000 kararındaki "checkpoint'ten devam edilebilir" gereksinimine doğrudan bir referans mimari olur — otomasyon çalıştırıcısının durum kalıcılığı katmanı buradan esinlenebilir.
- **`GraphBubbleUp` / kasıtlı-duraklama istisnasının retry'dan ayrık tutulması** (`pregel/_retry.py:626-627`) — neden: "insan onayı bekle" ile "gerçek hata" birbirine karışmasın diye ayrı bir istisna hiyerarşisi kullanmak ucuz ve etkili bir desen; ajans-os'un "riskli işlemde insan kapısı" (ONAY-BEKLEYENLER.md) mekanizması, alttaki yürütücüde benzer bir "bubble-up, retry etme" istisna sınıfına oturtulabilir.
- **Soyut depolama arayüzleri + conformance test paketi** (`BaseCheckpointSaver`, `checkpoint-conformance`) — neden: backend'i (dosya/SQLite/Postgres) değiştirilebilir kılıp arayüz sözleşmesini otomatik test etmek; ajans-os'un `gorevler/`, `raporlar/` gibi dosya-tabanlı durumunu ileride bir veritabanına taşımak istenirse aynı "arayüz + conformance testi" deseni kullanılabilir.

## Alınmayacak

- **Tüm çekirdek DSL'in imperatif Python graf inşası** (`StateGraph.add_node/add_edge`, `graph/state.py:376,928`) — neden: ajans-os'un "makine-okur sözleşme" hedefiyle çelişir; görev/ajan tanımının veri (YAML/JSON) olması isteniyor, LangGraph'ta ajan mantığı kod olarak gömülü ve statik analiz/denetim zor.
- **`interrupt()`'ın node'u baştan yeniden çalıştırma semantiği** (`types.py:864`) — neden: yan etkili adımlarda tekrar-çalıştırma riski taşıyor; ajans-os'ta insan-onay noktaları için "sadece onay bekleyen adımdan devam et, öncesini tekrar çalıştırma" daha güvenli bir birincil davranış olmalı.
- **Sync node'larda timeout desteğinin olmaması** (`pregel/_retry.py:582-584`) — neden: ajans-os headless/otomatik çalıştırmalarda "hiç bitmeyen adım" riski kabul edilemez; bu sınırlamayı miras almak yerine yürütücüde zaman aşımını sync/async ayrımı yapmadan zorunlu kılmak gerekir.

## Matris cevapları

saglayici_bagimsiz: evet — çekirdek Pregel motoru (`pregel/main.py`, `pregel/_loop.py`, `pregel/_algo.py`) hiçbir LLM sağlayıcısına bağımlı değil; tek "openai" referansı `graph/message.py:65,236,378` içinde isteğe bağlı bir mesaj biçimlendirme yardımcısı (`format="langchain-openai"`), zorunlu bağımlılık değil.
ajan_makine_okur_sozlesme: kısmen — dağıtım tarafı bir manifesto var (`libs/cli/examples/langgraph.json`: hangi python nesnesinin graf olarak sunulacağı) ve graf `get_graph()` ile içgözlenip JSON şema/Mermaid'e çevrilebiliyor (`pregel/main.py:845,980,1028`), ama ajanın kendisi (rol, prompt, araç kapsamı, davranış) veri değil düz Python kodu olarak tanımlanıyor — dolayısıyla dışarıdan statik/veri-güdümlü bir "ajan sözleşmesi" yok.
riskli_islemde_insan_kapisi: kısmen — `interrupt()` (`types.py:851`) ve `Command(resume=...)` (`types.py:806-812`) ile genel amaçlı bir duraklat/onayla mekanizması var ve checkpoint'e dayanıyor, ama bu bir "riskli işlem" sınıflandırması veya zorunlu kapı değil; hangi node'un ne zaman kesileceğine tamamen uygulama geliştiricisi karar veriyor, çerçeve seviyesinde varsayılan/zorunlu bir güvenlik kapısı yok.
checkpointten_devam: evet — `BaseCheckpointSaver.get_tuple/put/put_writes` (`checkpoint/base/__init__.py:240,278,301`) ile her superstep sonunda durum kalıcı hale getiriliyor; `channel_versions`/`versions_seen` sayesinde aynı `thread_id` ile tekrar çağrıldığında yürütme kaldığı superstep'ten devam ediyor (`pregel/_loop.py:664-666`, `is_replaying`/`checkpoint_pending_writes` mantığı).
