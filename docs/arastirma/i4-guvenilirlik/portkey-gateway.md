# Portkey AI Gateway

## Kimlik

- Repo: `github.com/Portkey-AI/gateway` (yerel klon: `D:/Repolar/_inceleme/portkey-gateway`, salt okunur incelendi).
- Paket adı/sürüm: `@portkey-ai/gateway` v1.15.2 (`package.json:2-3`).
- Lisans: MIT, "Copyright (c) 2024 Portkey, Inc" (`LICENSE:1-3`).
- Dil: TypeScript (Hono tabanlı, Cloudflare Workers/Node ikili hedefli — `package.json` script'lerinde `wrangler dev` ve `tsx src/start-server.ts` birlikte görülüyor).
- Son commit tarihi (yerel klonun `git log -1` çıktısı): `Mon May 25 19:24:51 2026 +0530`. Bugün 2026-09-08 olduğuna göre son push ~105 gün önce → **tarihî referans** olarak işaretlenir: repo README'de "Gateway 2.0 (Pre-Release)" duyurusu var, yani aktif geliştirme 2.0 dalına kaymış olabilir, bu klon 1.x hattının donmuş bir görüntüsü olabilir (doğrulanmadı — sadece README'deki üstteki uyarıdan çıkarım, `README.md:6-7`).
- Yıldız sayısı: bu ortamda doğrulanamadı (yerel klon, GitHub API/web erişimi kapsam dışı bırakıldı).

## Çözdüğü problem

Tek bir OpenAI-uyumlu API yüzeyi arkasında 250+ LLM sağlayıcısına yönlendirme yapan bir ters proxy / AI gateway. Amaç: sağlayıcı hatalarında otomatik retry/fallback, yük dengeleme, koşullu yönlendirme, önbellekleme ve guardrail uygulamak (`README.md:38-45`, `README.md:191-198`).

## Mimari

Hono (web framework) üzerine kurulu tek süreçli bir HTTP handler zinciri. İstek `src/handlers/*Handler.ts` dosyalarından birine düşer (ör. `chatCompletionsHandler.ts`), oradan ortak yönlendirme mantığını taşıyan `src/handlers/handlerUtils.ts` içindeki `tryTargetsRecursively` fonksiyonuna gider. Bu fonksiyon config'teki `strategy.mode` alanına göre (fallback / loadbalance / conditional / single hedef) kendini **özyinelemeli** çağırır, en sonunda yaprak düğümde gerçek sağlayıcı isteğini `tryPost` üzerinden yapar. Sağlayıcıya özel adaptörler `src/providers/` altında (kapsam dışı bırakıldı, incelenmedi).

## Klasör yapısı

