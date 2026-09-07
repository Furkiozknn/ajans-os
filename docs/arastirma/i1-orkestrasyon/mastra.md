# Mastra

## Kimlik

Doğrulanmış: mastra-ai/mastra · 27.745 yıldız · 103 watcher · son push 2026-09-07 · TypeScript · arşivlenmemiş.

**Lisans (kritik bulgu):** GitHub'da "NOASSERTION" görünmesinin nedeni depoda tek bir düz `LICENSE` dosyası olmaması. Repo kökünde `LICENSE.md` var ve içeriği şöyle (kelimesi kelimesine okundu):

- `LICENSE.md`, "içerik `ee/` adlı herhangi bir klasörün altındaysa `ee/LICENSE`'daki lisansa tabidir; onun dışındaki her şey Apache License 2.0'dır" diyor (Copyright (c) 2025 Kepler Software, Inc.).
- `ee/LICENSE` ayrı ve **kaynağı açık ama OSI onaylı olmayan** bir "Mastra Enterprise Edition (EE) License v1.0" (Copyright (c) 2026 Kepler Software, Inc.): üretimde kullanmak için Kepler ile yazılı anlaşma şart; değişiklik/patch göndermek serbest ama kopyalama/dağıtma/satış yasak.
- `packages/core/src` içinde bu EE lisansı şu iki klasörü kapsıyor: `packages/core/src/auth/ee` ve `packages/core/src/agent-builder/ee` (LICENSE.md'de de açıkça sayılıyor).

Sonuç: **çekirdek kod tabanının büyük kısmı Apache-2.0 (OSI onaylı)**, ama auth ve agent-builder gibi bazı üretim-kritik alt sistemlerin bir kısmı kapalı/ticari lisanslı bir alt ağaçla (`ee/`) örtüşüyor. Canlılık değerlendirmesinde bunu "kısmen açık kaynak — EE alt ağacı OSI dışı" olarak işaretlemek gerekir; proje tamamen kapalı değil ama üretim kullanımı için sınırsız özgür değil.

Kök `package.json`'da `"license": "Apache-2.0"` yazsa da bu, `LICENSE.md`'deki gerçek karma yapıyı yansıtmıyor (npm alanı basitleştirilmiş).

`@mastra/core` paket sürümü: `1.65.0-alpha.7` (hâlâ alpha/hızlı değişen bir çekirdek — canlılık açısından olgun ama kararlılık taahhüdü zayıf sinyali).

## Çözdüğü problem

Mastra, LLM tabanlı ajan uygulamaları için "tek çatı" bir TypeScript framework'ü: ajan tanımı (model + araçlar + talimat), durable/suspend-edilebilir iş akışı motoru, thread/resource bazlı bellek (working memory dahil), araç (tool) soyutlaması, storage/telemetri katmanı ve çoklu model sağlayıcı desteğini tek bir `@mastra/core` paketinde birleştiriyor. Vercel AI SDK'yı alt katman olarak kullanıp üstüne kendi agentic loop, workflow motoru ve kalıcılık (persistence) katmanını inşa ediyor.

## Mimari (bileşen + veri akışı; dosya yolu ver)

`packages/core/src` altında ~50 alt modül var; en kritik olanlar:

- **Ajan katmanı** — `agent/agent.ts` (10.026 satır, tek dev dosya): `Agent` sınıfı (satır 554'te tanımlı), model seçimini `resolveModelConfig` (`../llm`, satır 31) ve `ModelRouterLanguageModel` (`../llm/model/router`, satır 43) üzerinden çözüyor. İki farklı LLM motoru var: eski `MastraLLMV1` (`../llm/model`, satır 33) ve yeni `MastraLLMVNext` (`../llm/model/model.loop`, satır 40).
- **Agentic loop** — `agent.ts` satır 3700'de `(llm as MastraLLMVNext).stream(...)` çağrısı gerçek üretimi tetikliyor; asıl döngü mantığı `loop/loop.ts` içinde ve bu döngü `@internal/ai-sdk-v5`'in `ToolSet`/`generateId` tiplerini kullanıyor (satır 1-2), kendi `streamText`/`generateText` sarmalayıcısını yazmak yerine `loop/workflows/stream.ts`'deki `workflowLoopStream`'i çağırıyor (satır 9) — yani **ajan yürütme döngüsünün kendisi dahili olarak bir Mastra workflow'u olarak kurgulanmış** (kendi motorunu kendi üstünde kullanma / "dogfooding").
- **Alt-ajan / ağ (network) orkestrasyonu** — `agent.ts` satır 46'da `networkLoop` (`../loop/network`) import ediliyor; `agent/subagent.ts` bir ajanı başka bir ajana araç olarak bağlıyor; delegasyonda `maxSteps` üst ajanın verdiği değeri alt ajanın kendi varsayılanına göre üstten sınırlıyor (`agent.ts` satır 5132-5143: "Cap the LLM-provided maxSteps at the sub-agent's own configured [default]").
- **Workflow motoru** — `workflows/workflow.ts` (5.231 satır) `Workflow` sınıfını tanımlıyor (satır 1668); adım ekleme API'leri: `.then()` (satır 1888), `.agent()` (satır 1946, bir ajanı doğrudan adım olarak ekliyor), `.tool()` (satır 2003), `.sleep()`/`.sleepUntil()` (2032/2082), `.map()` (2143), `.waitForEvent()` (2128), `.parallel()` (2314), `.branch()` (2374, koşullu dallanma), `.dowhile()`/`.dountil()` (2438/2491), `.foreach()` (2544). Her çağrı `this.stepFlow` ve `this.serializedStepFlow` dizilerine bildirimsel (declarative) bir graph girdisi ekliyor; `buildExecutionGraph()` (satır 2608) ve `commit()` (2620) bunu çalıştırılabilir bir `ExecutionGraph`'a derliyor.
- **Yürütme motoru soyutlaması** — `workflows/execution-engine.ts`: `abstract class ExecutionEngine` (satır 69), sağlayıcıların (`DefaultExecutionEngine`, Inngest tabanlı motor vb.) kendi yürütme mantığını implemente ettiği taban sınıf. `ExecutionEngineOptions` içinde `onStart`/`onFinish`/`onError` hook'ları, `shouldPersistSnapshot` (satır 32) ve run-bazlı persist override mekanizması (satır 80-105) var.
- **Varsayılan motor** — `workflows/default.ts` (1.258 satır): `executeStepWithRetry` (satır 451) her adımı `retries+1` kez dener, `MastraNonRetryableError` fırlatılırsa döngüyü hemen kırıyor (satır 481-483); suspend olan adımların `suspendPayload`'ını `stepResults`'tan toplayıp `base.suspended`/`base.suspendPayload`'a yazıyor (satır 652-665); resume çağrısı `resume.resumePath` ile kaldığı adımdan devam ediyor (satır 825-827).
- **Bellek** — `memory/memory.ts`: `abstract class Memory` (satır ~106'dan itibaren), `getThreadById`/`listThreads`/`deleteThread` gibi soyut metodlar; `memoryDefaultOptions` (satır 81) working memory'i varsayılan **kapalı** (`enabled: false`) getiriyor ve `workingMemory.use` seçeneğinin kaldırıldığını, artık "always uses tool-call mode" olduğunu belirtiyor (satır 383-385).
- **Araçlar** — `tools/tool.ts`: `class Tool` (satır 193), `suspendSchema`/`resumeSchema` alanları (217-221) ile araçların da workflow adımları gibi askıya alınıp devam ettirilebildiğini gösteriyor (insan-onayı / HITL akışı için `tools/hitl.md` ayrı doküman olarak mevcut).
- **Storage** — `storage/base.ts`: `class MastraCompositeStore extends MastraBase` (satır 342) ve `class MastraStorage extends MastraCompositeStore {}` (satır 684) — somut depolama her "domain" (memory, workflows, scores, schedules, mcp-servers, vb.) için `storage/domains/*` altında ayrı sınıflarla enjekte ediliyor (composite/domain-driven storage deseni).
- **Hata modeli** — gerçek `MastraBaseError`/`MastraError` sınıfları `packages/_internal-core/src/error/index.ts` içinde tanımlı (ayrı bir iç paket, `@internal/core/error` olarak re-export ediliyor: `packages/core/src/error/index.ts`). `ErrorDomain` enum'u (satır 7-25) TOOL/AGENT/MCP/AGENT_NETWORK/MASTRA_WORKFLOW/STORAGE/MODEL_ROUTER gibi 20 domain tanımlıyor; `ErrorCategory` (28-32) USER/SYSTEM/THIRD_PARTY/UNKNOWN ayrımı yapıyor; her `MastraError` JSON'a serileşebiliyor (`toJSON`, satır 128-136).

## Klasör yapısı (2 seviye, yorumlu)

```
packages/core/src/
  agent/            # Agent sınıfı, alt-ajan (subagent.ts), araç onayı (tool-approval.ts), trip-wire.ts (guardrail kesme)
  agent-builder/    # Ajan üreten meta-ajan; ee/ alt klasörü ticari lisanslı
  auth/             # Yetkilendirme (FGA); ee/ alt klasörü ticari lisanslı
  workflows/        # Workflow DSL, execution-engine.ts, default.ts (varsayılan motor), handlers/
  loop/             # Ajanın kendi agentic loop'u; network/ (çoklu ajan orkestrasyonu), workflows/ (loop'un workflow olarak kurgulanması)
  memory/           # Thread/resource bazlı bellek, working memory, system-reminders.ts
  tools/            # Tool sınıfı, suspend/resume, provider-tool-utils (MCP/harici araç uyumu)
  storage/          # MastraCompositeStore, domains/ (her veri türü için ayrı depo), providers/ (ör. github.ts)
  llm/              # Model soyutlaması: model.ts (v1), model.loop.ts (vNext), router.ts (ModelRouterLanguageModel), gateways/
  observability/    # Tracing/span tipleri (Span, SpanType, TracingPolicy)
  telemetry/        # Telemetri entegrasyonu
  error/            # @internal/core/error'ı yeniden dışa veren ince katman
  mcp/              # Model Context Protocol entegrasyonu
  processors/       # Girdi/çıktı işleyici zinciri (mesaj/araç dönüştürme)
  evals/, scores/   # Değerlendirme ve skor motoru
```

## Ajan tasarımı

`Agent` sınıfı (`agent/agent.ts:554`) tek merkezi sınıf; model, araçlar, bellek, alt-ajanlar ve kanallar (`AgentChannels`, satır 15) hepsi bu sınıf üzerinden yapılandırılıyor. Model iki nesil motorla çalışabiliyor (`MastraLLMV1` / `MastraLLMVNext`); model seçimi statik olabildiği gibi `resolveModelConfig` ile dinamik/router tabanlı da olabiliyor (`ModelRouterLanguageModel`, çoklu sağlayıcı: Anthropic/OpenAI/Google/Groq/Mistral/xAI/Cerebras/DeepSeek/Perplexity/TogetherAI/Alibaba/Azure — hepsi `@ai-sdk/*` paketlerinin birden çok sürümü olarak `packages/core/package.json`'da vendörlenmiş, ör. `@ai-sdk/anthropic-v5/v6/v7`). Alt-ajanlar (`agent/subagent.ts`) bir ajanı başka bir ajana araç olarak takıyor; delegasyonda `maxSteps` üst sınırı alt ajanın kendi varsayılanına göre kısıtlanıyor (agent.ts:5132-5143) — kontrolsüz döngü büyümesine karşı somut bir önlem.

## Orkestrasyon / iş akışı modeli

Workflow DSL bildirimsel bir zincirleme API: `.then()/.parallel()/.branch()/.dowhile()/.dountil()/.foreach()/.sleep()/.waitForEvent()/.map()` — her biri `stepFlow` grafiğine bir düğüm ekliyor (workflow.ts, ör. satır 1888, 2314, 2374, 2438). `.agent()` ve `.tool()` metodları bir ajanı veya aracı doğrudan adım olarak zincire sokabiliyor (1946, 2003) — ajan ve workflow modelleri iç içe geçmiş durumda (bir workflow adımı bir ajanı çağırabilir, ajanın kendi loop'u da bir workflow'dur). Yürütme, soyut `ExecutionEngine` (execution-engine.ts:69) üzerinden pluggable: repo içinde en az `DefaultExecutionEngine` (`workflows/default.ts`) var; retry mantığı `executeStepWithRetry` (default.ts:451) ile adım bazında, `MastraNonRetryableError` ile kesilebilir hâlde uygulanıyor.

## Durum ve bellek

**Workflow durumu (suspend/resume):** Her adım çıktısı `stepResults`'a yazılıyor; bir adım `suspend()` çağırırsa (`workflows/step.ts` — `ExecuteFunctionParams.suspend`, satır ~53) çalışma "suspended" statüsüne geçiyor, `suspendPayload` ve hangi adımların askıda olduğu ayrıştırılıp kalıcı hâle getiriliyor (default.ts:652-665). `resume()` çağrısı `resumePath` bilgisiyle kaldığı yerden devam ediyor (default.ts:825-827). Bu mekanizma workflow snapshot'ı olarak saklanıyor (`storage/workflow-snapshot.ts`).

**Ajan belleği:** `Memory` soyut sınıfı (memory/memory.ts) thread (konuşma) ve resource (kullanıcı) bazlı iki kapsam tanımlıyor; `scope?: 'thread' | 'resource'` alanı hem semantic-recall hem working-memory hem de retrieval ayarlarında tekrarlanıyor (memory/types.ts satır 189, 370, 833, 896 — working memory'nin retrieval'ı varsayılan olarak `'resource'` kapsamlı, yani thread'ler arası). Working memory varsayılan olarak **kapalı** geliyor (`memoryDefaultOptions.workingMemory.enabled = false`, memory.ts:85) ve artık yalnızca "tool-call mode" ile çalışıyor — eski `use` seçeneği kaldırılmış ve kullanılırsa hata fırlatılıyor (memory.ts:383-385).

## Hata yönetimi

Gerçek hata sınıfı `packages/_internal-core/src/error/index.ts` içinde: `MastraBaseError` (satır 78) her hatayı `id` (kod), `domain` (20 değerli enum, TOOL/AGENT/MCP/MASTRA_WORKFLOW/STORAGE/MODEL_ROUTER vb.), `category` (USER/SYSTEM/THIRD_PARTY/UNKNOWN) ve `details` ile yapılandırıyor; `toJSON()` (satır 128) API/log için serileşebilir çıktı üretiyor. `MastraNonRetryableError` ayrı bir alt tip olarak retry döngüsünü kesiyor (default.ts:481). Workflow motorunda ayrıca `TripWire` kavramı var (default.ts: `tripwireData.options?.retry`, satır 641) — bir processor/guardrail çalışmayı kasıtlı olarak durdurduğunda ayrı bir "tripwire" statüsü ve kendi retry/metadata bilgisiyle taşınıyor.

## Genişletilebilirlik

- **Model sağlayıcı:** Vercel AI SDK'nın `@ai-sdk/provider` arayüzünü temel alıyor ama kendi `ModelRouterLanguageModel` (`llm/model/router.ts`) ile sarmalıyor; aynı sağlayıcının 4/5/6/7 (v4-v7) AI SDK sürümlerini eşzamanlı olarak npm alias'larıyla vendörlemiş (`packages/core/package.json`, ör. `"@ai-sdk/anthropic-v5": "npm:@ai-sdk/anthropic@2.0.91"`), yani AI SDK'ya sıkı bağımlı ama sürüm geçişlerini kendi router'ı arkasında soyutluyor.
- **Storage:** `MastraCompositeStore` (storage/base.ts:342) her veri türü (memory, workflows, scores, mcp-servers, schedules...) için ayrı "domain" implementasyonu enjekte etmeye izin veriyor (`storage/domains/*`), yani yeni bir backend eklemek domain bazında parça parça yapılabiliyor.
- **Araçlar:** `Tool` sınıfı (tools/tool.ts:193) suspend/resume ile HITL (insan onayı) desteğine açık; `tools/provider-tool-utils.ts` ile MCP/üçüncü taraf araç şemalarının uyarlanması ayrı bir katman.
- **Workflow motoru:** `ExecutionEngine` soyut sınıfı (execution-engine.ts:69) sayesinde varsayılan motorun yanına (ör. Inngest gibi durable-execution sağlayıcıları) alternatif motorlar takılabiliyor — kod tabanındaki yorumlar "Inngest engine: overrides to throw RetryAfterError for external retry handling" (default.ts:444) diyerek bunu doğruluyor.

## Güçlü yönler (kanıtlı)

- Workflow ve ajan modelleri birbirine kenetli: ajanın kendi agentic loop'u dahili olarak bir workflow olarak yürütülüyor (`loop/loop.ts:9`, `workflowLoopStream`), bu da suspend/resume ve retry gibi workflow düzeyi garantilerin ajan seviyesine de sızmasını sağlıyor.
- Hata taksonomisi merkezi ve yapılandırılmış: 20 `ErrorDomain` + 4 `ErrorCategory` + JSON serileşme (`_internal-core/src/error/index.ts:7-136`) — log/telemetri entegrasyonu için hazır.
- Adım bazlı retry + non-retryable ayrımı net kod ile kanıtlı (`workflows/default.ts:451-483`): sonsuz veya anlamsız retry döngülerine karşı açık bir çıkış yolu var.
- Bellek kapsamı (thread vs resource) tasarımı açık ve tekrar eden bir sözleşme olarak kod genelinde tutarlı uygulanmış (`memory/types.ts` çoklu satır).

## Zayıf yönler (kanıtlı)

- `agent/agent.ts` tek dosyada 10.026 satır — aşırı merkezi, tek sorumluluk ilkesinden uzak bir "god object"; bakım ve inceleme riski yüksek (dosya boyutu doğrudan ölçüldü).
- Lisans yapısı karmaşık ve kısmen kapalı: `ee/` alt ağacı (`auth/ee`, `agent-builder/ee`) OSI onaylı olmayan ticari bir lisansla korunuyor; npm `package.json`'daki `"license": "Apache-2.0"` beyanı bu ayrımı yansıtmıyor, kullanıcıyı yanıltabilir.
- `@mastra/core` sürümü hâlâ `1.65.0-alpha.7` — çekirdek paket resmi olarak "alpha" damgalı, API kararlılığı taahhüdü zayıf.
- AI SDK'nın aynı anda 4 farklı majör sürümünün (v4-v7) her sağlayıcı için ayrı ayrı vendörlenmesi (`package.json`'da onlarca `@ai-sdk/*-v5/-v6/-v7` alias'ı) bağımlılık ağacını ve bundle boyutunu ciddi şekilde şişiriyor; sürüm uyumsuzluğu riskini kod tabanına taşıyor.

## Puan (1–5)

- olgunluk: 3 — geniş özellik seti ve aktif geliştirme var ama çekirdek paket hâlâ alpha sürüm numarasıyla dağıtılıyor (`@mastra/core@1.65.0-alpha.7`).
- mimari netlik: 3 — modül ayrımı (workflows/agent/memory/storage) net, fakat `agent.ts` gibi tek dosyaların 10 binin üzerinde satıra çıkması netliği zedeliyor.
- genişletilebilirlik: 4 — `ExecutionEngine`, `MastraCompositeStore` ve model router soyutlamaları somut, kodda kanıtlı genişletme noktaları sunuyor.
- güvenilirlik ilkelleri: 4 — adım bazlı retry/non-retryable ayrımı, suspend/resume, tripwire ve snapshot persist mekanizmaları kodda doğrulandı.
- gözlemlenebilirlik: 3 — `observability/`, `telemetry/` modülleri ve `Span`/`TracingPolicy` tipleri mevcut, ama bu oturumda derinlemesine incelenmedi (dosya varlığı doğrulandı, içerik detaylı okunmadı).
- güvenlik duruşu: 2 — `auth/ee` (yetkilendirme/FGA) ticari lisanslı kapalı alt ağaçta; çekirdek açık kaynak sürümünde ince taneli yetkilendirmenin tam işlevsel olup olmadığı bu incelemeden net değil, bu belirsizliğin kendisi bir risk.

## Alınacak fikir

1. **Ajan döngüsünü workflow motoru üzerinde kurma deseni** (`loop/loop.ts` → `workflowLoopStream`): kendi orkestratörümüzün agentic loop'unu da suspend/resume, retry ve snapshot gibi workflow-seviyesi ilkelleri bedava kazanacak şekilde workflow motorunun bir örneği olarak modellemek — ayrı bir "ajan çalıştırma" ve "iş akışı çalıştırma" kod yolu tutmamak.
2. **Yapılandırılmış, domain+category'li merkezi hata sınıfı** (`_internal-core/src/error/index.ts`): her hatanın `id`/`domain`/`category`/`details` ile JSON'a serileşmesi ve retry-edilebilirliğin (`MastraNonRetryableError`) tip sisteminde ayrı bir sınıf olarak temsil edilmesi — bizim ADR-000'daki hata sözleşmesi için doğrudan uygulanabilir bir şablon.

## Alınmayacak

`agent.ts`'i tek dosyada 10.000+ satır büyütme deseni — kısa vadede hızlı geliştirmeye izin verse de okunabilirlik ve izole test edilebilirlik açısından anti-pattern; bizim ajan sözleşmesi (16 alanlı) için sorumlulukları en baştan ayrı modüllere (model çözümleme, alt-ajan delegasyonu, kanal yönetimi, araç onayı) bölmek daha sağlıklı.

## Matris cevapları

- saglayici_bagimsiz: kismen — model tarafında `ModelRouterLanguageModel` ile çoklu sağlayıcı soyutlanmış (Anthropic/OpenAI/Google/Groq/Mistral/xAI vb.), ama tüm soyutlama Vercel AI SDK'nın `@ai-sdk/provider` arayüzüne ve onun 4 farklı majör sürümüne (v4-v7, hepsi vendörlenmiş) sıkıca bağlı; AI SDK'nın kendisinden bağımsız değil.
- sozlesme_var: evet — `Step` arayüzü (`workflows/step.ts`) girdi/çıktı/resume/suspend/state için `StandardSchemaWithJSON` şemaları zorunlu kılıyor; `Tool` sınıfı da aynı şemalama disiplinini taşıyor (tools/tool.ts).
- insan_kapisi: evet — hem workflow adımlarında (`suspend()`/`resume()`, workflows/step.ts) hem de araç düzeyinde (`Tool.suspendSchema`/`resumeSchema`, tools/tool.ts:217-221, ayrıca `tools/hitl.md` dokümanı) açık bir insan-onayı/duraklama mekanizması var.
- checkpoint: evet — her adım sonucu `stepResults`'a yazılıp `shouldPersistSnapshot` ile kalıcı snapshot'a (`storage/workflow-snapshot.ts`) dönüştürülüyor; suspend anında `suspendPayload` ve askıdaki adım listesi ayrıca saklanıp `resumePath` ile geri yükleniyor (workflows/default.ts:652-665, 825-827).
