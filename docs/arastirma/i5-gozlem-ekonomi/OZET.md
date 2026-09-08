# İ5 Gözlem ve ekonomi — iz özeti

## 1. İncelenen projeler

| Proje | Kategori | Yıldız | Son push | Lisans | Canlılık | Olgunluk | Mimari netlik | Genişletilebilirlik | Güvenilirlik ilkelleri | Gözlemlenebilirlik | Güvenlik duruşu | Kanıt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| langfuse/langfuse | tracing platformu + maliyet hesabı | 34.319 | 2026-09-07 | MIT (ee/ hariç) | geçti (son commit 2026-09-07, prisma migration geçmişi 2026-09'a kadar aktif) | 4 | 4 | 3 | 4 | 4 | — | [langfuse](langfuse.md) |
| open-telemetry/semantic-conventions-genai | tracing standardı (birincil kaynak, taşınmış) | 643 | 2026-09-03 (~5 gün önce) | Apache-2.0 | geçti (yeni depo `semantic-conventions-genai`, son commit 2026-09-03; eski depo `semantic-conventions`'daki GenAI içeriği bu depoya taşınıp orada deprecated/tarihî referans bırakıldı) | 2 | 4 | 4 | 3 | 4 | 4 | [otel-genai-semconv](otel-genai-semconv.md) |
| Furkiozknn/nvidia-nim-mcp | model failover (kullanıcının deposu) | 0 | 2026-09-05 | MIT | geçti (son push 3 gün önce, arşivlenmemiş, OSI lisanslı) | 3 | 2 | 3 | 4 | 1 | 3 | [nvidia-nim-mcp](nvidia-nim-mcp.md) |
| Furkiozknn/model-comparison-harness | benchmark/değerlendirme (kullanıcının deposu) | 0 | 2026-09-06 | MIT | geçti (son push 2 gün önce, arşivlenmemiş, OSI lisanslı) | 3 | 4 | 4 | 3 | 2 | 2 | [model-comparison-harness](model-comparison-harness.md) |
| BerriAI/litellm | model router (çalışma zamanı telemetrisi) | 58.252 | 2026-09-07 | MIT | geçti (son commit çalıştırma anına göre 1 gün önce) | 5 | 4 | 4 | 4 | 3 | 3 | [litellm-router](litellm-router.md) |
| lm-sys/RouteLLM | model router (istek zorluğu tahmini) | 5.462 | 2024-08-10 (~760 gün önce) | Apache-2.0 | tarihî referans (son push 2024-08-10, ~760 gün önce, 90 günlük eşiğin çok üzerinde) | 2 | 4 | 3 | 2 | 1 | 2 | [routellm](routellm.md) |

*Yıldız değerleri 8 Eylül 2026'da denetim sırasında `gh api repos/<repo>` ile ölçüldü (semantic-conventions için ana depo `open-telemetry/semantic-conventions`); araştırma turu ağ sorgusu yapmamıştı.*

Puanlar analiz dosyalarının "Puan" bölümlerinden birebir alındı. `langfuse.md` güvenlik duruşu satırında dosya kendisi "doğrulanmadı — kapsam dışı" yazıyor, sayı üretmedim; `otel-genai-semconv.md` puanları donmuş sürüme (eski depo) ait — tazeleme bölümü ayrı bir puan tablosu vermiyor, sadece üç soruyu yeniden cevaplıyor (aşağıda §2-§5'e işlendi). Yıldız hiçbir kaynakta doğrulanamadı (tüm analizler ağ erişimi olmadan yerel klonlar üzerinden yapıldı) — uydurmak yerine tamamı `—` bırakıldı. Proje adı "open-telemetry/semantic-conventions-genai" olarak seçildi çünkü GenAI içeriği v1.42.0'da bu depoya taşındı ve eski depodaki karşılığı artık "deprecated"; canlılık/son push aktif olan (taşınan) depoya ait (otel-genai-semconv.md:5-7,118-119).

### Sağlayıcı bağımsızlığı / sözleşme / insan kapısı / checkpoint

| Proje | saglayici_bagimsiz | sozlesme_var | insan_kapisi | checkpoint |
|---|---|---|---|---|
| langfuse/langfuse | kısmen | evet | hayır | — |
| open-telemetry/semantic-conventions-genai | kısmen | evet | — | — |
| Furkiozknn/nvidia-nim-mcp | kısmen | hayır | hayır | — |
| Furkiozknn/model-comparison-harness | kısmen | evet | — | hayır |
| BerriAI/litellm | kısmen | kısmen | — | kısmen |
| lm-sys/RouteLLM | hayır | evet | — | kısmen |

- langfuse/langfuse — saglayici_bagimsiz kısmen: `usageDetails`/`costDetails` sözlüğü açık uçlu ama `OtelIngestionProcessor.ts:2846-2881` OpenAI ve Vercel AI SDK için ayrı if/else dalı taşıyor (langfuse.md:117-118, bkz. §2 Desen A).
- langfuse/langfuse — sozlesme_var evet: `packages/shared/src/domain/` altında Trace/Observation/Score için zod şemaları var, tip üretiyor (langfuse.md:40). Bu bir ajan sözleşmesi değil, gözlemlenebilirlik veri modeli şeması — sınırı bu şekilde genişlettim.
- langfuse/langfuse — insan_kapisi hayır: dosyada geçen "insan/otomatik skor" ayrımı (langfuse.md:9,131) riskli bir işlemi onaylayan bir kapı değil, trace'leri geriye dönük değerlendiren bir puanlama/etiketleme akışı; bu yüzden "onay mekanizması" tanımına uymuyor.
- open-telemetry/semantic-conventions-genai — saglayici_bagimsiz kısmen: çekirdek `gen_ai.*` isim uzayı sağlayıcıdan bağımsız ama `openai.md`, `aws-bedrock.md`, `anthropic.md` gibi sağlayıcıya özel dosyalar ve zorunlu `aws.bedrock.guardrail.id` gibi alanlar duruyor (otel-genai-semconv.md:88).
- open-telemetry/semantic-conventions-genai — sozlesme_var evet ama kırılgan: registry/span YAML'ları makine-okur şema tanımlıyor (otel-genai-semconv.md:29) fakat dosyanın kendisi "GenAI semconv'a sözleşme olarak bağlanılamaz" diyor çünkü 197 `stability:` alanının 197'si de `development` (otel-genai-semconv.md:154-160) — şema var ama kararlı değil, doğrudan koda gömülmemeli.
- Furkiozknn/nvidia-nim-mcp — saglayici_bagimsiz kısmen: fallback zinciri `litellm` üzerinden çok sağlayıcılı ama NVIDIA modelleri özel `api_base` sarmalaması istiyor, ayrıca ikinci bir `VISION_PROVIDERS` listesi zorunlu (nvidia-nim-mcp.md, bkz. §2 Desen A, `nvidia_image.py:118-121,168-172`).
- Furkiozknn/nvidia-nim-mcp — sozlesme_var hayır: model listeleri (`TRANSLATE_MODELS`, `LLM_MODELS`, `VISION_MODELS` vb.) modül-seviyesi sabit liste, şema yok, dışarıdan okunamıyor, sürümlenmiyor — dosyanın kendi ifadesiyle "makine-okur sözleşmenin en ilkel hâli" (nvidia-nim-mcp.md:86-89).
- Furkiozknn/nvidia-nim-mcp — insan_kapisi hayır: fallback sırası "2026-08-22'de doğrulanan" tek seferlik bir insan gözlemi olarak koda gömülmüş, çalışma zamanında bir onay adımı değil (nvidia-nim-mcp.md:105-108).
- Furkiozknn/model-comparison-harness — saglayici_bagimsiz kısmen: aynı `api_base` istisnası bu depoda da tekrarlanıyor (`grading.py:47-49`, bkz. §2 Desen A).
- Furkiozknn/model-comparison-harness — sozlesme_var evet: `BackendError` (`backends.py:32-37`) ve `gateway_poll.py` submit/poll sözleşmesi girdi/çıktı ve hata sözleşmesini net tutuyor (model-comparison-harness.md:76-80).
- Furkiozknn/model-comparison-harness — checkpoint hayır: dosya açıkça "Durum yok. Süreç içi, tek atışlık; kalıcılık, checkpoint, geçmiş yok" diyor (model-comparison-harness.md:103).
- BerriAI/litellm — saglayici_bagimsiz kısmen: seçim stratejilerinin dördü tamamen provider-agnostik ama `router.py:10323` Azure fiyat-anahtarı çözümlemesi için özel dal taşıyor (bkz. §2 Desen A).
- BerriAI/litellm — sozlesme_var kısmen: `RoutingStrategy` enum'una göre dispatch ve filtre/strateji ayrımı (`budget_limiter.py` herhangi bir stratejiyle birleşiyor) yapısal bir sözleşme izlenimi veriyor (litellm-router.md:17-20,68,85) ama `model_list` girdisinin şema/tip doğrulamasına dair bu analizde doğrudan kanıt yok — bu yüzden "evet" değil "kısmen".
- BerriAI/litellm — checkpoint kısmen: cooldown ve bütçe durumu `DualCache` (bellek + opsiyonel Redis) üzerinde TTL'li tutuluyor; Redis kalıcıysa süreç yeniden başlasa da durum korunabilir, ama bu ajan-çalıştırma checkpoint'i değil, sağlık/bütçe durumu önbelleği (litellm-router.md:39-45,52).
- lm-sys/RouteLLM — saglayici_bagimsiz hayır: `OPENAI_CLIENT = OpenAI()` modül seviyesinde sabit, karar katmanı tek sağlayıcıya kodda sabitlenmiş — ADR-000 K4 ile doğrudan çelişen örnek (routellm.md:78).
- lm-sys/RouteLLM — sozlesme_var evet: beş farklı router yaklaşımı tek bir `calculate_strong_win_rate(prompt) -> float` sözleşmesine indirgenmiş (routellm.md:55,73).
- lm-sys/RouteLLM — checkpoint kısmen: öğrenilmiş router'lar (`mf`/`bert`/`causal_llm`) için Hugging Face üzerinde hazır model-ağırlığı checkpoint'leri var (routellm.md:37) — bu model checkpoint'i, çalışma-zamanı durumdan-devam etme değil, bu yüzden "kısmen" işaretlendi.

## 2. Yinelenen desenler

**Desen A — ortak sınır şemada kuruluyor, ama sağlayıcıya özel uzantı katmanı asla tamamen boşalmıyor; sadece hangi kavramın uzantıda mı çekirdekte mi olduğu zamanla değişiyor.**
Beş kaynak bağımsız kanıt taşıyor:
- `langfuse.md:117-118` — `usageDetails`/`costDetails` açık uçlu sözlük, ama `OtelIngestionProcessor.ts:2846-2881` OpenAI ve Vercel AI SDK için ayrı if/else blokları.
- `otel-genai-semconv.md` (tazeleme) — cache token'ları donmuş sürümde Anthropic'e özeldi, yeni depoda çekirdek registry'ye terfi etti (`registry.yaml:301,308,374`), **ama** `model/openai/registry.yaml` (39 satır) ve `model/aws-bedrock/registry.yaml` (17 satır) hâlâ duruyor.
- `nvidia_image.py:118-121` (`nvidia-nim-mcp.md` "Zayıf yönler" #1) — NVIDIA modelleri `api_base` sarmalaması istiyor, diğer sağlayıcılar istemiyor; ayrıca `VISION_PROVIDERS` (`nvidia_image.py:168-172`) ikinci bir liste zorunlu kılınmış.
- `model-comparison-harness.md` — aynı `api_base` istisnası bağımsız bir ikinci depoda tekrarlanıyor (`grading.py:47-49`).
- `litellm-router.md` — seçim stratejilerinin dördü (`simple_shuffle.py`, `lowest_latency.py`, `lowest_cost.py`, `lowest_tpm_rpm_v2.py`) tamamen provider-agnostik, ama `router.py:10323` Azure fiyat-anahtarı çözümlemesi için özel dal taşıyor; 13981 satırlık dosyada bu türden istisna sadece 1-2 blok.

Sonuç, DURUM.md'nin önceki turdaki formülasyonunu düzeltiyor (otel tazeleme bölümünün kendi ifadesiyle): *"sağlayıcıya özel alan kalıcı değil, geçici — kavram çekirdeğe terfi eder ama uzantı katmanı hiç boşalmaz, çünkü her sağlayıcı yeni bir kavram getirir."* litellm-router bunu Router'ın **seçim** sınırında büyük ölçüde doğruladı (istisna sayısı düşük), ama asıl provider-çeviri kodunun (`litellm/llms/`) bu araştırmanın kapsamı dışında bırakıldığı unutulmamalı (litellm-router.md Dürüstlük).

**Desen B — maliyet (USD) hiçbir standardın parçası değil; her araç kendi fiyat tablosunu icat ediyor ve güncelleme mekanizması hiçbirinde net değil.**
- `otel-genai-semconv.md` (tazeleme) — yeni depoda `cost|price|usd|dollar` araması yine sıfır sonuç; "kalıcı bir tasarım tercihi" olarak yeniden doğrulandı.
- `model-comparison-harness.md` ve `nvidia-nim-mcp.md` — ikisi de maliyeti hiç ölçmüyor; `nvidia_image.py:148` `response.usage` okunmadan atılıyor.
- `routellm.md` — README'nin "%85 maliyet azaltma" iddiası (`README.md:14`) kod içinde doğrulanamadı, `evals/` kapsam dışı bırakıldı.
- İki proje **kendi** fiyat tablosunu kurmuş: Langfuse Postgres'te `Model`/`Price`/`PricingTier` (`schema.prisma:784-839`), LiteLLM kök `model_prices_and_context_window.json` + `litellm.model_cost` sözlüğü. **İkisinde de** bu tablonun nasıl/ne zaman güncellendiği doğrulanamadı (langfuse.md Dürüstlük; litellm-router.md "Cevapsız kalan soru"). Aynı boşluk, bağımsız iki depoda.

**Desen C (bu turda ortaya çıktı) — hata türü ayrımı, kaba "N hatada kapat" yerine, makine-okur bir sınıflandırmaya dayanıyor.**
- `model-comparison-harness.md` — `error_type` ayrı alan (`runner.py:22-26`), çağıran string-match etmeden dallanabiliyor.
- `litellm-router.md` — `_is_cooldown_required` (`cooldown_handlers.py:205-251`) 429/401'i anında cooldown'a alıyor, diğer 4xx'i almıyor, 5xx'i oran bazlı değerlendiriyor — "deployment'ın suçu mu istemcinin mi" ayrımı saf bir fonksiyonda.
İki proje, birbirinden habersiz, aynı ilkeye ulaşmış: hata *türü* ile hata *metni* ayrı tutulmalı.

## 3. Ayrışan yaklaşımlar

**Eksen: yönlendirme kararı hangi sinyale dayanır?**

| Yaklaşım | Sinyal | Kaynak | Ne zaman doğru |
|---|---|---|---|
| Çalışma zamanı telemetrisi | gecikme, TPM/RPM, maliyet, bütçe — hepsi geçmiş çağrılardan biriken metrik | LiteLLM (`lowest_latency.py`, `lowest_cost.py`, `lowest_tpm_rpm_v2.py`, `budget_limiter.py`) | Deployment havuzu **aynı model**in birden çok kopyası/bölgesi olduğunda; karar "hangi kopya" sorusuna cevap veriyor, "hangi model" sorusuna değil. |
| İstek içeriğinin tahmini zorluğu | prompt'un kendisi, eğitilmiş sınıflandırıcı/regresyon modeli | RouteLLM (`calculate_strong_win_rate`, `routers.py:32-45`) | Karar **farklı yetenek/kalite seviyesindeki iki model** arasında, tek seferlik ve istek-bazlı; geçmiş telemetriye ihtiyaç yok ama eğitim verisi/checkpoint gerekiyor. |
| Sabit sıralı fallback zinciri | insan tarafından bir kere gözlemlenmiş sıra, canlı sinyal yok | nvidia-nim-mcp (`nvidia_image.py:97-99` "2026-08-22'de doğrulanan sıra"), model-comparison-harness (ölçüm aracı, kendisi yönlendirme yapmıyor, veri üretiyor) | Havuzdaki tüm modeller **birbirinin ikamesi** kabul edildiğinde ve amaç "hiç ölme"; maliyet/kalite farkı önemsizse veya hiç ölçülmüyorsa. |

Kanıtlanmış ek ayrışma: **sağlık sinyali üretmek yetmiyor, karara bağlanması gerekiyor.** nvidia-nim-mcp `check_provider_health` (`:669`) sonucu zincir sırasını **etkilemiyor** — bilgi üretiliyor, kullanılmıyor (`nvidia-nim-mcp.md` "Zayıf yönler" #4). LiteLLM'de tam tersi: cooldown mekanizması sağlık sinyalini doğrudan sağlıklı dağıtım filtresine besliyor (`router_utils/cooldown_handlers.py:520` `_get_cooldown_deployments`, `router.py:146-150`'de içe aktarılıp seçimden önce uygulanıyor; önceki adres `cooldown_cache.py:105-106` yalnızca önbellek anahtarını üretiyordu — denetimde düzeltildi). Aynı problem, iki depoda taban tabana zıt çözülmüş — biri gözlem üretip atıyor, diğeri gözlemi kararın girdisi yapıyor.

RouteLLM'in kendi içinde de bir ayrışma var: `mf`/`sw_ranking` router'ları OpenAI gömme API'sine sabit bağımlı (`similarity_weighted/utils.py:11`), `causal_llm`/`bert` router'ları prompt'u doğrudan sınıflandırıyor, harici gömme bağımlılığı yok. K4 açısından ikincisi daha temiz.

## 4. Anti-pattern'ler

1. **Model/fiyat kataloğunun güncelleme mekanizması opak veya donmuş, üç bağımsız projede.** `routellm.md` — kapalı `MODEL_IDS` sözlüğü (`model.py:6-71`, 64 giriş), listede olmayan model `KeyError` ile çöküyor (`routers.py:235-236`). `nvidia-nim-mcp.md` — `LLM_MODELS` koda gömülü, yapılandırma dosyasından değiştirilemiyor (`nvidia_image.py:81-85` ve "Genişletilebilirlik" bölümü). `litellm-router.md` — `model_prices_and_context_window.json`'ın nasıl/ne zaman güncellendiği doğrulanamadı (Dürüstlük, "Cevapsız kalan soru"). Üçü de aynı sonuca çıkıyor: model/fiyat kataloğu ya statik ya da güncelleme yolu belgesiz.
2. **Kullanılabilir ekonomi verisi toplanıp atılıyor.** `nvidia_image.py:148` (`nvidia-nim-mcp.md:185-187`) — `litellm.acompletion` yanıtı `usage` alanı taşıyor ama kod yalnızca `content`/`model` okuyor, token sayısı bedavaya elde iken atılıyor. `model-comparison-harness.md` — yargıç çağrısının kendi maliyeti hiç ölçülmüyor, oysa `--rubric` her satırda ek bir LLM çağrısı demek. İki proje bağımsız olarak "ölçülebilecek ekonomi sinyalini ölçmeme" hatasına düşmüş.
3. **Sağlayıcı bağımsızlığı iddiası karar katmanında sessizce kırılıyor — en ağır biçimi RouteLLM'de.** `routellm.md` K4 bölümü: `OPENAI_CLIENT = OpenAI()` modül seviyesinde sabit (`similarity_weighted/utils.py:11`); "hiçbir sağlayıcıya doğrudan bağlanmama" iddiası çağrı katmanında (`litellm.completion`) doğru ama **karar** katmanında yanlış. Bu, Desen A'daki yumuşak biçimlerden (taşıma ayarı istisnası, `azure`/`api_base`) niteliksel olarak farklı: burada bağımlılık *seçilebilir bir taşıma ayarı* değil, *koddan sökülemeyen sabit bir istemci*.

## 5. Bizim için öneri

1. **ADR-000 K4: altı kaynağın tamamı destekliyor, hiçbiri çürütmüyor — ama sınırın nereye çizileceği netleşti.** Sınır "seçim" (hangi deployment/model) ile "taşıma/isimlendirme" (api_base, fiyat-anahtarı çözümlemesi) arasında olmalı; seçim mantığı LiteLLM'in strateji dosyalarındaki gibi %100 provider-agnostik tutulabilir (kanıt: §2 Desen A), taşıma/isimlendirme katmanı ise sağlayıcıya özel kalmaya mahkûm — bunu gizlemeye çalışmak (RouteLLM'in yaptığı gibi karar katmanına sabit istemci gömmek) K4'ü gerçek anlamda ihlal eder.
2. **Model Router sözleşmesi en az üç alan taşımalı** (DURUM.md taslağı + otel tazeleme düzeltmesiyle birlikte): (a) sağlayıcıya özel **taşıma ayarı** (`api_base` gibi — nvidia-nim-mcp, model-comparison-harness, litellm-router/azure kanıtı), (b) **yetenek beyanı** (`text`/`vision`/`embedding`/`safety` — nvidia-nim-mcp'nin `VISION_PROVIDERS`i ayrı liste açmak zorunda kalması), (c) açık uçlu **usage/cost sözlüğü** — ama gerekçesi DURUM.md'nin dediği gibi "sağlayıcılar farklı olduğu için" değil, otel tazelemesinin düzelttiği gibi **"kavramlar çekirdeğe terfi ederken sözleşme kırılmasın diye"**: sözlük, zamanla şemaya taşınacak alanlar için bir bekleme odası olmalı, kalıcı çöp kutusu değil.
3. **Maliyet katmanını kendimiz kuracağız, ama Desen B'nin tekrarına düşmeden.** Hiçbir kaynak (OTel dahil) USD standardı sunmuyor; hem Langfuse hem LiteLLM kendi fiyat tablosunu kurmuş ve ikisinde de güncelleme mekanizması belgesiz kalmış. ajans-os'un fiyat tablosu **açıkça belgelenmiş bir güncelleme prosedürü** (elle mi, hangi sıklıkla, hangi kaynaktan) taşımalı — bu, iki bağımsız projenin de atladığı adım.
4. **Sağlık sinyali üretmek yetmez, karara geri beslenmeli.** nvidia-nim-mcp'nin health probu üretip kullanmaması ile LiteLLM'in cooldown'unun aynı sinyali doğrudan filtreye bağlaması arasındaki fark (§3), ajans-os Router'ının hangi tarafta durması gerektiğini gösteriyor: LiteLLM tarafında.
5. **`failure_modes` (ADR-000 K5) sözleşmesinde hata türü ayrı, makine-okur bir alan olmalı** — serbest metin `message`'dan ayrı. İki bağımsız kaynak (model-comparison-harness `error_type`, litellm-router `_is_cooldown_required`) aynı ilkeye ulaşmış (§2 Desen C).

## 6. Açık sorular

- Yönlendirme kararı ajans-os'ta hangi sinyale dayanacak: yalnızca çalışma zamanı telemetrisi (LiteLLM tarzı), yoksa istek zorluğu tahmini (RouteLLM tarzı) bir katman da eklenecek mi? İkisi birbirini dışlamıyor (RouteLLM zaten `litellm.completion` üzerinden çağırıyor) ama eğitilmiş bir sınıflandırıcı bakım yükü getirir — bu, sentez fazının kararı.
- Fiyat tablosunun güncel tutulma prosedürü ne olacak (elle mi, harici bir API'den mi, hangi sıklıkla)? Hiçbir incelenen kaynak buna net bir cevap vermiyor.
- Span hiyerarşisi (parent/child) açık bir `gen_ai.*` attribute'una mı bağlanacak, yoksa OTel trace context'ine mi güvenilecek? Otel tazelemesi bunu "hâlâ trace context'e bırakılmış" olarak doğruladı (`events.yaml:18`) — ajans-os kendi ajan/tool span modelinde bunu açık bir alanla mı çözecek, yoksa aynı varsayıma mı güvenecek?
- Otel tazelemesinin "ajan span'i model bilmez, model bilgisi çağrı span'inde yaşar" ilkesi (`changelog.d/469.breaking.md`, `242`, `289`, `322`) ajans-os'un kendi ajan/araç span hiyerarşisiyle nasıl örtüşecek — bizim `invoke_agent` eşdeğerimiz bu inceltmeyi baştan mı benimseyecek?
- Açık uçlu usage/cost sözlüğündeki bir alanın ne zaman "çekirdeğe terfi ettiği"ne kim/nasıl karar verecek? Otel'in kendi süreci (community RFC, breaking change) bize model olabilir mi, yoksa daha hafif bir iç mekanizma mı gerekir?

## 7. İncelenmeyenler

Önceki turdan taşınan gerekçeler (DURUM.md):
- **`portkey-gateway`** — İ4'te zaten incelendi (`docs/arastirma/i4-guvenilirlik/portkey-gateway.md`), gateway/fallback tarafı orada kayıtlı; İ5'te tekrarlamak israf, matriste `iz: ["i4","i5"]` yeterli.
- **`Braintrust`, `Not Diamond`** — kapalı kaynak/SaaS ağırlıklı; protokol §1 canlılık kuralı OSI lisans istiyor, açılmadı.
- **`RAGAS`** — İ2'nin RAG kapsamıyla örtüşüyor, İ5 için marjinal.

Bu turda açılamayanlar:
- **`semantic-router`** (aurelio-labs) — `D:\Repolar\_inceleme\semantic-router` klonlu ama bütçe tavanı (16 araç çağrısı) yüzünden açılmadı. Odak sorusu (gömme benzerliğiyle sıfır-LLM-maliyetli yönlendirme) hâlâ açık.
- **`openllmetry`** (traceloop) — klonlanmadı, bütçe yüzünden açılmadı. OTel GenAI kurallarının pratikte nereden saptığını gösterecek ikinci bir enstrümantasyon örneği eksik kaldı.
- **`promptfoo` / `DeepEval`** — klonlu değil (indirilmedi), hem klon eksikliği hem bütçe nedeniyle açılmadı. İ4'ün "deterministik doğrulayıcı + LLM-yargıç" bulgusunun İ5 tarafındaki (maliyet/gözlem) karşılığı hâlâ doğrulanmadı.

## Dürüstlük

Bu özet yalnızca yukarıdaki 8 dosyaya (6 analiz + `DURUM.md` + `DENETIM-otomatik.md` özet tablosu) dayanıyor; hiçbir klona doğrudan girilmedi, hiçbir yeni kanıt üretilmedi — yalnızca mevcut analiz dosyalarındaki iddialar yeniden derlendi. `DENETIM-otomatik.md`'nin en güncel koşusu (v3, 08.09.2026 04:37, 6 analiz dosyası + DURUM.md dahil): **304 alıntının 199'u doğrulanabilir, bunun %88'i (158 TAM + 17 YAKIN) tuttu; 105'i VAR (doğrulanamayan ama çürütülmeyen), 24'ü şüpheli (21 TOKEN-YOK, 3 DOSYA-YOK).** Önceki (v2, yalnızca dört dosyalık) koşuda doğrulanabilir 117 alıntının %92'si tutmuştu; iki oran farklı kapsamlar üzerinden, doğrudan karşılaştırılamaz.

**Uyarı:** doğrulama aracı `semantic-conventions` (eski, donmuş) ile `semantic-conventions-genai` (yeni, tazeleme kaynağı) klonlarını ayırt edemiyor — `otel-genai-semconv.md` dosyasında hem donmuş sürüme hem tazeleme bölümüne ait alıntılar var ve araç ikisini aynı isim uzayında arıyor. Bu yüzden tazeleme bölümündeki alıntılar (`registry.yaml`, `changelog.d/*.breaking.md` gibi) yanlış depoda (eski `semantic-conventions` klonunda) eşleşmiş olabilir. Bu şüpheli grubun elle bakılması, protokol §4 gereği **ayrı bir koşuda** yazılacak resmî `DENETIM.md`'nin işi — bu özet o denetimi taklit etmiyor, yalnızca `DENETIM-otomatik.md`'nin toplu tablosuna atıfta bulunuyor.

Kayırma kontrolü: `nvidia-nim-mcp` ve `model-comparison-harness` kullanıcının kendi depoları; aynı altı ölçütle, aynı sertlikte puanlandılar (gözlemlenebilirlikte 1 ve 2, en düşük iki puan bu ikisine ait) — kaynak analiz dosyaları bunu kendi Dürüstlük bölümlerinde de açıkça belirtmişti, bu özet o değerlendirmeyi değiştirmeden aktardı.