İncelenen kısım:
- `src/handlers/` — HTTP giriş noktaları + `handlerUtils.ts` (yönlendirme/fallback/loadbalance/conditional çekirdeği) + `retryHandler.ts` (deneme/backoff) + `streamHandler.ts` (stream + timeout).
- `src/middlewares/` — `requestValidator` (Zod şemalarıyla config doğrulama), `hooks` (guardrail hook'ları — reliability değil), `cache`, `log`, `adminAuth`.
- `src/errors/` — `GatewayError.ts`, `RouterError.ts`.
- `src/types/requestBody.ts` — `RetrySettings`, `Strategy`, `StrategyModes` tip tanımları.
- `src/providers/`, `tests/`, `docs/`, `cookbook/`, `plugins/`, `public/` kapsam dışı bırakıldı, incelenmedi.

## Ajan tasarımı

Yok. Bu bir "agent framework" değil; README'de "Agents" bölümü var ama bu, LangChain/CrewAI/Autogen gibi dış ajan çerçeveleriyle **entegrasyon** anlamına geliyor (`README.md:272-291`), gateway'in kendi içinde ajan/görev/adım kavramı yok. `src/handlers` ve `src/middlewares` içinde ajan soyutlaması bulunamadı.

## Orkestrasyon / iş akışı modeli

Tek bir isteğin yaşam döngüsü içinde çalışan, config ağacını (`targets` dizisi) özyinelemeli gezen bir yönlendirme motoru. "İş akışı" kavramı yok; her HTTP isteği bağımsız ve kendi içinde `tryTargetsRecursively` ile baştan sona çözülüyor (`src/handlers/handlerUtils.ts:476` civarı, fonksiyon imzası `handlerUtils.ts:475-476`).

## Durum ve bellek

Tamamen **stateless** — istekler arası kalıcı durum tutan bir depo (DB, Redis, KV) bu incelenen dosyalarda bulunamadı. `isHandlingCircuitBreaker` ve `cbConfig` gibi alanlar devre kesici *durumunu okumak* için var (`src/handlers/handlerUtils.ts:646-659`, `:792-799`) ama bu durumu nerede/nasıl tuttuğunu gösteren bir "state store" kodu **bu OSS reposunda yok** (ayrıntı aşağıda "Hata yönetimi" bölümünde). Checkpoint/rollback kavramı yok — retry ve fallback, network isteğini olduğu gibi tekrar göndererek çalışıyor, ara durumu kaydedip geri alma diye bir mekanizma bulunamadı.

## Hata yönetimi

### 1. Fallback zinciri

Config'te `strategy.mode: "fallback"` ile ifade ediliyor (`src/types/requestBody.ts:22-26` — `StrategyModes` enum'ında `FALLBACK`, `LOADBALANCE`, `CONDITIONAL` değerleri var). Yürütme `src/handlers/handlerUtils.ts:663-693`:

```
case StrategyModes.FALLBACK:
  for (const [index, target] of currentTarget.targets.entries()) {
    ...
    response = await tryTargetsRecursively(c, target, ...);
    const codes = currentTarget.strategy?.onStatusCodes;
    const gatewayException = response?.headers.get('x-portkey-gateway-exception') === 'true';
    if (
      (Array.isArray(codes) && !codes.includes(response?.status)) ||
      (!codes && response?.ok) ||
      gatewayException
    ) { break; }   // fallback zincirini durdur
  }
```

Yani: `strategy.onStatusCodes` verilmişse ve dönen durum kodu o listede **değilse** döngü durur (başarı sayılır); verilmemişse `response.ok` true olduğunda durur; ya da bir "gateway exception" başlığı varsa durur. Aksi halde bir sonraki `targets[i+1]`'e geçilir. `onStatusCodes` alanı `src/types/requestBody.ts:31` içinde `Strategy` tipinde opsiyonel tanımlı.

### 2. Retry

Config alanı `retry: { attempts, onStatusCodes, useRetryAfterHeader }` (`src/types/requestBody.ts:9-14`). Varsayılan: `attempts` verilmezse `0` (retry kapalı) — `src/handlers/services/requestContext.ts:150`. Varsayılan durum kodları verilmezse `RETRY_STATUS_CODES = [429, 500, 502, 503, 504]` (`src/globals.ts:38`, kullanıldığı yer `requestContext.ts:151-152`). Deneme sayısına üst sınır (ör. "max 5") **şemada zorlanmıyor** — `attempts: z.number()` sınırsız (`src/middlewares/requestValidator/schema/... :69,73-74`, dosya adı grep ile bulundu, tam dosya adı incelenmedi). README'nin "up to 5 times" iddiası (`README.md:194`) koddaki bir sabit değil, örnek/varsayılan pazarlama metni gibi görünüyor — **doğrulanmadı**.

Gerçek retry döngüsü `async-retry` kütüphanesiyle yapılıyor: `src/handlers/retryHandler.ts:1` (`import retry from 'async-retry'`), çağrı `retryHandler.ts:172-179`:

```
{
  retries: retryCount,
  onRetry: (error, attempt) => { lastAttempt = attempt; },
  randomize: false,
}
```

`randomize: false` açıkça verildiği için **jitter YOK** (async-retry'nin varsayılanı `randomize: true` olurdu, burada bilinçli kapatılmış). `factor`/`minTimeout` override edilmemiş → `async-retry` kütüphane varsayılanları geçerli (factor=2, minTimeout=1000ms), yani **üstel backoff** var ama sabit adım büyümesiyle (jitter'sız). Bu kütüphane varsayılan davranışına dayanıyor, kodda açıkça `factor:`/`minTimeout:` satırı **yok** — doğrudan kanıt yok, `async-retry` dokümantasyonuna güveniliyor (doğrulanmadı, dosyada literal olarak yazmıyor).

