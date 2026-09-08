# OpenTelemetry GenAI Semantic Conventions

## Kimlik

repo: `open-telemetry/semantic-conventions` (klon: `D:/Repolar/_inceleme/semantic-conventions`) · yıldız: doğrulanmadı (GitHub'a erişim yok) · son push: doğrulanmadı — yerel `git log -1` tarihi `Mon Sep 7 18:02:05 2026` (commit `f860617`), bu klonlama/fetch anı olabilir, upstream commit tarihi ile aynı olmayabilir · lisans: Apache License 2.0 (`LICENSE:1-3`) · dil: YAML (model) + Markdown (docs) · sürüm: kök `CHANGELOG.md:11` `## v1.44.0` (henüz yayınlanmamış "next version" başlığı altında) — README rozeti ayrıca `OTel specification version v1.60.0` diyor (`README.md:5`), bu ikisi farklı şeyler, karıştırılmamalı. `package.json` içinde bir `"version"` alanı bulunamadı (grep boş döndü).

**canlılık: KISMİ GEÇTİ — kritik uyarı.** Bu depodaki GenAI içeriği v1.42.0'da ayrı bir depoya taşınmış ve burada **deprecated** olarak donduruldu: `CHANGELOG.md:118` `"gen-ai": Move Generative AI semantic conventions to a dedicated repository.` ve `CHANGELOG.md:119-122` `"All gen_ai.* attributes, metrics, events, and spans previously defined under model/gen-ai/, model/openai/, and model/mcp/ (and documented under docs/gen-ai/) are deprecated in this repository and have moved to the [OpenTelemetry GenAI semantic conventions repository]"`. `docs/gen-ai/` altındaki **10 markdown dosyasının tamamı** artık yönlendirme sayfası: `docs/gen-ai/README.md:5` `"# Moved: Generative AI semantic conventions"` ve `docs/gen-ai/README.md:10` `"[OpenTelemetry GenAI semantic conventions repository](https://github.com/open-telemetry/semantic-conventions-genai)"`. Aynı desen doğrulandı: `docs/gen-ai/gen-ai-spans.md:5`, `docs/gen-ai/gen-ai-agent-spans.md:5`, `docs/gen-ai/gen-ai-events.md:5`, `docs/gen-ai/gen-ai-exceptions.md:5`, `docs/gen-ai/gen-ai-metrics.md:5`, `docs/gen-ai/mcp.md:5`, `docs/gen-ai/anthropic.md:5`, `docs/gen-ai/aws-bedrock.md:5`, `docs/gen-ai/azure-ai-inference.md:5`, `docs/gen-ai/openai.md:5`, `docs/gen-ai/non-normative/examples-llm-calls.md:1`. Gerçek güncel spec `open-telemetry/semantic-conventions-genai` deposunda ve o depo `D:/Repolar` altında **klonlu değil** (kontrol edildi, `-iname "*genai*"` boş döndü). Bu analiz, taşımadan hemen önce burada "deprecated" olarak dondurulan **son YAML içeriğine** (`model/gen-ai/deprecated/*.yaml`) dayanıyor — yani "tarihî referans" ile "hâlâ geçerli birincil kaynak" arası bir durum: içerik gerçek ve doğru (taşınmadan bir gün önceki hali) ama artık bu depoda bakımı yapılmıyor.

## Çözdüğü problem

Farklı LLM sağlayıcıları (OpenAI, Anthropic, Google, AWS Bedrock, Azure...) ve farklı ajan çerçeveleri (LangChain, CrewAI, ADK...) için gözlemlenebilirlik verisini (span, metrik, event, hata) ortak bir `gen_ai.*` isim uzayında standartlaştırarak, herhangi bir izleme aracının (Jaeger, Datadog, Langfuse benzeri) sağlayıcıdan bağımsız şekilde LLM çağrılarını, ajan çalıştırmalarını ve araç (tool) kullanımını görüntüleyebilmesini sağlamak.

## Mimari

Spec deposu akışı üç katmanlı: (1) **registry** YAML'ı ham attribute tanımlarını (isim, tip, `brief`, `stability`, enum üyeleri) tutar — `model/gen-ai/deprecated/registry-deprecated.yaml` (1308 satır); (2) **span/metric/event** YAML'ları bu registry attribute'larına `ref:` ile referans vererek somut span/metrik/event şemaları kurar — `model/gen-ai/deprecated/spans-deprecated.yaml` (746 satır), `metrics-deprecated.yaml` (188 satır), `events-deprecated.yaml` (446 satır); (3) bir kod üretim aracı (Weaver — bu depoda doğrudan görülmedi, kapsam dışı `templates/`/`schemas/` altında olabilir) bu YAML'lardan `docs/gen-ai/*.md` sayfalarını üretir. Şu an bu üçüncü adımın çıktısı elle "Moved" uyarısıyla değiştirilmiş durumda; YAML'lar hâlâ dursa da (`deprecated:` alanıyla işaretli) artık markdown'a render edilmiyor.

## Klasör yapısı

```
docs/gen-ai/                          # Üretilmiş markdown — HEPSİ artık "Moved" stub'u
├── README.md                         # ana giriş, taşıma uyarısı (README.md:5-11)
├── gen-ai-spans.md, gen-ai-agent-spans.md, gen-ai-events.md,
│   gen-ai-metrics.md, gen-ai-exceptions.md, mcp.md            # konu başlıklarına göre bölünmüş sayfalar, hepsi stub
├── anthropic.md, openai.md, aws-bedrock.md, azure-ai-inference.md  # sağlayıcıya özel sayfalar, hepsi stub
└── non-normative/examples-llm-calls.md                        # örnekler, stub

model/gen-ai/deprecated/              # Taşımadan önceki SON gerçek içerik (donmuş, "deprecated" etiketli)
├── registry-deprecated.yaml          # attribute tanımları: gen_ai.system, .usage.*, .agent.*, .tool.*, .conversation.id ...
├── spans-deprecated.yaml             # span şemaları: inference, embeddings, retrieval, create_agent, invoke_agent, execute_tool, invoke_workflow, sağlayıcıya özel
├── metrics-deprecated.yaml           # token.usage, operation.duration, time_to_first_chunk/token, server.* metrikleri
└── events-deprecated.yaml            # chat mesajı event'leri (deprecated), evaluation.result, client.operation.exception
```

## Ajan tasarımı

"Ajan" dört attribute ile kimlikleniyor: `gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.agent.description`, `gen_ai.agent.version` (`model/gen-ai/deprecated/registry-deprecated.yaml:688-736`, örnek: `gen_ai.agent.id` brief `"The unique identifier of the GenAI agent."` örnek değer `"asst_5j66UpCpwteGg4YSxUnt7lPY"`). İki temel span var: `span.gen_ai.create_agent.client` (`spans-deprecated.yaml:370`, `span_kind: client`, "usually applicable when working with remote agent services", span adı `create_agent {gen_ai.agent.name}`) ve `span.gen_ai.invoke_agent` — hem `.client` (`spans-deprecated.yaml:531`) hem `.internal` (`spans-deprecated.yaml:566`) varyantı var; `gen_ai.operation.name` `invoke_agent` olmalı, span adı `invoke_agent {gen_ai.agent.name}` (`spans-deprecated.yaml:547-548`). Ajanın "tool" kullanması `execute_tool` internal span'iyle modelleniyor: `spans-deprecated.yaml:597` `id: span.gen_ai.execute_tool.internal`, `span_kind: internal`, span adı `execute_tool {gen_ai.tool.name}` (`spans-deprecated.yaml:610-612`), zorunlu attribute'lar `gen_ai.operation.name` ve `gen_ai.tool.name`, opsiyonel `gen_ai.tool.call.id`/`description`/`type`, içerik alanları (`gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`) `opt_in` (`spans-deprecated.yaml:637,639`). Not: `execute_tool` span'inin brief kısmı MCP'ye açıkça atıf yapıyor — `"MCP tool executions may also be traced by the corresponding MCP instrumentation"` (`spans-deprecated.yaml:612-614`).

## Orkestrasyon / iş akışı modeli

Çok ajanlı/çok adımlı akışlar için ayrı bir `invoke_workflow` internal span'i var: `spans-deprecated.yaml:703` `id: span.gen_ai.invoke_workflow.internal`, brief: `"Represents an operation that executes a coordinated process composed of multiple agents or other operations"` (`spans-deprecated.yaml:713-714`). Kritik ayrım kuralı açıkça yazılmış (`spans-deprecated.yaml:717-723`): bir framework kendi orkestrasyonunu ayırt edemiyorsa `invoke_workflow` **raporlamamalı** — örnek: *"Some frameworks like ADK have workflow agents that orchestrate other agents and report `invoke_agent` spans, so `invoke_workflow` SHOULD NOT be reported... Conversely, frameworks like CrewAI have a distinct concept of crew... so they SHOULD report `invoke_workflow` spans."* Yani modelleme, gerçek çerçeve davranışına göre koşullu. Span'ler arası **açık bir "parent/child" veya "hiyerarşi" attribute'u bulunamadı** — `spans-deprecated.yaml` ve `registry-deprecated.yaml` içinde `parent|hierarch|nest` araması sıfır sonuç verdi. Hiyerarşi, standart OpenTelemetry trace context (span'lerin doğal parent-child ilişkisi) ile kurulduğu varsayılıyor; bu açık bir cümleyle doğrulanamadı, **doğrulanmadı** olarak işaretliyorum.

