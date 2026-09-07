# E2B

## Kimlik
e2b-dev/E2B · 13.697 yıldız · 84 watcher · son push 2026-09-07 · Apache-2.0 · Python/TypeScript (monorepo, pnpm workspace) · haftalık indirme: doğrulanmadı
Klon HEAD: `e261223` (2026-09-07).
canlılık: geçti — arşivlenmemiş, son push güncel.
İnceleme kapsamı: `packages/python-sdk/e2b/` (sandbox_sync, sandbox_async, connection_config.py, api/), `packages/js-sdk/src/`, `spec/` (openapi.yml, envd/*.proto), `templates/base/`, kök `AGENTS.md`, `TASTE.md`, `README.md`. Kapsam dışı: `packages/cli`, `packages/desktop-*`, `packages/code-interpreter-*`, `scripts/`, `skills/`.

**Kritik kapsam notu (dürüstlük):** Bu depo E2B'nin **istemci SDK'ları + API/envd spesifikasyonu + şablonlardan** oluşuyor; asıl sandbox çalışma zamanı (Firecracker/microVM orkestrasyonu, ağ yığını, host tarafı izolasyon) burada **yok**. `spec/README.md:6-8` bunu açıkça yazıyor: `openapi.yml` ve `envd/*` dosyaları `e2b-dev/infra` deposundan Copybara ile senkronize ediliyor, elle düzenlenmiyor; `openapi-volumecontent.yml` ise "private belt repository"den geliyor. Depo genelinde `firecracker`/`microvm`/`kvm`/`hypervisor` geçen tek bir kod veya doküman dosyası yok (`grep -rli` sıfır eşleşme, README dahil — `README.md:20` yalnızca "secure isolated sandboxes" diyor, mekanizmayı adlandırmıyor). Yani **izolasyon sınırının ne olduğu bu depoda kanıtlanamıyor**; aşağıdaki bulgular yalnızca istemci tarafının gördüğü sözleşmeyi (API yüzeyi) yansıtıyor, sunucu tarafı uygulamayı değil. "incelenmedi" işareti bu bölümün geneline uygulanır: gerçek izolasyon mekanizması.

## Çözdüğü problem
Bir ajanın/uygulamanın "LLM'in ürettiği kodu nerede çalıştırayım" sorusuna cevap: kısa ömürlü, programatik olarak başlatılıp durdurulan bulut sandbox'ları için SDK + API sözleşmesi. Hedef kitle: kod yorumlayıcı (code interpreter) özelliği eklemek isteyen ajan geliştiricisi. Çözdüğü acı: kendi konteyner/VM orkestrasyonunu yazmak yerine `Sandbox.create()` → `sandbox.commands.run()` → `sandbox.kill()` gibi üç adımlı bir yüzeyle çalıştırma ortamı elde etmek.

## Mimari
İstemci tarafında üç katman: (1) **Sandbox API istemcisi** — kontrol düzlemi (`e2b.dev` API) ile konuşup sandbox yaşam döngüsünü yönetir (`create`, `kill`, `pause`, `resume`, `set_timeout`); (2) **envd istemcisi** — her sandbox içinde çalışan bir ajan sürecine (envd) gRPC/HTTP ile bağlanıp dosya sistemi ve süreç işlemlerini yürütür; (3) **Template/Dockerfile** — sandbox'ın taban imajını tanımlar (`templates/base/e2b.Dockerfile`), CLI ile build edilip sunucu tarafında (infra repo) bir çalıştırılabilir imaja dönüştürülür (bu dönüşüm bu depoda yok).

```
Sandbox.create()  --HTTPS+X-API-KEY-->  E2B API (kontrol düzlemi, infra repo)
       │                                        │
       │                                  sandbox_id + envd URL döner
       ▼
sandbox.commands.run() --gRPC/HTTP--> envd (sandbox içi, spec/envd/*.proto)
       │                                        │
       │                              stdout/stderr callback ile akar
       ▼
sandbox.kill() --HTTPS DELETE--> E2B API (SandboxApi._cls_kill, sandbox_api.py:134)
```

Sözleşme, `spec/openapi.yml` (kontrol düzlemi API'si) ve `spec/envd/{filesystem,process}/*.proto` (sandbox içi RPC) ile makine-okur biçimde tanımlı; SDK'lar bu spesifikasyondan kod üretimiyle (`make codegen`) türetiliyor.

## Klasör yapısı
```
packages/
├── python-sdk/e2b/
│   ├── connection_config.py   API key, header, timeout, proxy — bağlantı ayarları
│   ├── api/                   openapi'den üretilmiş HTTP istemcisi + auth (X-API-KEY)
│   ├── envd/                  proto'dan üretilmiş sandbox-içi RPC istemcisi
│   ├── sandbox_sync/          Sandbox sınıfı: create/kill/set_timeout/commands/filesystem
│   ├── sandbox_async/         aynı yüzeyin async ikizi
│   └── template*/             Dockerfile tabanlı imaj tanımı + build istemcisi
├── js-sdk/src/                Python SDK'nın TS karşılığı, aynı sandbox/envd ayrımı
└── cli/                       şablon build/push komutları (incelenmedi, kapsam dışı)
spec/
├── openapi.yml                 kontrol düzlemi API sözleşmesi (infra repo'dan senkron)
└── envd/{filesystem,process}/  sandbox-içi RPC sözleşmesi (proto, infra repo'dan senkron)
templates/base/e2b.Dockerfile   varsayılan taban imaj tanımı
```

## Ajan tasarımı
E2B bir ajan çerçevesi değil; "ajan" kavramı yok. Sandbox, çağıran tarafından (ajan veya uygulama kodu) programatik olarak oluşturulan bir kaynak. Yetenek/izin sözleşmesi ajan düzeyinde değil, **sandbox düzeyinde** ifade ediliyor: `SandboxNetworkOpts` (`sandbox/sandbox_api.py:289`, `allow_internet_access: bool` alanı `sandbox/sandbox_api.py:420`) ve `SandboxLifecycle` (`sandbox/sandbox_api.py:530`, timeout sonrası `pause`/`kill` davranışı). Kim çağırırsa çağırsın aynı API key ile aynı yetkiye sahip; ajan kimliği ile insan kimliği ayrımı bu depoda yok.

## Orkestrasyon / iş akışı modeli
Orkestrasyon yok — E2B bir orkestratör değil, orkestratörün (ajan çerçevesinin) çağırdığı bir araç. Paralellik çağıranın sorumluluğunda: her `Sandbox.create()` ayrı bir kaynak, birden fazla sandbox eşzamanlı açılabilir ama aralarında bir koordinasyon katmanı yok.

## Durum ve bellek
Sandbox durumu sunucu tarafında (infra repo) yaşıyor; istemci yalnızca `sandbox_id` tutuyor. Kalıcılık iki mekanizmayla: `pause`/`resume` (`SandboxOnTimeout` `pause` aksiyonu, bellek durumunu (`keep_memory`) korur, `sandbox/sandbox_api.py:490-494`) ve snapshot (`SnapshotInfo`, `SnapshotPaginator`). Checkpoint kavramı sandbox'ın kendisi için var (durdur/devam et), ama ajan görev durumu için değil — bu E2B'nin sorumluluğu dışında.

## Hata yönetimi
- Zaman aşımı davranışı açıkça modellenmiş: `on_timeout` `"kill"` (varsayılan, `sandbox_api.py:842`) veya `"pause"` (`sandbox_api.py:830-876`); `auto_resume` yalnızca `pause` ile birlikte kullanılabiliyor, aksi hâlde `ValueError` (`sandbox_api.py:861-863`).
- `kill()` "sandbox bulunamazsa" `False`, başarılıysa `True` döner (`sandbox_sync/main.py:499-540`) — hata değil, boole sonuç; çağıran ayrımı kendisi yapmalı.
- Debug modda `kill()` gerçekte hiçbir şey yapmadan `True` döner (`sandbox_sync/main.py:533-535`) — geliştirme kolaylığı ama üretimde yanlışlıkla `debug=True` kalırsa sandbox'lar hiç ölmez.
- API key yoksa erken ve açık hata: `AuthenticationException` (`api/__init__.py:258-263`).
- Retry/backoff istemci tarafında görülmedi (yalnızca `REQUEST_TIMEOUT: float = 60.0`, `connection_config.py:22`); sunucu tarafı retry infra repo'da olabilir, doğrulanamadı.
- İnsan onayı kapısı: **yok**. `kill()`, `set_timeout()`, `commands.run()` hiçbiri onay adımından geçmiyor.

## Genişletilebilirlik
Yeni bir taban imaj eklemek: bir Dockerfile + CLI build komutu, çekirdek bozulmadan. Yeni bir dil/runtime desteği eklemek SDK'da envd'nin desteklediği RPC'lere bağlı — `spec/envd/process/process.proto` sözleşmesini genişletmek infra repo'da olduğu için buradan tek başına yapılamaz (K3/K8 açısından önemli: bu depo kendi başına eksiksiz bir "ajan aracı" değil, bir istemci).

## Güçlü yönler (kanıtlı)
- **Sync/async SDK aynı OpenAPI/proto'dan kod üretimiyle türetiliyor** — iki elle yazılmış kopya değil (`AGENTS.md`: "Never edit the API, envd, or volume-content specs in spec/ by hand"). mem0'daki sync/async ikizlenme sorununun burada mimari olarak önlendiği bir karşı örnek.
- **Ağ erişimi açık bir alan olarak modellenmiş**: `allow_internet_access: bool` (`sandbox_api.py:420`) — sandbox oluştururken/güncellerken ayarlanabiliyor; varsayılan değer bu depoda görünmüyor (sunucu tarafında), ama istemci sözleşmesinde bu alanın var olması ağ erişiminin bir açık/kapalı anahtar olduğunu gösteriyor.
- **Timeout sonrası davranış (kill/pause) açıkça tipli** (`SandboxOnTimeout`, `SandboxLifecycle`, `sandbox_api.py:485-564`) — "sandbox sonsuza kadar açık kalır" sınıfı hatayı sözleşme düzeyinde engelliyor.
- **API key erken doğrulanıyor, sessizce geçilmiyor** (`AuthenticationException`, `api/__init__.py:258-263`).

## Zayıf yönler (kanıtlı)
- **İzolasyon mekanizması bu depoda doğrulanamıyor.** Firecracker/microVM iddiası (E2B'nin dışarıdaki pazarlamasında var) bu kod tabanında hiçbir yerde geçmiyor; gerçek uygulama kapalı/ayrı bir repo'da. Protokolün "README'ye güvenme" kuralı burada daha da katı uygulanmalı: README bile iddiayı adlandırmıyor.
- **Debug modda kill() no-op** (`sandbox_sync/main.py:533-535`) — sessiz bir davranış değişikliği, üretim/geliştirme karışırsa kaynak sızıntısına yol açar.
- **İstemci tarafında görünür bir kaynak kotası (CPU/RAM/disk) alanı yok** — `sandbox_api.py`'de arandı, `SandboxOpts`/`SandboxNetworkOpts` dışında kota alanı bulunamadı; kota API tarafında (infra repo) yönetiliyor olabilir, doğrulanamadı.
- **Çok-kiracılılık sınırı istemci sözleşmesinde görünmüyor** — `X-API-KEY` (`api/__init__.py:266`) tek başlık; organizasyon/takım kavramı bu SDK yüzeyinde yok (CLI'de olabilir, kapsam dışı bırakıldı).

## Puan (1-5)
- olgunluk: 4 — 13.7k yıldız, aktif günlük geliştirme, kod-üretimli SDK/spec zinciri; ama çekirdek izolasyon kodu bu depoda değil, olgunluk iddiası doğrulanamıyor.
- mimari netlik: 4 — API/envd ayrımı ve spec-first kod üretimi net; sync/async ikizlenmesi kaynağında (proto/openapi) çözülmüş.
- genişletilebilirlik: 3 — yeni taban imaj kolay, yeni RPC yeteneği (envd tarafı) bu depodan bağımsız bir repo'ya bağlı.
- güvenilirlik ilkelleri: 3 — timeout/kill/pause modeli net; retry/fallback istemci tarafında görünmüyor, sunucu tarafı doğrulanamadı.
- gözlemlenebilirlik: 2 — `request_source == "ci"` için "diagnostics" bayrağı var (`api/__init__.py:270`) ama trace/log şeması bu depoda görünmüyor.
- güvenlik duruşu: 2 — API key modeli açık ve erken doğrulanıyor, ama izolasyon sınırı, kaynak kotası ve çok-kiracılılık kanıtı bu depoda **yok**; hepsi kapalı bir repo'ya güvenmeyi gerektiriyor.

## Alınacak fikir
- **Spec-first, kod-üretimli SDK ayrımı** (`spec/openapi.yml` + `spec/envd/*.proto` → `make codegen`) — bizim Model Router (K4) ve Permission Manager (K6) sınırlarını da önce şema, sonra kod sırasıyla tanımlamak; sync/async veya çoklu-dil SDK'ların birbirinden kopmasını kaynağında önler.
- **Timeout sonrası davranışın tipli enum olması** (`SandboxOnTimeout`, `sandbox_api.py:485-564`) — bizim araç çağrılarında da "süre dolunca ne olur" (öldür/duraklat/insan kapısına düşür) sözleşmede açık bir alan olmalı, örtük varsayılan olmamalı.
- **Ağ erişiminin açık bir bool/alan olarak sözleşmede durması** (`allow_internet_access`, `sandbox_api.py:420`) — K6'nın "ağ erişimi sözleşmede açıkça istenir" ilkesiyle birebir örtüşüyor; bizim `agent.schema.json`'da `permissions.network` için benzer açık alan modellenebilir.

## Alınmayacak
- **Kapalı sunucu tarafı, açık istemci sözleşmesi modeli** — E2B'de gerçek izolasyon uygulaması ayrı ve kapalı bir repo'da; bizim sistemimizde Permission Manager'ın uyguladığı sınırlar (K6) doğrulanabilir olmalı, "bize güvenin" bir mimari karar değil.
- **Debug modda kill() no-op davranışı** (`sandbox_sync/main.py:533-535`) — bir bayrağın (debug) yaşam döngüsü güvenliğini (kaynağın gerçekten öldürülmesi) sessizce değiştirmesi; bizde ortam bayrakları asla geri-alınamaz/kaynak-serbest-bırakan işlemlerin anlamını değiştirmemeli.
- **Tek düz `X-API-KEY` başlığı** (`api/__init__.py:266`) — organizasyon/rol/kapsam ayrımı olmadan tek anahtar tüm yetkiyi taşıyor; bizim Permission Manager'da ajan kimliği ile insan kimliği ayrı taşınmalı (K6: "ajanlar birbirinin izinlerini devralmaz").

## ADR-000 K6 kanıtı
**Nötr — bu depo K6'yı ne güçlendiriyor ne çürütüyor, çünkü Permission Manager'a karşılık gelen bileşen (izin uygulaması, ağ/dosya sınırlaması) bu depoda değil, ayrı bir kapalı repo'da.** İstemci sözleşmesi K6'nın "izinler sözleşmede açıkça istenir" ilkesini destekler biçimde tasarlanmış (`allow_internet_access: bool`, `sandbox_api.py:420`; `SandboxOnTimeout`, `sandbox_api.py:530-564`) — bu **kısmen güçlendiren** bir sinyal. Ama "varsayılan salt-okuma" ve "geri alınamaz işlemde insan kapısı" ilkelerinin uygulandığına dair hiçbir kanıt yok (`kill()`, `sandbox_sync/main.py:526-540`, onaysız ve anında çalışıyor) — bu da **çürüten** yönde zayıf bir sinyal, çünkü E2B'nin sandbox silme/kill işlemi K6'nın "geri alınamaz işlem → insan kapısı" ilkesine tabi değil. Net değerlendirme: **nötr**, çünkü izolasyon uygulamasının kendisi doğrulanamadığından ne güçlü ne zayıf bir iddia kanıtlanabiliyor; yalnızca sözleşme yüzeyi K6 ile uyumlu tasarlanmış.

Matris: saglayici_bagimsiz=evet · sozlesme_var=kismen · insan_kapisi=hayir · checkpoint=kismen
- saglayici_bagimsiz: E2B tek bir LLM sağlayıcısına bağlı değil (LLM-agnostik bir çalıştırma katmanı); ama kendi bulut altyapısına (E2B'nin kendi kontrol düzlemi/infra repo) bağlı — sağlayıcı bağımsızlığı "model" için evet, "çalıştırma altyapısı" için tartışmalı, bu ayrım repo dosyasında yapıldı.
- sozlesme_var: openapi.yml + proto şemaları makine-okur ve kod üretimine kaynak (`spec/README.md:6-11`), ama "ajan" kavramı yok — sözleşme sandbox kaynağı için var, ajan için yok; bu yüzden "kısmen".
- insan_kapisi: `kill()`/`set_timeout()` hiçbir onay adımından geçmiyor (`sandbox_sync/main.py:526-598`).
- checkpoint: sandbox `pause`/`resume` ile durumdan devam edebiliyor (`sandbox_api.py:490-564`), ama bu ajan görev durumu değil sandbox belleği; "kısmen" bu ayrım yüzünden.
