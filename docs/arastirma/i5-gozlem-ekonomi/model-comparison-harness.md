# model-comparison-harness

> Kullanıcının kendi deposu. Protokol §5 gereği kayırma yok. İ5 için ilgi
> alanı: **değerlendirme/benchmark araçları** ve **gecikme ölçümü**.

## Kimlik

| Alan | Değer |
|---|---|
| repo | `Furkiozknn/model-comparison-harness` (yerel: `D:\Repolar\model-comparison-harness`) |
| yıldız / watcher | doğrulanmadı (ağ sorgusu yapılmadı) |
| son push | 2026-09-06 (`b8bf732`) |
| lisans | MIT (`pyproject.toml:6 "license = { text = \"MIT\" }"`) |
| dil | Python; 6 modül + 5 test dosyası, toplam ~1000 satır kaynak |
| bağımlılık | çekirdek yalnızca `pyyaml` + `httpx` (`pyproject.toml:11-14`); `litellm` **opsiyonel ekstra** (`pyproject.toml:22 "litellm>=1.97.0"`) |
| canlılık | **geçti** — son push 2 gün önce, arşivlenmemiş, OSI lisanslı |

## Çözdüğü problem

"Aynı işi birden çok sağlayıcıya/uç noktaya verip hangisi daha hızlı ve
hangisi daha iyi sonuç veriyor" sorusunu tekrarlanabilir biçimde cevaplayan
küçük bir CLI. Hedef kitle: bir model/servis seçmeden önce ölçmek isteyen
geliştirici. `promptfoo`/`DeepEval` sınıfının minimal, bağımlılık-fakiri
akrabası — ama prompt değil **backend** karşılaştırıyor.

## Mimari

Üç katman, ikisi tamamen jenerik:

```
cli.py            argparse: `mch validate` / `mch run` → tablo veya CSV
   │
   ▼
runner.py         run_comparison(backends, params, timeout, rubric)
   │              → asyncio.gather ile HEPSİ AYNI ANDA
   │              → backend başına ComparisonResult (durum, süre, sonuç, not)
   ├──────────────┐
   ▼              ▼
backends.py    grading.py
Backend(ABC)   judge model zinciri (litellm) → GradeResult(passed, score, reason)
 ├ MockBackend
 ├ GatewayBackend  ─→ gateway_poll.py (submit/poll sözleşmesi, saf fonksiyonlar)
 └ HttpBackend
   │
   ▼
config.py       YAML → Backend nesneleri (_BUILDERS sözlüğü, tip→kurucu)
```

Ayrılık temiz: `runner.py` hangi backend olduğunu bilmiyor, `backends.py`
kimin çağırdığını bilmiyor, `gateway_poll.py` ağ yapmıyor (saf
sınıflandırma fonksiyonları — bu yüzden test edilebilir).

## Klasör yapısı

```
model-comparison-harness/
├── src/model_comparison_harness/
│   ├── backends.py       Backend(ABC) + Mock/Gateway/Http üç uygulama (184)
│   ├── runner.py         eşzamanlı yürütme, süre ölçümü, not verme (116)
│   ├── grading.py        judge model zinciri + rubrik prompt'u (120)
│   ├── gateway_poll.py   submit/poll HTTP sözleşmesinin saf mantığı (115)
│   ├── config.py         YAML yükleyici, tip→kurucu eşlemesi (97)
│   └── cli.py            argparse, tablo/CSV biçimleyici (185)
├── examples/             compare-mocks.yaml, compare-with-gateway.yaml
├── tests/                5 dosya, modül başına bir tane
└── .github/workflows/ci.yml
```

## Ajan tasarımı

Ajan yok; ama İ5 açısından karşılığı olan bir şey var: **`Backend` tek
metotlu bir soyut arayüz** (`backends.py:39-48`) — `async run(params) -> dict`,
ya da fırlat. Docstring bunu "the pluggable seam of this whole project"
diye tanımlıyor (`backends.py:3`).

Bu, ADR-000 K3'ün istediği sözleşmenin küçük ama gerçek bir örneği: yetenek
beyanı yok, izin yok, model tercihi yok — ama **girdi/çıktı sözleşmesi ve
hata sözleşmesi net**. `BackendError` (`backends.py:32-37`) docstring'i
açıkça "bu tipi kullanmak zorunda değilsin, run() her şeyi fırlatabilir,
runner yakalar" diyor. Yani sözleşme dar tutulmuş ve bu bilinçli.