## Durum ve bellek

`gen_ai.conversation.id` var: `registry-deprecated.yaml:676` `id: gen_ai.conversation.id`, brief `"The unique identifier for a conversation (session, thread), used to store and correlate messages within this conversation."` (`registry-deprecated.yaml:686`). Kullanım notu (`invoke_agent.common` grubunda, `spans-deprecated.yaml` civarı ~452-464) somut örnekler veriyor: *"when client framework being instrumented manages conversation history (see LlamaIndex chat store)... when instrumenting GenAI client libraries that maintain conversation on the backend side (see AWS Bedrock agent sessions, OpenAI Assistant threads)"*. Requirement level `conditionally_required: when available` — zorunlu değil, framework destekliyorsa doldurulmalı.

## Hata yönetimi

Her ortak span/metrik grubunda `error.type` var (`spans-deprecated.yaml:20-24`, `attributes.gen_ai.common` grubu): *"The `error.type` SHOULD match the error code returned by the Generative AI provider or the client library, the canonical name of exception that occurred, or another low-cardinality error identifier."* — kapalı bir enum değil, serbest metin (provider'a göre değişir). Ayrıca ayrı bir exception **event**'i var: `events-deprecated.yaml:417` `id: event.gen_ai.client.operation.exception`, brief: API hataları, rate limiting, model hataları, timeout'ları kapsıyor (`events-deprecated.yaml:427-429`); önerilen severity WARN (13) (`events-deprecated.yaml:432`); attribute'lar standart OTel `exception.type`/`exception.message`/`exception.stacktrace` (koşullu zorunlu, birbirini tamamlayacak şekilde).

## Genişletilebilirlik

Yeni sağlayıcı eklemek, mevcut örneklere göre en az 2-3 dosyaya dokunuyor: (1) `registry-deprecated.yaml` içindeki `gen_ai.system`/`gen_ai.provider.name` kapalı enum listesine yeni bir üye eklemek (`registry-deprecated.yaml:65-160` arası openai, gcp.*, anthropic, cohere, azure.*, ibm.watsonx.ai, aws.bedrock, perplexity, xai, deepseek, groq, mistral_ai üyeleri sıralı); (2) `spans-deprecated.yaml` içinde ortak grubu `extends` eden yeni bir span tanımı — örnekler: `span.openai.inference.client` `extends: attributes.gen_ai.inference.openai_based` (`spans-deprecated.yaml:213-220`), `span.anthropic.inference.client` `extends: attributes.gen_ai.inference.client` (`spans-deprecated.yaml:670-676`), `span.aws.bedrock.client` `extends: span.gen_ai.inference.client` (`spans-deprecated.yaml:650-656`); (3) `docs/gen-ai/<provider>.md` sayfası. Bu üç dosyalık desen, ortak şemayı bozmadan sağlayıcıya özgü alan eklemeyi mümkün kılıyor.

## Maliyet ve gecikme sayaçları

Token ve gecikme metrikleri kapsamlı: `metric.gen_ai.client.token.usage` (histogram, birim `{token}`, zorunlu `gen_ai.token.type` boyutu — `metrics-deprecated.yaml:54-73`), `metric.gen_ai.client.operation.duration` (histogram, birim `s` — `metrics-deprecated.yaml:74-98`), `gen_ai.client.operation.time_to_first_chunk` / `time_per_output_chunk` (`metrics-deprecated.yaml:99-137`), ve sunucu tarafı `gen_ai.server.request.duration`/`time_per_output_token`/`time_to_first_token` (`metrics-deprecated.yaml:138-188`). Token sayaçları ayrıntılı: `gen_ai.usage.input_tokens`, `.output_tokens`, `.cache_read.input_tokens`, `.cache_creation.input_tokens`, `.reasoning.output_tokens` (`registry-deprecated.yaml:577-646`).

**Maliyet (USD) için standart bir attribute YOK.** `model/gen-ai/deprecated/*.yaml` dosyalarının tamamında (`registry-deprecated.yaml`, `spans-deprecated.yaml`, `metrics-deprecated.yaml`, `events-deprecated.yaml`) `cost|price|usd|dollar` için yapılan büyük/küçük harf duyarsız arama **sıfır sonuç** döndürdü. Maliyet hesaplaması tamamen tüketici tarafına (Langfuse gibi araçlara) bırakılmış — spec sadece token sayısı sağlıyor, fiyatlandırmayı değil.

## Güçlü yönler (kanıtlı)

- İçerik taşıyan tüm alanlar (`gen_ai.input.messages`, `.output.messages`, `.system_instructions`, `.tool.definitions`, `.tool.call.arguments`, `.tool.call.result`) `requirement_level: opt_in` olarak işaretli (`spans-deprecated.yaml:127,129,131,133` ve `355,359`) — varsayılan olarak içerik toplanmıyor.
- Sağlayıcıya özgü cache token muhasebesi net kurallara bağlanmış: Anthropic notu *"Anthropic `input_tokens` excludes cached tokens. Compute: `gen_ai.usage.input_tokens = input_tokens + cache_read_input_tokens + cache_creation_input_tokens`"* (`spans-deprecated.yaml:688-692`).
- `invoke_agent` / `invoke_workflow` ayrımı soyut değil, gerçek çerçeve davranışına (ADK vs. CrewAI) referansla tanımlanmış (`spans-deprecated.yaml:717-723`).

## Zayıf yönler (kanıtlı)

- `model/gen-ai/deprecated/*.yaml` içindeki **hiçbir** grup `stability: stable` değil — dört dosyada da `grep -rc "stability: stable"` sonucu `0` (doğrulandı, dört dosya için de sıfır).
- `gen_ai.system` attribute'u kendisi deprecated ve `gen_ai.provider.name`'e yeniden adlandırılmış (`registry-deprecated.yaml:160` `brief: "Deprecated, use \`gen_ai.provider.name\` instead."`) — orta düzey churn riski.
- Span hiyerarşisi için açık bir modelleme/attribute yok (yukarıda not edildi) — çok ajanlı bir izde "hangi tool call hangi agent adımına ait" bilgisi sadece OTel trace context'ine (span nesting) bağlı, `gen_ai.*` şemasında açık bir bağ attribute'u yok.
- Konvansiyonun kendisi bu depodan tamamen taşınmış (`CHANGELOG.md:118-122`) — "birincil kaynak" artık başka bir depoda, bu da inceleme/entegrasyon için ekstra dolaylılık yaratıyor.

## Puan (1–5)

- **olgunluk: 2** — dört YAML dosyasının tamamında `stability: stable` sıfır kez geçiyor (grep doğrulandı), üstelik konvansiyon tamamen ayrı bir depoya taşınmış (`CHANGELOG.md:118`).
- **mimari netlik: 4** — registry/span/metric/event ayrımı ve `extends`/`ref` mekanizması net ve tutarlı (`spans-deprecated.yaml:213,650,670` üç farklı sağlayıcı örneği).
- **genişletilebilirlik: 4** — yeni sağlayıcı eklemek kanıtlı, tekrarlanan 2-3 dosyalık bir desen izliyor (enum üyesi + `extends` span + doküman sayfası).
- **güvenilirlik ilkelleri: 3** — `error.type` ve ayrı exception event'i var (`events-deprecated.yaml:417-446`) ama bu bir *gözlemlenebilirlik* standardı, retry/circuit-breaker gibi *davranış* ilkeleri kapsam dışı.
- **gözlemlenebilirlik: 4** — token/süre/TTFT/TPOT üçlü metrik seti + span + event kombinasyonu kapsamlı (`metrics-deprecated.yaml` tüm dosya).
- **güvenlik duruşu: 4** — içerik alanları sistematik olarak opt-in ve PII uyarılı (`registry-deprecated.yaml:1144,1212` `"This attribute is likely to contain sensitive information including user/PII data."`).

## ADR-000 K4 kanıtı

Bu spec, K4'ü ("Sistem hiçbir LLM sağlayıcısına doğrudan bağlanmaz, tek bir Model Router sınırı vardır") **kısmen güçlendiriyor, kısmen de somut bir sınır uyarısı taşıyor.** Güçlendirme yönü: ortak `gen_ai.*` şeması (istek/yanıt/kullanım/hata) tüm sağlayıcılar için aynı isim uzayında tanımlanmış, tüketici taraf (Langfuse gibi) sağlayıcıdan bağımsız tek bir şemayla çalışabiliyor. Ancak kanıtlar, sağlayıcıya özgü **gerçek sinyallerin** ortak şemaya sığmadığını, her sağlayıcı için ayrı bir uzantı katmanı gerektirdiğini gösteriyor:

- **Anthropic**: cache token hesaplama kuralı sadece Anthropic notunda var — `spans-deprecated.yaml:688-692` (`input_tokens = base + cache_read + cache_creation`), diğer sağlayıcılarda bu formül geçerli değil.
- **OpenAI**: `openai.request.service_tier`, `openai.response.service_tier`, `openai.response.system_fingerprint`, `openai.api.type` gibi tamamen OpenAI'a özel attribute'lar var (`spans-deprecated.yaml:213-241`) — bunlar `gen_ai.*` ortak isim uzayında değil, ayrı bir `openai.*` isim uzayında.
- **AWS Bedrock**: `aws.bedrock.guardrail.id` (zorunlu!) ve `aws.bedrock.knowledge_base.id` (`spans-deprecated.yaml:650-661`) — guardrail bilgisi ortak şemada karşılığı olmayan, Bedrock'a özgü bir güvenlik/kontrol sinyali.

**Ortak sınırın kaybettirdiği somut şeyler:** reasoning/extended-thinking token'ları (`gen_ai.usage.reasoning.output_tokens`, `registry-deprecated.yaml:634-646` — Anthropic "extended thinking" ve OpenAI "reasoning" farklı kavramlar ama tek attribute'a sıkıştırılmış), servis katmanı (`service_tier`) ve guardrail kimliği gibi bilgiler. Sonuç: tek bir Model Router sınırı çizilirse, bu sağlayıcıya özgü zengin sinyaller (guardrail id, cache türü ayrımı, service tier) ya kaybolur ya da Router'ın kendisinin "provider metadata passthrough" alanı taşıması gerekir — K4'ü çürütmüyor ama sınırın nereye çizileceğine dair somut bir tasarım notu veriyor.