429 için sağlayıcının `Retry-After`/`x-ratelimit-reset` gibi başlıklarını okuyup bekleme süresini oradan alma özelliği de var: `useRetryAfterHeader` / `followProviderRetry` → `retryHandler.ts:105-150` civarı, toplam bekleme `MAX_RETRY_LIMIT_MS = 60_000` ms ile sınırlanıyor (`src/globals.ts:5`, kullanım `retryHandler.ts:84,131`).

Retry tetikleyen durum kodu kontrolü: `retry?.onStatusCodes?.includes(...)` — `src/handlers/handlerUtils.ts:1261`.

### 3. Devre kesici (circuit breaker) — GERÇEKTEN VAR MI?

**Kısmen var, ama bu OSS repoda çalışan bir uygulaması yok.** `grep -rni "circuit"` sonucu sadece `src/handlers/handlerUtils.ts` içinde 4 satır çıktı:

- `handlerUtils.ts:646`: `const isHandlingCircuitBreaker = currentInheritedConfig.id;`
- `handlerUtils.ts:647-659`: eğer `id` varsa, `currentTarget.targets` içinden `!t.isOpen` olanları filtreleyip sadece "sağlıklı" hedeflere yönlendiriyor.
- `handlerUtils.ts:792-799`: her başarılı/başarısız `tryPost` sonrası `c.get('handleCircuitBreakerResponse')?.(response, currentInheritedConfig.id, currentTarget.cbConfig, currentJsonPath, c)` çağrılıyor.

Kritik nokta: `handleCircuitBreakerResponse` bir Hono context değişkeni olarak **okunuyor** (`c.get(...)`) ama bu isimde bir fonksiyonun **tanımlandığı veya `c.set('handleCircuitBreakerResponse', ...)` ile kaydedildiği tek bir satır bile bulunamadı** — repo genelinde (`grep -rn "handleCircuitBreakerResponse|CircuitBreaker"`) sadece yukarıdaki iki çağrı/okuma satırı var, tanım yok. Aynı şekilde `isOpen` ve `cbConfig` alanları da sadece **okunuyor**, hiçbir yerde (bu repo içinde) set edilmiyor (`grep -rn "isOpen|cbConfig"` → yalnızca `handlerUtils.ts:653` ve `:796`, başka hiçbir dosyada yok).