Kayda değer bir mimari karar: `Backend` arayüzü `ai-job-gateway`'in
`Provider` arayüzüyle aynı şekilde ve **kasten kopyalanmış**, import
edilmemiş — "these are independent repos in the same ecosystem, coupled
only through documented HTTP contracts, never through a shared Python
dependency" (`backends.py:6-9`). Depolar arası bağlanmayı HTTP sözleşmesiyle
sınırlama kararı; bizim çok-modüllü yapımız için doğrudan ilgili.

## Orkestrasyon / iş akışı modeli

Fan-out/fan-in, tek seviye, dinamik plan yok:
`run_comparison` tüm backend'leri `asyncio.gather` ile **aynı anda**
çalıştırıyor (`runner.py:116`) ve docstring nedenini yazıyor: sıralı
çalıştırmak "would make latency numbers meaningless for comparison"
(`runner.py:98-100`). Sonuçlar backend'lerin verildiği **sırayla** dönüyor,
bitiş sırasıyla değil (`runner.py:116` — `gather` sıra korur).

Not verme (grading) de aynı `gather` içinde, backend çağrısıyla iç içe
akıyor (`runner.py:66-83`), ayrı bir ikinci geçiş değil.

## Durum ve bellek

Durum yok. Süreç içi, tek atışlık; kalıcılık, checkpoint, geçmiş yok.
Tek çıktı: stdout'a tablo veya CSV (`cli.py:19`, `cli.py:39`). Bu, "aynı
karşılaştırmayı bir hafta sonra tekrarla ve farkı gör" senaryosunu
imkânsız kılıyor — aşağıda zayıf yön.

## Hata yönetimi

Deponun en düşünülmüş tarafı; kural tek ve her katmanda aynı:
**hiçbir tekil başarısızlık diğerlerinin sonucunu gizlemez.**

| Durum | Kod | Davranış |
|---|---|---|
| Backend takıldı | `runner.py:40 "asyncio.wait_for"` | harness'ın kendi tavanı; `error_type="TimeoutError"` satırı |
| Backend fırlattı | `runner.py:52-60` | `except Exception` → hata satırı, `error_type=type(exc).__name__` (`runner.py:59`) |
| Judge yapılandırılmamış | `grading.py:88-92` | `GradingUnavailable`, CLI baştan kontrol ediyor |
| Judge çalışırken düştü | `runner.py:70-83` | satır `score=0.0` ile işaretlenir, koşu devam eder |
| Judge bozuk JSON döndü | `grading.py:117-120` | `"judge returned unparseable output: ..."` — çöküş yok |

İki ayrıntı özellikle iyi:

- **`error_type` ayrı bir alan** (`runner.py:22-26`) — çağıran betikler hata
  *türüne* göre dallanabiliyor, hata *metnini* string-match etmeden. Küçük
  ama doğru bir sözleşme kararı.
- **Timeout harness tarafından zorlanıyor**, backend'in kendi timeout'una
  güvenilmiyor (`runner.py:33-39` yorumu): "a buggy or slow custom backend
  that never returns would otherwise hang the entire comparison forever,
  silently hiding every other backend's result behind it."

Eksik: retry yok, backend'ler arası fallback yok (kasten — burada amaç
kurtarmak değil ölçmek), kalıcı hata kaydı yok.

## Genişletilebilirlik

Yeni backend türü eklemek: `backends.py`'de bir sınıf + `config.py`'de
`_BUILDERS` sözlüğüne bir satır (`config.py:52-57`) + bir kurucu fonksiyon.
**İki dosya, çekirdek bozulmadan.** `runner.py` ve `cli.py` hiç değişmiyor.
Bu, protokolün "yeni ajan/araç eklemek kaç dosyaya dokunmak" sorusuna iyi
bir cevap.

Yeni **çıktı biçimi** eklemek de ucuz (`cli.py:19` CSV, `cli.py:39` tablo —
iki bağımsız saf fonksiyon). Yeni **not verme yöntemi** eklemek ise ucuz
değil: `grade_result` (`grading.py:82`) tek bir LLM-yargıç yolunu sabitliyor;
deterministik bir kontrol (regex, şema doğrulaması, birim testi) eklemek
için arayüz yok. İ4'ün en güçlü bulgusu tam bunun tersiydi — "yargı
deterministik kaynaktan gelir, LLM yalnızca eleştiri yazar" — bu depo o
dersi henüz almamış.

## Maliyet ve gecikme sayaçları

**Gecikme: var ve doğru ölçülmüş.** `time.monotonic()` (duvar saati değil)
ile ölçülüyor ve saat **not vermeden önce durduruluyor**
(`runner.py:65 "latency_seconds = time.monotonic() - start"`). Yorum nedenini
yazıyor: yargıç modelinin gidiş-dönüşü "must never leak into it"
(`runner.py:61-64`). Bu, karşılaştırma araçlarında sık yapılan bir ölçüm
hatasından bilinçle kaçınılması. CLI en hızlı başarılı backend'i ayrıca
raporluyor (`cli.py:74 "fastest successful backend"`).