## Alınacak fikir

- **Opt-in içerik alanları** (`gen_ai.input.messages`/`output.messages` varsayılan kapalı, `spans-deprecated.yaml:127-133`) — bizim gözlem ekonomisi katmanında prompt/completion loglaması varsayılan kapalı olmalı, açık config ile açılmalı; PII riskini spec seviyesinde çözen basit ve doğru bir desen.
- **Cache token ayrımı** (`cache_read.input_tokens` / `cache_creation.input_tokens`, `registry-deprecated.yaml:594-621`) — maliyet motorumuzda normal input token ile cache'den okunan/cache'e yazılan token'ı ayırmak gerçek maliyeti yansıtır; doğrudan uygulanabilir.
- **`invoke_workflow` vs `invoke_agent` ayrımı** (`spans-deprecated.yaml:703-723`) — bizim ajans-os'ta "çok adımlı iş akışı" ile "tekil ajan çağrısı" span'lerini ayırmak için hazır bir isimlendirme deseni; framework kendi orkestrasyonunu ayırt edemiyorsa hangisini raporlamayacağına dair net kural de faydalı.
- **`execute_tool` ayrı internal span'i** (`spans-deprecated.yaml:597-641`) — tool çağrılarını ayrı span'e çıkarmak, ajan adımı ile araç yürütmesini ayrıştırmak için doğrudan örnek.

