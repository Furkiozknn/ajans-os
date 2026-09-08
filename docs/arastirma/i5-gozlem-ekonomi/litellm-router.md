# LiteLLM Router

## Kimlik
- Repo: BerriAI/litellm (README.md başlığı ve GitHub linkleri: `README.md:1-19`, `github.com/BerriAI/litellm`)
- Yıldız: klondan doğrulanamadı (README rozeti dinamik `img.shields.io` görseli, statik değer içermiyor — `README.md:16-18`)
- Son commit (bu klon): `2026-09-07T17:16:47-07:00` (`git log -1 --format=%cI`)
- Lisans: MIT (`pyproject.toml`: `license = "MIT"`, `license-files = ["LICENSE"]`)
- Dil: Python
- Sürüm: `1.101.0` (`pyproject.toml`: `version = "1.101.0"`)
- Python sürümü: `>=3.10, <3.15` (`pyproject.toml`: `requires-python = ">=3.10, <3.15"`)
- Canlılık: geçti — commit tarihi çalıştırma anına (2026-09-08) göre 1 gün önce.

## Çözdüğü problem
Bir uygulamanın tek bir "model" adı altında birden çok fiziksel deployment'a (aynı modelin farklı API key/region/provider'daki kopyaları) istek dağıtmasını, başarısız/yavaş/pahalı olanları otomatik eleyip sağlıklı ve uygun olanı seçmesini sağlıyor. Router, `litellm.completion()` çağrısını sarmalayan ayrı bir sınıf (`litellm/router.py`, 13981 satır) — tek bir provider'a bağlanmıyor, bir "model_list" üzerinden çalışıyor.