**Maliyet: yok.** Token sayısı, USD, sağlayıcı fiyatı hiçbir yerde. Yargıç
çağrısının kendi maliyeti de ölçülmüyor — oysa `--rubric` ile her başarılı
satır bir ek LLM çağrısı demek. "Hangi backend daha ucuz" sorusu bu araçla
cevaplanamıyor; yalnızca "hangisi daha hızlı ve daha iyi".

**TTFT (ilk token süresi): yok.** Ölçülen tek şey uçtan uca süre. Streaming
senaryosunda bu yanıltıcıdır.

## Güçlü yönler (kanıtlı)

1. **Gecikme ölçümünün kirlenmemesi** (`runner.py:61-65`) — yukarıda.
   Ölçüm aracının kendi ölçtüğü şeye karışmaması, bu kategorideki en sık
   hata; burada açıkça engellenmiş.
2. **Ağır bağımlılığın opsiyonel tutulması** (`pyproject.toml:16-23`) —
   `litellm` yalnızca `--rubric` kullanılırsa gerekiyor; çekirdek
   `pyyaml`+`httpx`. Yorum gerekçeyi yazıyor: litellm "pulls in a large
   tree (openai/anthropic/tiktoken/...) that most comparisons ... never
   need". İçe aktarma da fonksiyon içinde, tembel (`grading.py:98-103`) ve
   `ImportError` kullanıcıya çalıştırılacak komutu söylüyor:
   `"run \`uv sync --extra grading\`"`.
3. **Saf mantığın ağdan ayrılması** (`gateway_poll.py`) —
   `parse_submission` (`:69`), `is_expired_poll_response` (`:82`),
   `classify_poll_body` (`:100`) hiçbiri ağ yapmıyor; HTTP durum kodu ve
   gövdeyi alıp sınıflandırıyor. Bu yüzden gateway sözleşmesinin uç
   durumları mock sunucu olmadan test edilebiliyor.
4. **`MockBackend`'in birinci sınıf olması** (`backends.py:51-79`) — sabit
   gecikme, sabit sonuç veya zorlanmış hata. Harness'ın kendi zamanlama ve
   raporlama mantığı gerçek model olmadan sınanabiliyor; `examples/`
   altında çalışan bir mock yapılandırması var (`compare-mocks.yaml`).
5. **Yargıç zincirinin de fallback'li olması** (`grading.py:45-56`,
   `grading.py:109`) — beş sağlayıcı, anahtarı olan atlanmadan sırayla.
   `nvidia-nim-mcp`'nin `EXTRA_PROVIDERS` düzeniyle bilinçli olarak aynı
   sıra ve yorum bunu söylüyor (`grading.py:22-26`): bir anahtarı olan
   kullanıcı iki projede de bedavaya çalışır durumda.

## Zayıf yönler (kanıtlı)

1. **Yargı yalnızca LLM'den geliyor.** `grade_result` (`grading.py:82`)
   tek yol: rubrik metnini bir modele gönder, JSON iste. Deterministik
   doğrulayıcı (şema, regex, birim testi, tam eşleşme) için genişleme
   noktası yok. İ4 özetinin ana bulgusuyla doğrudan çelişiyor.
2. **Yargıcın hatası "başarısız" olarak sayılıyor.** Bozuk JSON
   (`grading.py:117-120`) ve çalışma anı hatası (`runner.py:76-83`) her
   ikisi de `passed=False, score=0.0` üretiyor. Yani **"değerlendirilemedi"
   ile "kötü" aynı hücreye düşüyor**; `cli.py:81`'deki "highest-graded
   backend" sıralaması bu ikisini ayırt edemiyor. İ3'ün "kontrol edilmedi
   ≠ temiz" ilkesinin burada ihlali. `GradeResult` (`grading.py:34-37`)
   üçüncü bir durum (`unknown`) taşımıyor.
3. **Sonuç kalıcı değil.** Çıktı yalnızca stdout (`cli.py:19`, `:39`);
   koşu kaydı, zaman damgası, yapılandırma özeti saklanmıyor. Regresyon
   izleme ("dün 0.4s, bugün 1.9s") mümkün değil — bir benchmark aracı için
   bu ciddi bir eksik.
4. **Maliyet ölçümü yok** (yukarıda). İ5'in "cost optimization" alanına
   aday olarak alındı ama maliyet hakkında hiçbir şey söylemiyor.