## Alınmayacak

- **Kapalı `gen_ai.system`/`provider.name` enum listesi** (`registry-deprecated.yaml:65-160`) — bizim Model Router'da sağlayıcı seti değişken ve iç kullanım; kapalı bir enum'u güncel tutmak gereksiz bakım yükü, serbest string yeterli.
- **Sağlayıcıya özel ayrı dosya/attribute grupları** (`anthropic.md`, `openai.md`, `aws-bedrock.md`, `azure-ai-inference.md`) — K4 gereği tek bir Model Router sınırımız var; bu kadar sağlayıcıya özel dallanmayı (her sağlayıcı için ayrı span+doküman) kendi sistemimizde yeniden kurmak K4 ile çelişir, gereksiz karmaşıklık.
- **OpenAI'a özel `service_tier`/`system_fingerprint` attribute'ları** (`spans-deprecated.yaml:236-241`) — tek sağlayıcıya bağımlı, çok sağlayıcılı router mimarimizde karşılığı yok.

## Dürüstlük

- **En önemli sınırlama**: `docs/gen-ai/` altındaki 10 markdown dosyasının ve `non-normative/examples-llm-calls.md`'nin tamamı artık "Moved" yönlendirme sayfası (kanıtlar yukarıda "canlılık" bölümünde). Gerçek güncel içerik `open-telemetry/semantic-conventions-genai` deposunda ve bu makine üzerinde klonlu değil (`D:/Repolar` altında `*genai*` deseni aratıldı, sonuç yok). Görev kapsamı açıkça bu depoyla (`docs/gen-ai/`, `model/gen-ai/`) sınırlı olduğu ve ayrı depo klonlamak kapsam dışı olacağı için, bu depoda kalan **son dondurulmuş YAML içeriğine** (`model/gen-ai/deprecated/*.yaml`) dayanarak analiz yaptım. Bu içerik gerçek ve v1.42.0 taşımasından hemen öncesine ait (JSON schema referanslarında `v1.41.0` görülüyor, örn. `registry-deprecated.yaml:1134`), ama artık bu depoda bakımı yapılmıyor.
- Yıldız sayısı ve gerçek upstream "son push" tarihi doğrulanamadı — internet/GitHub API erişimi kullanılmadı, sadece yerel dosya sistemi incelendi.
- `package.json` içinde repo sürümünü gösteren bir `"version"` alanı bulunamadı; CHANGELOG üst başlığı (`v1.44.0`) ile README rozetindeki OTel spesifikasyon sürümü (`v1.60.0`) farklı kavramlar, ikisini birbirine karıştırmadım.
- CHANGELOG'da aynı taşımaya dahil edilen `model/mcp/` ve `model/openai/` klasörleri (`CHANGELOG.md:120`) kapsam dışı bırakıldığı için doğrudan incelenmedi — sadece CHANGELOG referansı üzerinden bilgi sahibiyim, içerikleri okunmadı.
- Span hiyerarşisinin (parent/child ilişkisi) YAML'larda açıkça nasıl ifade edildiğine dair bir cümle bulunamadı (`parent|hierarch|nest` araması dört dosyada da sıfır sonuç) — bunun standart OTel trace context ile yapıldığını varsayıyorum ama bu **doğrulanmadı**, açık bir kaynağa bağlayamadım.
- Kullanılan araç çağrısı sayısı: 17 (tavan: 28).