## Mimari
Router tek dev bir sınıf (`Router` — `litellm/router.py`) + onun kullandığı, ayrık strateji modülleri (`litellm/router_strategy/`) ve yardımcı modüller (`litellm/router_utils/`). Seçim stratejisi bir `RoutingStrategy` enum'una göre `match/case` ile bir "selector" nesnesine dispatch ediliyor (`litellm/router.py:1247-1271`):
```
case RoutingStrategy.LEAST_BUSY.value: selector = LeastBusyLoggingHandler(...)
case RoutingStrategy.USAGE_BASED_ROUTING.value: selector = LowestTPMLoggingHandler(...)
case RoutingStrategy.USAGE_BASED_ROUTING_V2.value: selector = LowestTPMLoggingHandler_v2(...)
case RoutingStrategy.LATENCY_BASED.value: selector = LowestLatencyLoggingHandler(...)
case RoutingStrategy.COST_BASED.value: selector = LowestCostLoggingHandler(...)
```
Her selector aynı zamanda bir `CustomLogger` (litellm'in genel logging/callback arayüzü) — yani başarı/hata olaylarını dinleyip kendi metriğini güncelliyor, seçim anında da o metriği okuyor. `simple-shuffle` için hiç selector kurulmuyor (`None` — yorum: "Returns None for simple-shuffle (no selector needed)").

## Klasör yapısı
- `litellm/router.py` — ana `Router` sınıfı, tüm orkestrasyon (retry, fallback, deployment seçimi giriş noktası).
- `litellm/router_strategy/` — seçim politikaları: `simple_shuffle.py`, `lowest_latency.py`, `lowest_cost.py`, `lowest_tpm_rpm.py`/`lowest_tpm_rpm_v2.py`, `least_busy.py`, `tag_based_routing.py`, `budget_limiter.py`, `base_routing_strategy.py` (ortak Redis-batch altyapısı).
- `litellm/router_utils/` — kesinti/cooldown (`cooldown_cache.py`, `cooldown_handlers.py`, `cooldown_callbacks.py`), fallback (`fallback_event_handlers.py`), retry politikası (`get_retry_from_policy.py`), hata sınıflandırma (`handle_error.py`).
- Kök `model_prices_and_context_window.json` — model başına fiyat/limit tablosu.

## Ajan tasarımı
Uygulanamaz — bu bir çok-ajan (multi-agent) sistemi değil; Router tek bir karar bileşeni (deployment seçici), "ajan" kavramı yok.

## Orkestrasyon / iş akışı modeli
Akış: istek gelir → `healthy_deployments` listesi (cooldown'da olmayanlar) çıkarılır → tag/budget filtreleri uygulanır (`tag_based_routing.py`, `budget_limiter.py` — ikisi de "filter", seçici değil) → seçilen `RoutingStrategy`'nin `get_available_deployments`/`async_get_available_deployments` metodu çağrılır → seçilen deployment'a istek gönderilir → sonuç (başarı/hata) ilgili `CustomLogger.log_success_event`/`log_failure_event` ile aynı selector'a geri bildirilir, metrik güncellenir. Bu üretici-tüketici döngüsü tüm stratejilerde tekrarlanan bir kalıp.

## Durum ve bellek
Tüm canlı metrikler `DualCache` (bellek + opsiyonel Redis) üzerinde tutuluyor; `litellm/caching/` kapsam dışı bırakıldığı için `DualCache`'in iç uygulaması incelenmedi, ama kullanım şekli her stratejide tutarlı:
- **Gecikme (latency):** `RoutingArgs.ttl = 1*60*60` (1 saat) — `litellm/router_strategy/lowest_latency.py:24`. Anahtar `f"{model_group}_map"`, değer `{deployment_id: {"latency": [...], "HH:MM": {"tpm":.., "rpm":..}}}` — `litellm/router_strategy/lowest_latency.py:74,126,161-162`.
- **Maliyet (cost):** Anahtar `f"{model_group}_map"`, dakika bazlı `tpm`/`rpm` sayaçları — `litellm/router_strategy/lowest_cost.py:52,68-83`. `set_cache` çağrısında `ttl` verilmiyor (`litellm/router_strategy/lowest_cost.py:83`), yani DualCache'in varsayılan TTL'i geçerli.
- **TPM/RPM v2:** `RoutingArgs.ttl = 1*60` (1 dakika) — `litellm/router_strategy/lowest_tpm_rpm_v2.py:29`. Anahtar formatı `f"{id}:{deployment_name}:tpm:{HH-MM}"` — `litellm/router_strategy/lowest_tpm_rpm_v2.py:434-436` — dakikalık kayan pencere değil, dakika damgalı ayrı bucket'lar (her yeni dakika sıfırdan başlıyor). Okuma `async_batch_get_cache` (Redis `MGET`) ile toplu yapılıyor — `litellm/router_strategy/lowest_tpm_rpm_v2.py:438-440`.
- **Cooldown:** Anahtar `"deployment:{model_id}:cooldown"`, cache TTL = cooldown süresinin kendisi — `litellm/router_utils/cooldown_cache.py:105-106,94-98`.
- **Bütçe (budget_limiter):** `provider_spend:{provider}:{duration}`, `deployment_spend:{id}:{duration}`, `tag_spend:{tag}:{duration}` anahtarları, TTL = bütçe penceresinin saniye karşılığı — `litellm/router_strategy/budget_limiter.py:341-375`.
- **Çoklu-instance senkronizasyonu:** `base_routing_strategy.py` ve `budget_limiter.py` aynı deseni tekrarlıyor: artış önce bellek içi `InMemoryCache`'e anında yazılıyor, sonra bir kuyruğa (`redis_increment_operation_queue`) ekleniyor; periyodik bir arka plan görevi (`periodic_sync_in_memory_spend_with_redis`, varsayılan aralık `DEFAULT_REDIS_SYNC_INTERVAL`) bu kuyruğu tek bir Redis pipeline (`async_increment_pipeline`) ile toplu yazıyor — `litellm/router_strategy/base_routing_strategy.py:61-79,87-104`. Bu, her istekte Redis'e gitmeden çoklu-instance tutarlılığı sağlamak için bilinçli bir gecikmeli-tutarlılık tasarımı.

## Hata yönetimi
Gerçek bir circuit-breaker/cooldown mekanizması var (`litellm/router_utils/cooldown_handlers.py`, `cooldown_cache.py`):
- **Hangi hatalar cooldown tetikler** — `_is_cooldown_required` (`litellm/router_utils/cooldown_handlers.py:205-251`): `APIConnectionError` içeren hatalar asla cooldown'a girmiyor; 4xx için 429 ve 401 → cooldown; 408/404 → cooldown; diğer tüm 4xx (ör. 400 BadRequest) → cooldown **yok** (istemci hatası, deployment'ın suçu değil varsayılıyor); 4xx dışındaki (5xx, network vb.) her şey → cooldown; fonksiyonun kendisinde beklenmeyen istisna olursa **varsayılan olarak cooldown'a al** (fail-safe).
- **Eşik mantığı** — `_should_cooldown_deployment` (`litellm/router_utils/cooldown_handlers.py:317-404`): tek deployment'lı model grupları için 429'da bile cooldown uygulanmaz (tek seçenek varsa devre dışı bırakmanın anlamı yok). Çoklu deployment'ta: 429 → direkt cooldown; son 1 dakikada başarı+hata oranına bakarak `percent_fails > DEFAULT_FAILURE_THRESHOLD_PERCENT` (varsayılan `0.5`, `litellm/constants.py:68-69`, env `DEFAULT_FAILURE_THRESHOLD_PERCENT` ile değiştirilebilir) **ve** en az `DEFAULT_FAILURE_THRESHOLD_MINIMUM_REQUESTS` (varsayılan `5`, `litellm/constants.py:127-128`) istek varsa cooldown. Deployment/router seviyesinde `allowed_fails_policy` tanımlıysa bu genel mantığın yerine geçiyor.
- **Cooldown süresi** — varsayılan `DEFAULT_COOLDOWN_TIME_SECONDS = 5` saniye (env ile değiştirilebilir) — `litellm/constants.py:74`. Deployment bazında `cooldown_time` override edilebiliyor (`litellm/router_utils/cooldown_handlers.py:163-166`). Cache girişi bu sürenin sonunda TTL ile kendiliğinden düşüyor; `_corrected_active_cooldown` bellek-içi TTL'i Redis'teki gerçek kalan süreyle en geç 60 saniyede bir yeniden senkronize ediyor (`litellm/router_utils/cooldown_cache.py:33-36,112-124`).
- Hata mesajları cache'e yazılmadan önce maskeleniyor (`SensitiveDataMasker`, ilk 50 karakter görünür) — `litellm/router_utils/cooldown_cache.py:41-47`.

## Genişletilebilirlik
Seçim stratejilerinin kendisi (`simple_shuffle.py`, `lowest_latency.py`, `lowest_cost.py`, `lowest_tpm_rpm_v2.py`) **hiç** provider-adı kontrolü içermiyor — hepsi `litellm_params`, `model_info`, `id` gibi genel alanlar üzerinden çalışıyor; grep taramasında bu dosyalarda tek bir `if provider == "..."` dalı bulunamadı. Router'ın strateji dispatch'i de saf enum switch (`litellm/router.py:1247-1271`), provider'a göre dallanmıyor.

Ancak `router.py`'nin genelinde (strateji dosyaları dışında) sınırlı sayıda provider-özel dal var, örn:
- `if custom_llm_provider == "azure" and base_model is None:` — `litellm/router.py:10323`. Gerekçe kod içi yorumda açık: Azure deployment adları `model_prices_and_context_window.json`'daki fiyat anahtarlarıyla birebir eşleşmiyor, bu yüzden Router `azure/{model}` biçiminde bir fallback anahtarı deneyip fiyat/limit tablosunda "gerçekten çözülüyor mu" (`max_input_tokens`/`input_cost_per_token` > 0) diye kontrol ediyor (`litellm/router.py:10323-10334`).
- `if custom_llm_provider == LlmProviders.LITELLM_PROXY.value:` — `litellm/router.py:5916` (bir gerçek LLM sağlayıcısı değil, "litellm-proxy'yi provider gibi kullan" meta-durumu için).

Yeni bir sağlayıcı eklemek Router seviyesinde (bu iki istisna dışında) **tek dosyaya bile dokunmayı gerektirmiyor** — provider soyutlaması `litellm.get_llm_provider()` üzerinden geliyor (`litellm/router.py:10317-10320`, tanım kapsam dışı: `litellm/llms/` veya `litellm/utils.py`), Router bu fonksiyonun döndürdüğü `custom_llm_provider` string'ini büyük ölçüde şeffaf biçimde taşıyor (ör. `litellm/router.py:9392`: `custom_llm_provider=deployment.litellm_params.get("custom_llm_provider", None)` — hiç dallanma yok, doğrudan geçiriyor).

## Güçlü yönler (kanıtlı)
- Seçim politikaları gerçekten pluggable: 5 strateji + `simple-shuffle`, hepsi aynı `get_available_deployments`/`async_get_available_deployments` arayüzünü paylaşıyor (`litellm/router.py:1247-1271` dispatch tablosu).
- Çoklu-instance tutarlılığı için bilinçli tasarım: bellek-içi anlık okuma + Redis'e gecikmeli toplu (pipeline, sıkıştırılmış) yazma — `litellm/router_strategy/base_routing_strategy.py:61-146`.
- Cooldown mantığı hata tipine duyarlı (429/401 farklı, 4xx'in geri kalanı farklı, tek-deployment grupları farklı) — kaba "3 hatada kapat" değil, `litellm/router_utils/cooldown_handlers.py:205-404`.
- Bütçe sınırlama, seçim stratejisinden bağımsız bir *filtre* katmanı olarak tasarlanmış, herhangi bir stratejiyle birlikte kullanılabiliyor (`litellm/router_strategy/budget_limiter.py:5-8` docstring + `_filter_out_deployments_above_budget`).

## Zayıf yönler (kanıtlı)
- `lowest_cost.py`'de `set_cache` çağrısına `ttl` verilmiyor (`litellm/router_strategy/lowest_cost.py:83`) — diğer tüm stratejiler açıkça TTL veriyor; bu tutarsızlık, maliyet metriğinin ne zaman süreceğinin DualCache varsayılanına bağlı, kod okuyarak görünmüyor.
- `lowest_tpm_rpm_v2.py`'de eşit-en-düşük-tpm durumunda `random.choice(potential_deployments)` ile rastgele seçim yapılıyor (`litellm/router_strategy/lowest_tpm_rpm_v2.py:400-404`) — "lowest" stratejisi aslında "en düşükler arasından rastgele", isimden anlaşılmayan bir davranış.
- Provider soyutlaması genel olarak temiz olsa da, en az bir yerde (`litellm/router.py:10323`) fiyat-tablosu anahtar çözümlemesi için provider'a özel dal var; yani "%100 soyut" iddiası doğrulanamadı — kanıt aşağıda K4 bölümünde.
- `_is_cooldown_required` istisna durumunda "varsayılan olarak cooldown'a al" davranışı (`litellm/router_utils/cooldown_handlers.py:250-251`) — güvenli tarafta hata ama beklenmeyen bir bug bütün deployment'ları habersizce cooldown'a sokabilir; sessiz `except Exception: return True`.

## Puan (1–5)
- olgunluk: 5 — 1.101.0 sürüm, aktif commit geçmişi, kapsamlı edge-case yorumları (ör. `_corrected_active_cooldown`, `timedelta` normalizasyonu).
- mimari netlik: 4 — strateji dispatch net, ama tüm mantık 13981 satırlık tek `router.py` dosyasında toplanmış (strateji modülleri ayrık olsa da orkestrasyon merkezi dev bir dosya).
- genişletilebilirlik: 4 — yeni strateji eklemek için `BaseRoutingStrategy`/`CustomLogger` deseni takip edilebilir; yeni provider eklemek Router seviyesinde neredeyse dokunmasız (1-2 istisna hariç).
- güvenilirlik ilkelleri: 4 — TTL, cooldown, fail-safe varsayılanlar, batch-redis-sync gözlemlendi; ama en azından bir dosyada (lowest_cost) TTL tutarsızlığı var.
- gözlemlenebilirlik: 3 — Prometheus entegrasyonu import ediliyor (`_get_prometheus_logger_from_callbacks`, `litellm/router_strategy/budget_limiter.py:36-38`) ama bu araştırma `litellm/integrations/` kapsam dışı bırakıldığı için doğrulanmadı; debug log'lar (`verbose_router_logger.debug`) her stratejide var.
- güvenlik duruşu: 3 — hata mesajları cache'e yazılmadan maskeleniyor (`SensitiveDataMasker`, `litellm/router_utils/cooldown_cache.py:41-47`), ama bu tek gözlemlenen güvenlik önlemi; kimlik doğrulama/yetkilendirme kapsam dışı (`litellm/proxy/`).

## Alınacak fikir
- **Filtre + strateji ayrımı** (`tag_based_routing.py`, `budget_limiter.py` = filtre; `lowest_latency.py` vb. = seçici): ajans-os Router'ında da "hangi deployment'lar uygun" (bütçe, etiket, izin) ile "uygunlar arasından hangisi seçilir" (gecikme, maliyet) net ayrılırsa, yeni bir kısıt eklemek seçim algoritmasını bozmadan mümkün olur. Gerekçe: LiteLLM'de bu ayrım sayesinde `budget_limiter` herhangi bir stratejiyle birleşiyor (`litellm/router_strategy/budget_limiter.py:5-8`).
- **Bellek-içi anlık + gecikmeli toplu Redis senkronizasyonu** (`base_routing_strategy.py:61-146`): her istekte merkezi depoya gitmek yerine yerelde tut, periyodik pipeline ile birleştir. Gerekçe: P95 gecikmeyi merkezi depo turuna bağımlı kılmadan çoklu-instance tutarlılığı sağlıyor — ajans-os'ta birden çok worker/instance varsa doğrudan uygulanabilir bir desen.
- **Hata tipine duyarlı cooldown eşiği** (429/401 anında, diğer 4xx asla, 5xx oran bazlı): kaba "N hata sonra kapat" yerine, hatanın "deployment'ın suçu mu istemcinin mi" ayrımını yapan bir sınıflandırma. Gerekçe: `litellm/router_utils/cooldown_handlers.py:205-251` bunu küçük, test edilebilir bir saf fonksiyonda yapıyor.

## Alınmayacak
- **Tek dev `router.py` dosyasında (13981 satır) orkestrasyon + provider-özel istisnalar + config parsing hepsi bir arada**: ajans-os'ta bu ölçekte tek dosya sürdürülemez karmaşıklık üretir; strateji dosyaları gibi orkestrasyon da ayrık modüllere bölünmeli. Gerekçe: bu araştırmada `router.py` içinde `grep -n` ile arama yapmak zorunda kalındı çünkü dosya baştan sona okunacak boyutta değil — bu, bakımın da zor olduğunun dolaylı kanıtı.
- **`lowest_tpm_rpm_v2`'nin "lowest" adı altında rastgele tise-break yapması** (`litellm/router_strategy/lowest_tpm_rpm_v2.py:400-404`): isimle davranış arasındaki uyumsuzluk şaşırtıcı; ajans-os'ta strateji adları gerçek davranışı birebir yansıtmalı, "en düşük" gerçekten deterministik en düşüğü seçmeli ya da adı "en düşükler arasından rastgele" olmalı.
- **Fiyat tablosunun tek büyük düz JSON dosyası olarak paket içine gömülmesi** (3850 model girdisi, `model_prices_and_context_window.json`): bu araştırma dosyanın nasıl güncellendiğini doğrulayamadı (bkz. Dürüstlük) — güncelleme mekanizması belirsizken bu deseni kopyalamak, ajans-os'ta fiyatların bayatlamasını fark edilmez kılabilir.

## ADR-000 K4 için kanıt
K4: *"Sistem hiçbir LLM sağlayıcısına doğrudan bağlanmaz. Tek bir Model Router sınırı vardır."*

**Router'ı güçlendiren kanıt:** Seçim stratejilerinin dördü de (`simple_shuffle.py`, `lowest_latency.py`, `lowest_cost.py`, `lowest_tpm_rpm_v2.py`) hiçbir yerde provider adı kontrolü yapmıyor — bu dosyalarda `grep` ile `"azure"`, `"bedrock"`, `"vertex_ai"`, `custom_llm_provider ==` gibi desenler aranmadı çünkü zaten görülmedi; tüm mantık `litellm_params`, `model_info["id"]`, `tpm`/`rpm` gibi provider-bağımsız alanlar üzerinden yürüyor. Router'ın strateji dispatch'i de saf bir enum `match/case` (`litellm/router.py:1247-1271`), provider bilgisine hiç bakmıyor. Bu, "ortak seçim mantığı provider'dan tamamen soyut" iddiasını doğruluyor.

**Birikimli bulguyu (sağlayıcıya özel çeviri kodu kaçınılmaz) kısmen doğrulayan kanıt:** `router.py`'de, seçim stratejilerinin *dışında*, en az iki provider-özel dal bulundu:
1. `litellm/router.py:10323`: `if custom_llm_provider == "azure" and base_model is None:` — Azure deployment adları fiyat tablosundaki (`model_prices_and_context_window.json`) anahtarlarla birebir örtüşmediği için, Router bir `azure/{model}` fallback anahtarı deneyip tablonun bu anahtarı "gerçekten çözüp çözmediğini" (`max_input_tokens`/`input_cost_per_token` > 0) kontrol ediyor (`litellm/router.py:10323-10334`).
2. `litellm/router.py:5916`: `if custom_llm_provider == LlmProviders.LITELLM_PROXY.value:` — bir alt-özel-durum (litellm-proxy'yi bir provider gibi kullanma), gerçek bir LLM vendor'ı değil.

**Sonuç / yorum:** Bulgu kısmen doğru ama abartılı. LiteLLM'de sağlayıcıya özel kod **var**, ama Router'ın *seçim* sınırında değil — *isimlendirme/fiyat-çözümleme* sınırında, ve gözlemlenen tek gerçek vendor-özel dal (Azure) 13981 satırlık dosyada 1 blok. Asıl provider-özel çeviri kodu (auth header'ları, istek/yanıt formatı dönüşümü) muhtemelen `litellm/llms/` altında yaşıyor — bu araştırma kapsamı bunu kasıtlı olarak dışarıda bıraktı, dolayısıyla "sağlayıcıya özel çeviri kodu kaçınılmaz" iddiasının ağırlık merkezinin nerede olduğu (Router mu, `llms/` mu) bu belgeyle tam kanıtlanamaz — sadece Router sınırının kendisinin *büyük ölçüde* temiz olduğu, birkaç sınır-durumu istisnasıyla, gösterilebilir.

## Dürüstlük
- **Bakılmayanlar (kapsam dışı, kasıtlı):** `litellm/llms/` (gerçek provider çeviri kodu — K4 sorusunun en kritik kısmı burada olabilirdi ama görev tanımı bunu dışarıda bıraktı), `litellm/proxy/`, `litellm/integrations/` (Prometheus/Langfuse gibi gözlemlenebilirlik entegrasyonları — `budget_limiter.py`'de import edildiği görüldü ama doğrulanmadı), `litellm/caching/` (`DualCache`, `RedisCache`, `InMemoryCache`'in gerçek uygulaması — bellek/Redis birleştirme mantığı sadece dışarıdan davranışıyla çıkarsandı, kodu okunmadı), `tests/`, `ui/`, `docs/`, `enterprise/`, `cookbook/`.
- **Cevapsız kalan soru:** `model_prices_and_context_window.json` dosyasının **nasıl ve ne zaman güncellendiği** (elle mi, bir CI script'iyle mi, harici bir kaynaktan mı çekiliyor) — bu doğrulanamadı çünkü `litellm.model_cost`'un nereden/nasıl doldurulduğu (`litellm/__init__.py` veya benzeri bir yükleyici) kapsam dışı bırakıldı. Sadece şu kesin: router_strategy dosyaları bu JSON'u **doğrudan okumuyor**, hepsi `litellm.model_cost` adlı önceden yüklenmiş bir Python sözlüğünden okuyor (`litellm/router_strategy/lowest_cost.py` içinde `litellm.model_cost.get(...)` çağrıları).
- **Emin olunmayan yerler:** `DEFAULT_COOLDOWN_TIME_SECONDS = 5`'in (`litellm/constants.py:74`) Router başlatılırken gerçekten `CooldownCache(default_cooldown_time=...)`'e bu şekilde geçtiği `router.py` içinde satır satır izlenmedi (sadece sabitin tanımı ve `cooldown_handlers.py`'ye import edildiği doğrulandı) — dolayısıyla "varsayılan cooldown 5 saniyedir" iddiası, bu sabitin başka bir yerde override edilmediği varsayımına dayanıyor. Ayrıca yıldız sayısı ve gerçek "kaç sağlayıcı destekleniyor" rakamı (README "100+ LLM" diyor ama bu doğrulanmadı, README'ye "güvenme" talimatı gereği sadece kimlik teyidi için kullanıldı) teyit edilmedi.