Sonuç: durum makinesi (kapalı/açık/yarı-açık) bu açık kaynak kod tabanında **yok**. Kod, dışarıdan (muhtemelen Portkey'in barındırılan/kurumsal ürününde) enjekte edilecek bir hook için **iskelet/kanca** bırakmış ama gerçek mantık kapalı kaynak tarafta duruyor gibi görünüyor (doğrulanmadı — sadece kod boşluğundan çıkarım). Ayrıca README'de "circuit breaker" ifadesi **hiç geçmiyor** (`grep -n "circuit breaker" README.md` boş) — yani bu özellik README'de pazarlanmıyor bile; sadece kodda yarım kalmış bir kanca olarak duruyor. Bu, İ4 açısından önemli bir bulgu: iddia edilen (ya da ima edilen) bir güvenilirlik ilkesi, incelenen kod tabanında **çalışan bir karşılığı olmadan** sadece isim/alan düzeyinde mevcut.

### 4. Koşullu yönlendirme (conditional routing)

`strategy.mode: "conditional"` (`StrategyModes.CONDITIONAL`, `src/types/requestBody.ts:26`). Yürütme `src/handlers/handlerUtils.ts:723-753`: istek başlığındaki `x-portkey-metadata` (`HEADER_KEYS.METADATA`) JSON'u parse edilip `metadata` olarak, istek gövdesi `params` olarak, `c.req.path` ise `url.pathname` olarak `ConditionalRouter` sınıfına veriliyor (`new ConditionalRouter(currentTarget, { metadata, params, url: { pathname: c.req.path } })`, ardından `conditionalRouter.resolveTarget()`). `ConditionalRouter` sınıfının kendisi `src/services/conditionalRouter.ts` dosyasında tanımlı (`class ConditionalRouter` bulundu) — bu dosya görev kapsamının dışında (`src/services/` izin verilen klasör listesinde yok), bu yüzden kural dilinin ayrıntısı (operatörler, AND/OR, karşılaştırma tipleri) **incelenmedi**. Yalnızca girdi yüzeyi doğrulanabildi: metadata + istek gövdesi + URL path.

### 5. Durum modeli (tekrar, netlik için)

Retry ve fallback **checkpoint olmadan** yapılıyor: her deneme, orijinal `request`/`requestHeaders` nesnesini yeniden kullanarak sıfırdan bir HTTP isteği gönderiyor (`tryPost` her `tryTargetsRecursively` çağrısında baştan çalışıyor). Ara sonuç saklanmıyor, "rollback" kavramı yok — hata durumunda tek yapılan, bir sonraki hedefe veya bir sonraki denemeye aynı isteği tekrar göndermek.

### 6. Zaman aşımı

`requestTimeout` config alanı (`ProviderOptions.requestTimeout`, kullanım `src/handlers/handlerUtils.ts:503,553-557`) veya `x-portkey-request-timeout` başlığı (`HEADER_KEYS.REQUEST_TIMEOUT`, `src/handlers/services/requestContext.ts:135-141`) ile ayarlanıyor. Uygulama `retryHandler.ts:9-46`'daki `fetchWithTimeout` fonksiyonunda: bir `AbortController` kuruluyor, `setTimeout(() => controller.abort(), timeout)` ile süre doluyor, `AbortError` yakalanınca 408 durum kodlu sentetik bir `Response` üretiliyor (`retryHandler.ts:27-45`, mesaj: `"Request exceeded the timeout sent in the request: ${timeout}ms"`). Stream tarafında da aynı 408 kodu kullanılıyor: `REQUEST_TIMEOUT_STATUS_CODE = 408` (`src/globals.ts:40`), referans `src/handlers/streamHandler.ts:247-252`.

## Genişletilebilirlik

Sağlayıcı eklemek `src/providers/` altında yeni adaptör dosyası eklemek şeklinde (bu klasör kapsam dışı bırakıldığı için iç yapısı incelenmedi). Config tarafında `strategy.mode` alanı yeni bir mod eklenerek genişletilebilir gibi duruyor (switch/case yapısı, `handlerUtils.ts:662`) ama bu, kod değişikliği gerektiren bir genişletme — çalışma zamanı plugin sistemi (guardrail hook'ları hariç, `src/middlewares/hooks/`) reliability tarafında görülmedi.

## Güçlü yönler (kanıtlı)

- Fallback zincirinin durma koşulu net ve test edilebilir bir mantıkla kodlanmış: `onStatusCodes` / `response.ok` / `x-portkey-gateway-exception` üçlü kontrolü tek yerde (`handlerUtils.ts:676-692`).
- Retry, 429 için sağlayıcının `Retry-After` başlığına saygı gösterip toplam bekleme süresini `MAX_RETRY_LIMIT_MS` ile sınırlıyor — kör bir sabit backoff değil, sağlayıcı sinyaline duyarlı (`retryHandler.ts:105-150`).
- Timeout, gerçek bir `AbortController` ile uygulanıyor (kozmetik değil) ve 408'e sentetik `Response` dönüşü tutarlı bir hata sözleşmesi sağlıyor (`retryHandler.ts:27-45`).
- Retry varsayılanı kapalı (`attempts` verilmezse 0) — sürpriz/istenmeyen otomatik retry riski yok (`requestContext.ts:150`).

## Zayıf yönler (kanıtlı)

- Devre kesici (circuit breaker) alanları (`isOpen`, `cbConfig`, `handleCircuitBreakerResponse`) kodda okunuyor ama bu repoda hiçbir yerde set/tanımlanmıyor — OSS'te çalışmayan, yarım bırakılmış bir kanca (`handlerUtils.ts:646-659,792-799`; tanım yok).
- Retry deneme sayısına (`attempts`) şema düzeyinde üst sınır yok — kullanıcı yanlışlıkla çok yüksek bir değer girerse `MAX_RETRY_LIMIT_MS` sadece 429/`retry-after` yolunda toplam süreyi sınırlıyor, diğer hata kodlarında (500/502/503) attempt sayısı kadar bekleme birikebilir (backoff üstel olduğundan hızlı büyür, ama sert bir tavan kodda görülmedi).
- Backoff parametreleri (`factor`, `minTimeout`) kodda literal olarak yazılı değil, kütüphane varsayılanına (`async-retry`) sessizce güveniliyor — okuyan biri için gizli bağımlılık (doğrulanmadı ama iz bu yönde).
- Jitter kasıtlı olarak kapatılmış (`randomize: false`) — çok sayıda eşzamanlı istemci aynı anda retry ederse "thundering herd" riski azaltılmamış.

## Puan (1-5)

- Olgunluk: 4 — 1.15.2 sürümü, üretimde kullanıldığı iddia ediliyor (README "10B tokens/gün"), ama 2.0'a geçiş belirsizliği var.
- Mimari netlik: 4 — `tryTargetsRecursively` tek fonksiyonda tüm stratejileri okunabilir switch/case ile birleştiriyor.
- Genişletilebilirlik: 3 — yeni strateji/sağlayıcı eklemek kod değişikliği gerektiriyor, çalışma zamanı plugin arayüzü reliability tarafında yok.
- Güvenilirlik ilkelleri: 3 — fallback/retry/timeout sağlam, ama circuit breaker sadece iskelet; checkpoint/rollback hiç yok (tasarım gereği, stateless proxy için beklenir ama İ4 açısından not edilmeli).
- Gözlemlenebilirlik: 3 — `console.error` ile hata logu var (`handlerUtils.ts:805-810`), yapılandırılmış/merkezi bir metrik-event sistemi bu incelenen dosyalarda görülmedi.
- Güvenlik duruşu: incelenmedi — kapsam dışı (`adminAuth`, guardrail detayları görev kapsamına dahil edilmedi).

## Alınacak fikir

Fallback durma koşulunun üçlü mantığı (`onStatusCodes` listesi VEYA `response.ok` VEYA açık `gateway-exception` başlığı) net, tek yerde toplanmış ve okunabilir bir "ne zaman dur" sözleşmesi — kendi retry/fallback tasarımımızda bu üç sinyali ayrı ayrı isimlendirip tek fonksiyonda birleştirmek iyi bir örnek.

## Alınmayacak

Yarım bırakılmış devre kesici deseni: alan adlarını (`isOpen`, `cbConfig`) ve okuma noktalarını koda gömüp gerçek durum makinesini tanımsız bırakmak. Bu, kod okuyan birine "circuit breaker var" izlenimi verirken aslında OSS'te çalışmıyor — kendi projemizde bir özelliği ya tam uygulayacağız ya da hiç iskeletini bırakmayacağız (yarım kanca, yanlış güven verir).

---

## Matris cevapları

- `saglayici_bagimsiz`: **evet** — projenin varlık nedeni çok-sağlayıcılı
  yönlendirme; `src/providers/` altında sağlayıcı adaptörleri (bu incelemede
  kapsam dışı bırakıldı, yalnızca varlığı doğrulandı).
- `sozlesme_var`: **kısmen** — config sözleşmesi tipli
  (`src/types/requestBody.ts:22-26`, `StrategyModes` enum'ı) ve makine-okur, ama
  ajan/yetenek/izin sözleşmesi kavramı yok (proje bir ajan çatısı değil, proxy).
- `insan_kapisi`: **hayır** — incelenen hata/yönlendirme yollarında onay adımı
  bulunamadı.
- `checkpoint`: **hayır** — tamamen stateless; retry ve fallback isteği sıfırdan
  gönderiyor, ara durum kaydı yok (bkz. "Durum ve bellek").
