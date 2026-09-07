# ai-workflow-engine (kullanıcının kendi deposu)

## Kimlik

Furkiozknn/ai-workflow-engine · 0 yıldız · 0 watcher · son push 2026-09-06 · ilk commit 2026-08-31 · MIT · Python (>=3.11) · arşivlenmemiş.

Canlılık kuralı: son push ≤90 gün + arşivlenmemiş + OSI lisans (MIT) → **geçti**. Ama bu "kullanımda kanıtlanmış" anlamına gelmiyor: depo 1 haftalık, 0 yıldız/fork/watcher, tek yazar (kullanıcının kendisi), dışarıdan hiçbir kullanım sinyali yok. Commit geçmişi 9 commit, hepsi aynı yazara ait, günler içinde art arda (`git log`: 613e85e ilk implementasyon → 9b1a89f son commit, README'de test sayısı düzeltmeleri dahil). Olgunluk iddiası yalnızca "kod var ve testleri geçiyor" seviyesinde; production'da çalıştığına dair hiçbir kanıt (CI, kullanıcı, issue, gerçek ai-job-gateway'e karşı entegrasyon çalıştırması) yok.

## Çözdüğü problem

`ai-job-gateway`'e (kullanıcının başka bir deposu) tek tek iş (job) göndermek yerine, birden fazla işi (generate → upscale → lip-sync gibi) bir YAML dosyasında tanımlayıp bağımlılık sırasına göre otomatik yürütmek (`README.md:11`). Motivasyon: "submit, poll, sonucu bir sonraki job'a elle taşı" döngüsünü ortadan kaldırmak.

## Mimari (bileşen + veri akışı, dosya yolu ver)

Tek paket, 6 modül, ~950 satır kaynak kod:

- `src/ai_workflow_engine/pipeline.py` (264 satır) — YAML'ı ayrıştırır, `Step`/`Pipeline` dataclass'larına çevirir, DAG doğrulamasını yapar (döngü kontrolü, bilinmeyen bağımlılık, `steps.<ad>` referansı ile `depends_on` tutarlılığı) ve `execution_layers()` ile paralel çalıştırılabilir katmanlara ayırır.
- `src/ai_workflow_engine/templating.py` (118 satır) — her step'in `params` alanındaki string değerleri Jinja2 ile render eder (`_ENV = SandboxedEnvironment(undefined=StrictUndefined)`, satır 31); ayrıca statik olarak `steps.*` / `vars.*` referanslarını AST üzerinden tarar (`find_step_references`, `find_var_references`, satır 111-118).
- `src/ai_workflow_engine/gateway_poll.py` (115 satır) — I/O yapmayan, saf mantık modülü: submit/poll HTTP yanıtlarını yorumlar (410-Gone-on-expiry özel durumu, `status` alanına göre ready/error/pending sınıflandırması). Dosyanın kendi docstring'i (satır 4-27) bu dosyanın **vendored** (pip bağımlılığı değil, elle kopyalanmış) olduğunu ve `ai-job-gateway`, `prompt-template-manager`, `model-comparison-harness` depolarında da aynı dosyanın bulunduğunu, senkronizasyonun elle yapıldığını söylüyor — yani kod paylaşımı import ile değil, insan disiplinine dayalı kopya-yapıştır ile sağlanıyor.
- `src/ai_workflow_engine/runner.py` (221 satır) — `run_pipeline()`: `execution_layers()`'ın döndürdüğü her katmanı `asyncio.gather` ile paralel çalıştırır (satır 176-206), `httpx.AsyncClient` ile submit/poll yapar, sonucu bir sonraki katmanın Jinja2 bağlamına (`steps_context`) ekler.
- `src/ai_workflow_engine/cli.py` (137 satır) — `awe validate` ve `awe run` alt komutları (argparse).

Veri akışı: YAML dosyası → `load_pipeline()` (pipeline.py:89) → `Pipeline` nesnesi → `execution_layers()` (pipeline.py:248) katmanlara böler → `run_pipeline()` (runner.py:148) her katmanı sırayla, katman içini paralel yürütür → her step'in sonucu `steps_context[step_name] = {"status":..., "result":...}` (runner.py:209) olarak bir sonraki katmanın Jinja2 render bağlamına eklenir → CLI sonucu JSON olarak stdout'a basar (cli.py:87-90).

## Klasör yapısı (2 seviye, yorumlu)

```
ai-workflow-engine/
├── LICENSE                          # MIT
├── README.md                        # kapsamlı, güçlü/zayıf yönler bölümü dahil
├── pyproject.toml                   # httpx, pyyaml, jinja2; dev grubunda pytest + pytest-asyncio
├── assets/                          # README'deki SVG diyagramlar (banner, pacing, validation, failure)
├── examples/
│   ├── generate-and-upscale.yaml    # 2 adımlı, hosted+local karışık örnek pipeline
│   └── local-media-chain.yaml       # 3 adımlı, tamamen offline örnek pipeline
├── src/ai_workflow_engine/
│   ├── __init__.py                  # (27 satır, paket metadata/export)
│   ├── cli.py                       # awe validate|run komutları
│   ├── gateway_poll.py              # vendored, I/O'suz submit/poll yorumlayıcı
│   ├── pipeline.py                  # YAML ayrıştırma + DAG doğrulama + katmanlama
│   ├── runner.py                    # asyncio tabanlı yürütme motoru
│   └── templating.py                # sandboxed Jinja2 render + statik referans tarayıcı
└── tests/                           # 4 dosya, 72 test (aşağıda detay)
```

## Ajan tasarımı

Bu depoda "ajan" kavramı yok — LLM çağıran, karar veren, plan üreten bir bileşen bulunmuyor. Her "step" bir `ai-job-gateway` capability'sine (ör. `generate-image`, `media-upscale`) yapılan düz bir HTTP job submission'ı (pipeline.py:69, gateway_poll.py:58-60). Motor kendisi hiçbir LLM sağlayıcısına (OpenAI, Anthropic vb.) doğrudan bağlanmıyor; LLM/model çağrısı tamamen `ai-job-gateway` tarafının sorumluluğunda, bu depo yalnızca o gateway'e job gönderip sonucu bekleyen bir orkestratör. Yani "LLM sağlayıcı soyutlaması" bu depoda yok — soyutlama tek katman aşağıda, gateway'in `capability` string'i üzerinden yapılıyor (pipeline.py:29, `_CAPABILITY_RE`).

## Orkestrasyon / iş akışı modeli

- **DAG + topolojik katmanlama**: `execution_layers()` (pipeline.py:248-264) klasik Kahn algoritması ile çalışıyor — `remaining` sözlüğünden bağımlılığı biten adımları çıkarıp sıralı katmanlar oluşturuyor. Döngüsellik zaten `_check_acyclic()` (pipeline.py:223-245, DFS + gri/siyah renklendirme) ile yükleme anında engelleniyor.
- **Katman içi paralellik**: `runner.py:176-206`, her katmanın adımları `asyncio.gather(*(run_one(name) for name in layer))` ile eşzamanlı çalıştırılıyor.
- **Eşzamanlılık sınırlama**: `asyncio.Semaphore(max_concurrent_steps)` (runner.py:168, varsayılan 10 — `DEFAULT_MAX_CONCURRENT_STEPS`, runner.py:66) geniş bir katmanın gateway'i aynı anda boğmasını engelliyor; test edilmiş (`test_a_wide_layer_does_not_submit_every_step_at_once`, test_runner.py:234).
- **Polling backoff**: `_next_poll_interval()` (runner.py:69-80) job genç iken (< 1s) sabit aralıkla, sonra 1.5x geometrik büyüyerek 5s tavana kadar artan bir polling stratejisi; test edilmiş (test_runner.py:298-372).
- Bağımlılık grafiği **statik ve elle beyan edilen** `depends_on` alanına dayanıyor; şablon referanslarından (`steps.x...`) otomatik çıkarılmıyor, ama tutarsızlık (`steps.x` referansı var, `depends_on`'da `x` yok) yükleme anında hata veriyor (pipeline.py:171-207).

## Durum ve bellek

Durum tamamen **process-içi ve geçici**: `results` ve `steps_context` sözlükleri `run_pipeline()` çağrısı içinde yaşıyor (runner.py:172-173), fonksiyon bitince kayboluyor. Kalıcı depolama (dosya, DB, dış hizmet) yok. README bunu açıkça itiraf ediyor: "No persistence — a pipeline run's state lives only in the process that ran `awe run`" (README.md:168).

## Hata yönetimi

- **Retry yok**: bir step hata verirse tüm çalıştırma `PipelineRunError` ile durur (runner.py:211-216); README bunu doğruluyor ("No retry policy per step — a failed step fails the whole run", README.md:166).
- **Fallback yok**: alternatif capability/sağlayıcıya geçiş mekanizması bulunmuyor.
- **Timeout var**: her step için `timeout` parametresi (varsayılan 60s, cli.py:105) `_run_step()` içinde `deadline` ile uygulanıyor (runner.py:118-133); süresi dolan job `RuntimeError` fırlatıyor.
- **Checkpoint/resume yok**: README açıkça belirtiyor — "There's no resume-from-where-it-failed yet; re-running re-executes every step from scratch" (README.md:168).
- **Kısmi sonuç görünürlüğü var**: bir katmanda hata olduğunda, önceki katmanların/aynı katmandaki başarılı adımların sonuçları `PipelineRunError.partial_results` üzerinden korunuyor (runner.py:212-216) ve CLI bunu `[OK]`/`[FAIL]` olarak basıyor (cli.py:81-84) — hata sonrası tam kör kalmıyor, ama otomatik devam/resume mekanizması yok.
- **Güvenlik sertleştirmesi (hata sınıfı önleme, retry değil)**: capability path injection'a karşı regex (pipeline.py:23-29, commit 636b312), Jinja2 SSTI'ye karşı sandboxing (templating.py:10-20, commit 2b2824d), YAML anchor/alias "billion laughs" saldırısına karşı özel loader (pipeline.py:36-63, commit 2b2824d). Bunlar gerçek CVE-sınıfı sorunları hedefleyen, gerekçesi docstring'lerde açıkça yazılmış düzeltmeler — depo küçük olmasına rağmen bu konuda özenli.

## Genişletilebilirlik

- Yeni bir "capability" eklemek motor tarafında hiçbir değişiklik gerektirmiyor — capability düz bir string, gateway tarafında tanımlı (pipeline.py:130-137). Motor capability'nin ne yaptığını bilmiyor.
- Yeni bir yürütme stratejisi (ör. farklı bir HTTP sözleşmesine sahip gateway) eklemek `gateway_poll.py`'nin elle kopyalanmasını gerektiriyor — modül kasıtlı olarak vendored, paylaşılan bir kütüphane değil (gateway_poll.py:4-27). Bu, DRY ihlalini bilinçli bir mimari tercih olarak sunuyor ama gerçek maliyeti var: 4 depoda senkron tutulması gereken kopya kod, senkronizasyon otomasyonu yok.
- CLI'a yeni bayrak eklemek (`--max-concurrent-steps`, `--poll-interval` gibi) kolay — argparse tabanlı, tek dosyada (cli.py:97-130).
- Plugin/eklenti sistemi yok; yeni bir template fonksiyonu/filtresi eklemek `_ENV` nesnesini elden geçirmeyi gerektiriyor (templating.py:31).

## Güçlü yönler (kanıtlı)

- **Test kapsamı gerçek ve geniş oranla motoru kapsıyor**: `uv run pytest` ile 72 test, hepsi geçti (yerel çalıştırma sonucu). `tests/test_runner.py` (372 satır, ~20 test) `httpx.MockTransport` ile sahte bir gateway simüle ediyor ve gerçek `asyncio` yürütme yolunu (paralellik, semaphore sınırı, backoff, hata durumunda kısmi sonuç) uçtan uca test ediyor — bunlar "gerçek yürütmeyi" (mock transport üzerinden de olsa asyncio.gather + polling + concurrency gating) test eden testler, salt birim testi değil.
- **Güvenlik gerekçeleri iz bırakılabilir**: her güvenlik düzeltmesi (capability injection, YAML anchor bombası, Jinja2 SSTI) hem kod içi docstring'de hem commit mesajında somut istismar senaryosuyla açıklanmış (pipeline.py:23-29, templating.py:10-20) — "güvenlik için düzelttim" değil, "şu payload şunu yapıyordu, şu yüzden kapattım" seviyesinde kanıtlı.
- **Hata mesajları eyleme dönüktür**: `_describe_unknown_step()` (pipeline.py:164-168) `difflib.get_close_matches` ile "did you mean X?" öneriyor; eksik `depends_on` hatası (pipeline.py:200-207) hangi step'in hangi bağımlılığı eklemesi gerektiğini tam olarak söylüyor.
- **README dürüst**: kendi eksiklerini ("No retry", "No persistence") açıkça listeliyor — pazarlama abartısı yok.

## Zayıf yönler (kanıtlı)

- **Sıfır gerçek dünya doğrulaması**: 0 yıldız, 0 fork, 1 haftalık, tek geliştirici, hiçbir CI göstergesi (`.github/workflows` bulunamadı — depo kökünde CI dosyası yok). "Çalışıyor" iddiası sadece mock testlere dayanıyor; gerçek bir `ai-job-gateway` sunucusuna karşı entegrasyon testi/çalıştırması yok.
- **Retry/fallback/checkpoint tamamen yok** — kendi README'sinin de kabul ettiği gibi (README.md:166,168), tek bir adım hatası koca run'ı sıfırdan tekrar gerektiriyor. Uzun/pahalı pipeline'larda bu ciddi bir maliyet.
- **Durum kalıcılığı yok**: process çökerse ya da CLI kapanırsa, o ana kadar üretilen sonuçlar (`partial_results`) sadece exception nesnesi üzerinde bir kez yakalanabiliyor; hiçbir yere yazılmıyor, disk/DB'de iz bırakmıyor.
- **Vendored kod senkronizasyon riski**: `gateway_poll.py`'nin 4 depoda elle senkronize tutulması gerektiği belgeleniyor (gateway_poll.py:23-27) ama bunu doğrulayan otomatik bir test/araç yok — sürüklenme (drift) sessizce olabilir.
- **Statik referans taraması kısıtlı**: `find_step_references`/`find_var_references` sadece dotted-attribute biçimini (`steps.generate.result`) yakalıyor, `steps[var]` gibi dinamik erişimi yakalamıyor (templating.py:75-79) — bu bilinçli bir sınır olarak belgelense de, validate-time garantisini zayıflatıyor.
- **Tek bir HTTP sözleşmesine kilitli**: motor yalnızca `ai-job-gateway`'in submit/poll (202 + polling_url, sonra status=ready/error/expired) sözleşmesine bağlı (gateway_poll.py); başka bir job API'siyle (ör. doğrudan senkron REST çağrısı, webhook tabanlı) çalışmak için gateway_poll.py'nin yeniden yazılması gerekir — "sağlayıcı bağımsız" değil, "gateway sözleşmesi bağımsız değil".

## Puan (1–5)

- **olgunluk: 2** — çalışan kod ve geçen testler var, ama 1 haftalık, 0 kullanıcı/yıldız, hiçbir gerçek gateway'e karşı entegrasyon kanıtı yok; "vaat ile kanıtlanmış kullanım" arasında, ikincisine çok uzak.
- **mimari netlik: 4** — küçük, tek sorumluluklu modüller (pipeline/templating/gateway_poll/runner/cli), her dosyanın docstring'i neden o şekilde tasarlandığını açıklıyor (ör. gateway_poll.py:1-28, templating.py:1-21); okuması kolay.
- **genişletilebilirlik: 2** — yeni capability eklemek kolay ama yeni bir gateway sözleşmesi veya paylaşılan modülün gerçek bir kütüphaneye dönüşmesi elle kopyalamaya bağlı; plugin noktası yok.
- **güvenilirlik ilkelleri: 1** — retry, fallback, checkpoint/resume üçü de yok; tek hata tüm run'ı düşürüyor ve tekrar çalıştırma sıfırdan başlıyor (README.md:166,168).
- **gözlemlenebilirlik: 2** — sadece stdout/stderr'e JSON/insan-okunur çıktı var (cli.py:87-90); yapılandırılmış log, metrik, iz (trace) yok.
- **güvenlik duruşu: 4** — üç somut saldırı sınıfına (path injection, SSTI, YAML bomb) karşı açık, gerekçeli, test edilmiş savunma var (pipeline.py:23-63, templating.py:10-20, testlerde `test_yaml_anchor_alias_is_rejected`, `test_jinja2_ssti_gadget_chain_is_blocked_by_sandboxing`); bu boyutta bir depo için beklenenin üstünde.

## Alınacak fikir

- **Katmanlı DAG çalıştırma modeli (`execution_layers` + `asyncio.gather`)** — neden: basit, test edilebilir, "bağımlılığı olmayan işler paralel" garantisini kod okuyarak doğrulanabilir kılıyor (pipeline.py:248-264). ajans-os'ta orkestrasyon çekirdeğinin (I1) görev-bağımlılık grafiği yürütücüsü için doğrudan model olabilir.
- **`depends_on` + şablon referansı çapraz doğrulama** — neden: "sessizce yanlış sırada çalışan ama bazen doğru görünen" bug sınıfını yükleme anında kapatıyor (pipeline.py:171-207). ajans-os'ta ajanlar arası veri geçişi (bir ajanın çıktısını başka bir ajanın girdisi yapma) tanımlanırken aynı sınıf hatayı önlemek için benzer bir statik kontrol eklenmeli.
- **Eşzamanlılık sınırlama (semaphore + backoff)** — neden: paralel ajan çağrılarının alt sistemi (LLM API, araç sunucusu) boğmasını engelliyor, somut sabit gerekçelerle belgelenmiş (runner.py:41-66). ajans-os'ta çoklu-ajan fan-out'ta aynı desen (in-flight sınırı + geometrik backoff) uygulanmalı.
- **Hata mesajında "did you mean" önerisi (`difflib`)** — neden: ucuz, kullanıcı deneyimini doğrudan iyileştiriyor (pipeline.py:164-168); ajans-os'un görev/ajan tanım dosyalarında yazım hatalarını yakalarken kullanılabilir.

## Alınmayacak

- **Vendored (elle kopyalanmış) paylaşılan modül yaklaşımı (`gateway_poll.py`)** — neden: senkronizasyon insan disiplinine bağlı, otomatik doğrulama yok; drift riski gerçek ve belgeli (gateway_poll.py:23-27). ajans-os çok-depolu bir sisteme büyürse bu paylaşılan sözleşme kodu ya gerçek bir iç paket olmalı ya da sözleşme testiyle (contract test) senkron tutulmalı — düz kopyala-yapıştır alınmamalı.
- **State'i tamamen process-içi tutma** — neden: checkpoint/resume yokluğu ajans-os gibi uzun süren, çok adımlı ajan iş akışlarında kabul edilemez bir maliyet; uzun bir workflow'un ortasında düşmesi tüm işin sıfırdan tekrarını gerektirir. ajans-os'ta durum en azından adım sınırlarında kalıcı olmalı.

## Matris cevapları

- saglayici_bagimsiz: hayir — motor tek bir HTTP sözleşmesine (`ai-job-gateway`'in submit/poll API'si, gateway_poll.py) kilitli; LLM sağlayıcı soyutlaması motorun kendi katmanında yok, gateway'e devredilmiş.
- sozlesme_var: kismen — step'ler arası veri geçişi (`steps.<ad>.result`) ve `depends_on` tutarlılığı yükleme anında doğrulanıyor (pipeline.py:171-207), ama bu bir "ajan sözleşmesi" değil, düz bir DAG/şablon referans kontrolü; girdi/çıktı şeması (tip, zorunlu alan) doğrulaması yok.
- insan_kapisi: hayir — hiçbir onay/durdurma noktası yok; `awe run` başladıktan sonra tüm katmanlar otomatik ve kesintisiz yürütülüyor, hata dışında insan müdahale noktası tanımlı değil.
- checkpoint: hayir — README kendi ağzıyla doğruluyor: durum sadece process belleğinde, resume-from-failure yok (README.md:166,168; runner.py:172-173).