5. **Tek atış, tekrar yok.** Her backend bir kez çağrılıyor
   (`runner.py:116`); n-tekrar, medyan, p95 yok. Tek örnekten çıkarılan
   "en hızlı backend" (`cli.py:74`) istatistiksel olarak zayıf bir iddia
   ve araç bunu okuyucuya söylemiyor.
6. **Rubrik prompt'u sabit** (`grading.py:57-63`) — çıktı biçimi
   dayatılıyor ama rubrik stratejisi (ör. karşılaştırmalı yargı,
   çift-kör) değiştirilemiyor.

## Puan (1–5)

| Ölçüt | Puan | Gerekçe |
|---|---|---|
| olgunluk | 3 | Temiz, test edilmiş (modül başına bir test dosyası), CI var; ama v0.1.0, tek kullanıcı, üretim kanıtı yok. |
| mimari netlik | 4 | Katman ayrımı gerçekten temiz; runner backend'i, backend çağıranı bilmiyor; saf mantık ağdan ayrılmış. |
| genişletilebilirlik | 4 | Yeni backend iki dosya; yeni çıktı biçimi bir fonksiyon. Eksi: yeni **not verme türü** için genişleme noktası yok. |
| güvenilirlik ilkelleri | 3 | Timeout ve izolasyon iyi (`runner.py:40`), tek hata koşuyu bozmuyor; ama retry/tekrar/kalıcılık yok — kasten dar. |
| gözlemlenebilirlik | 2 | Gecikme doğru ölçülüyor ve raporlanıyor, ama iz/olay/kalıcı kayıt/maliyet yok; çıktı uçucu. |
| güvenlik duruşu | 2 | Anahtarlar ortamdan okunuyor (`grading.py:71-72`), depoda gizli yok. Ama `HttpBackend` keyfi URL'e istek atıyor ve yapılandırma dosyası güvenilir kabul ediliyor; izin/sandbox kavramı yok. |

## ADR-000 K4 kanıtı

**K4'ü güçlendiriyor, iki farklı yönden.**

1. **Ölçüm sınırı olmadan model seçimi yapılamaz.** Bu deponun varlık
   sebebi bu: "hangi model/servis" sorusu ancak aynı girdiyi eşit koşulda
   birden çok arkaya verip ölçerek cevaplanıyor (`runner.py:98-100`).
   Model Router'ın seçim politikası (K4'te "maliyet/gecikme politikası"
   diye geçiyor) bir yerden **veri** almak zorunda; bu depo o verinin
   nasıl üretileceğinin küçük çalışan bir örneği. Bulgu: **Model Router
   ile Evaluator arasında bir veri sözleşmesi gerekiyor** — router'ın
   politikası, harness'ın ürettiği türden ölçümlerle beslenmeli.
   Sözleşmenin en az taşıması gerekenler burada zaten var:
   `(backend, status, latency_seconds, error_type, grade)`
   (`runner.py:16-26`).
2. **Sağlayıcı-bağımsız çağrı biçiminin bedeli düşük çıkıyor.** Yargıç
   zinciri beş sağlayıcıyı tek `litellm.acompletion` çağrısıyla topluyor
   (`grading.py:105-110`) ve tek sağlayıcıya özel muamele **yok** —
   `nvidia-nim-mcp`'deki `api_base` istisnası burada da tekrarlanıyor
   (`grading.py:47-49`), ama başka hiçbir sağlayıcı özel alan istemiyor
   (`grading.py:50-53`). İki bağımsız depoda aynı istisnanın çıkması,
   Model Router sözleşmesinin `api_base`/taşıma ayarı için bir alan
   ayırması gerektiğinin **ikinci bağımsız kanıtı** (bkz.
   `nvidia-nim-mcp.md` K4 bölümü).

**K4'ü çürüten kanıt bulunamadı.** Ortak sınırın kaybettirdiği bir
sağlayıcı özelliği bu depoda görülmedi — ama araç sağlayıcıların özel
yeteneklerini (streaming, araç çağırma, yapılandırılmış çıktı) hiç
kullanmadığı için bu, **zayıf bir olumsuzlama**: test edilmemiş alanda
kanıt yokluğu, yokluk kanıtı değil.

## Alınacak fikir

- **Ölçümün, ölçen aracın maliyetinden arındırılması** (`runner.py:61-65`)
  — yargıç çağrısı gecikmeye karışmıyor. Bizde: Evaluator'ın kendi
  çalışma süresi ve token'ı, değerlendirdiği ajanın metriklerine **asla**
  eklenmeyecek; iz modelinde bunlar ayrı span olacak (İ5'in gözlem
  mimarisi maddesine doğrudan girdi).
- **`error_type`'ın ayrı bir alan olması** (`runner.py:22-26`) — hata
  metnini string-match etmeden dallanabilmek. Bizde: `failure_modes`
  (ADR-000 K5) sözleşmesinde hata **türü** makine-okur bir enum olmalı,
  serbest metin `message` ondan ayrı.
- **Ağır bağımlılığın opsiyonel ekstra olması + tembel import**
  (`pyproject.toml:16-23`, `grading.py:98-103`) — ve `ImportError`
  mesajının çalıştırılacak komutu içermesi. Bizde: her isteğe bağlı
  yetenek (yargıç modeli, gömme, sandbox) böyle paketlenecek; çekirdek
  kurulumu hafif kalmalı.
- **Saf sınıflandırma mantığının ağdan ayrılması** (`gateway_poll.py`) —
  HTTP sonucu → anlam dönüşümü saf fonksiyon; ağ yalnızca çağıranda.
  Bizde: sağlayıcı yanıtının yorumlanması (oran sınırı mı, kalıcı hata mı,
  geçici mi) Model Router'da saf bir fonksiyon olacak ve mock sunucusuz
  test edilecek.
- **Mock backend'in birinci sınıf olması** (`backends.py:51-79`) — bizde
  her ajan/araç için deterministik bir sahte uygulama olmalı; orkestrasyon
  ve değerlendirme mantığı gerçek model çağrısı olmadan test edilebilsin.
- **Depolar arası bağlanmanın HTTP sözleşmesiyle sınırlanması**
  (`backends.py:6-9`) — paylaşılan Python bağımlılığı yerine belgelenmiş
  sözleşme, arayüzü kasten kopyalayarak. Bizim çok modüllü yapımızda
  modüller arası bağın nasıl kurulacağına dair kullanılabilir bir kural.

## Alınmayacak

- **"Değerlendirilemedi" ile "kötü"nün aynı hücreye düşmesi**
  (`grading.py:117-120`, `runner.py:76-83`) — `passed=False, score=0.0`
  ikisi için de. Bizde `GradeResult` üç durumlu olacak:
  `passed / failed / unknown`, ve `unknown` sıralamaya **girmeyecek**.
  İ3'ün "kontrol edilmedi ≠ temiz" ilkesinin doğrudan uygulaması.
- **Tek atıştan "en hızlı" sonucu çıkarmak** (`cli.py:74`) — n=1 ile
  sıralama yapmak. Bizde ölçüm en az n tekrar + medyan/p95 taşımalı, ya da
  tek atışsa çıktı bunu açıkça söylemeli.
- **Yalnızca LLM yargıcına dayanmak** (`grading.py:82`) — İ4'ün en güçlü
  yinelenen desenine aykırı. Bizde Evaluator'ın birincil yolu deterministik
  olacak (test, şema, kural); LLM yalnızca eleştiri metni yazacak.
- **Sonucun uçucu olması** (yalnızca stdout) — bizde her değerlendirme
  koşusu kalıcı bir kayıt bırakacak; İ5'in "iz → değerlendirme → öğrenme"
  akışı buna bağlı.
- **Rubrik prompt'unun sabitlenmesi** (`grading.py:57-63`) — değerlendirme
  stratejisi bir politika kararı; koda gömülmemeli.

## Dürüstlük

- **İncelenmeyenler:** `HttpBackend` gövdesini (`backends.py:153-184`)
  okumadım; onun hakkındaki tek ifadem (keyfi URL'e istek atması) sınıf
  adına ve `config.py:41`'deki kurucuya dayanıyor. `GatewayBackend`'in
  poll döngüsünü (`backends.py:100-152`) okumadım; gateway sözleşmesi
  hakkındaki bilgim `gateway_poll.py` imzalarından geliyor. `tests/`
  içeriğini okumadım — "modül başına bir test dosyası" ifadem dosya
  adlarına dayanır, test kalitesine dair bir iddia değil. `examples/`
  altındaki iki YAML'ı açmadım.
- **Doğrulanmayan sayılar:** yıldız, watcher, indirme — ağ sorgusu yok.
- **Kayırma kontrolü:** kullanıcının kendi deposu. Gözlemlenebilirliğe 2,
  güvenliğe 2 verdim; İ5'in "cost optimization" alanında **hiçbir şey
  yapmadığını** ve İ4'ün ana bulgusuyla **çeliştiğini** açıkça yazdım.
  Mimari netliğe 4 verdim çünkü katman ayrımı ölçülebilir biçimde temiz —
  bu, ölçüte göre hak edilmiş bir puan, sahibine göre değil.
