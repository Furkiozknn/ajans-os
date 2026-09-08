# Langfuse

## Kimlik
repo: `langfuse/langfuse` (README rozetlerinden: `github.com/langfuse/langfuse`) · yıldız: doğrulanmadı (internet erişimi yok, sadece yerel klon incelendi) · son push: `2026-09-07 15:13:09 +0000` (`git log -1`, commit `b2ed6435`) · lisans: MIT (kök `LICENSE:1` "Copyright (c) 2023-2026 ClickHouse, Inc." ve `LICENSE:5` "Content outside of the above mentioned directories ... is available under the 'MIT Expat' license"), fakat `ee/`, `web/src/ee/`, `worker/src/ee/` altındaki her şey ayrı bir lisansa tabi (`LICENSE:5` "is licensed under the license defined in 'ee/LICENSE'"). `package.json:3` `"version": "4.30.0"`, `package.json:5` `"license": "MIT"`. Dikkat: telif hakkı artık ClickHouse, Inc. adına — proje ClickHouse tarafından sahiplenilmiş görünüyor.
dil: TypeScript (worker + shared paketleri; incelenen kapsamın tamamı `.ts`).
canlılık: geçti — son commit 2026-09-07, prisma migration geçmişi 2026-09'a kadar aktif (`packages/shared/prisma/migrations/20260901103400_add_evaluator_prompt_messages`).

## Çözdüğü problem
Langfuse, LLM tabanlı uygulamalardan (agent/RAG/chatbot) gelen trace/observation olaylarını toplayan, ClickHouse'ta ölçekli şekilde saklayan, token kullanımından USD maliyeti hesaplayan ve insan/otomatik (LLM-as-judge) skorlarla değerlendiren bir açık kaynak LLM gözlemlenebilirlik platformudur.

## Mimari
```
SDK/OTel Exporter
   │  (JSON ingestion API  veya  OTLP/HTTP)
   ▼
Web API (kapsam dışı) ──► S3/MinIO'ya ham olay dosyası yazılır
   │  (dosya referansı)                         [worker/src/queues/ingestionQueue.ts:73-199]
   ▼
Redis + BullMQ  (IngestionQueue / OtelIngestionQueue, + Secondary kuyruklar)
   │
   ▼
worker: ingestionQueueProcessorBuilder / otelIngestionQueue processor
   │  OTel ise: OtelIngestionProcessor ile Langfuse olay şemasına çevrilir
   │  [packages/shared/src/server/otel/OtelIngestionProcessor.ts]
   ▼
IngestionService.mergeAndWrite()  [worker/src/services/IngestionService/index.ts:224]
   │  - aynı id için gelen tüm create/update olaylarını zaman sıralı "fold" ile birleştirir (mergeRecords)
   │  - model eşleme (findModel) + fiyat tier eşleme (matchPricingTier) + maliyet hesap (calculateUsageCosts)
   ▼
ClickhouseWriter  [worker/src/services/ClickhouseWriter/index.ts]
   │  batch insert
   ▼
ClickHouse (traces / observations / scores tabloları)  ── Postgres (Model/Price/proje config)
```
Bileşenler: ingestion kuyrukları `worker/src/queues/ingestionQueue.ts`, `worker/src/queues/otelIngestionQueue.ts`; birleştirme/maliyet mantığı `worker/src/services/IngestionService/index.ts`; OTel çeviri `packages/shared/src/server/otel/OtelIngestionProcessor.ts` ve `ObservationTypeMapper.ts`; veri modeli `packages/shared/src/domain/traces.ts`, `observations.ts`, `scores.ts`; kalıcı depo şeması `packages/shared/prisma/schema.prisma` (Postgres) + `packages/shared/src/server/clickhouse/*` (ClickHouse yardımcıları).

## Klasör yapısı
```
packages/shared/src/
├── domain/            # Trace/Observation/Score zod şemaları (uygulama geneli tipler)
├── server/
│   ├── otel/          # OTel span -> Langfuse observation çevirici (OtelIngestionProcessor, ObservationTypeMapper)
│   ├── ingestion/      # model eşleme (modelMatch.ts / findModel)
│   ├── pricing-tiers/  # fiyat kademesi eşleştirme (matchPricingTier)
│   ├── clickhouse/     # CH client, schema yardımcıları, query tracking
│   └── repositories/   # CH sorgu katmanı (traces.ts, observations.ts, scores.ts, dataset-*.ts)
├── features/
│   ├── model-pricing/  # fiyat tier doğrulama (validation.ts)
│   └── evals/          # (kapsamda, ayrıntı incelenmedi)
└── prisma/             # Postgres şeması + ~250 migration (config/metadata; trace verisi burada değil)

worker/src/
├── services/
│   ├── IngestionService/  # merge + maliyet hesaplama çekirdeği (index.ts, 2104 satır)
│   ├── ClickhouseWriter/  # CH'ye batch yazım
│   └── dlq/               # ölü mektup kuyruğu yeniden deneme servisi
├── queues/                # BullMQ kuyruk tanımları (ingestion, otel, eval, webhook, vs.)
└── features/
    ├── tokenisation/      # tiktoken / @anthropic-ai/tokenizer ile token tahmini
    └── evaluation/         # evalService.ts: LLM-as-judge çalıştırma motoru
```

## Ajan tasarımı
Langfuse'ta "ajan" birinci sınıf bir varlık değil; bir `ObservationType` değeridir. `packages/shared/src/domain/observations.ts:5-16` şu enum'u tanımlıyor: `SPAN, EVENT, GENERATION, AGENT, TOOL, CHAIN, RETRIEVER, EVALUATOR, EMBEDDING, GUARDRAIL`. Nesting (iç içe geçme) `parentObservationId` alanıyla sağlanıyor (`packages/shared/src/domain/observations.ts:60` `parentObservationId: z.string().nullable()`), yani bir trace altında observation'lar ağaç yapısı kurar; `AGENT`/`TOOL`/`CHAIN` tipleri de bu ağacın düğümleri olarak modellenir. Makine-okur sözleşme zod şemaları: `ObservationSchema` (`observations.ts:47-93`) ve `TraceDomain` (`packages/shared/src/domain/traces.ts:11-30`). "Generation-like" (LLM çağrısı olabilecek) tipler ayrı bir yardımcı ile tanımlı: `isGenerationLike` (`observations.ts:140-155`) — GENERATION, AGENT, TOOL, CHAIN, RETRIEVER, EVALUATOR, EMBEDDING, GUARDRAIL'i kapsıyor.

## Orkestrasyon / iş akışı modeli
Kuyruk teknolojisi BullMQ + Redis: `worker/src/queues/ingestionQueue.ts:1` `import { Job, Processor } from "bullmq";`. İki ayrı giriş noktası var: klasik JSON ingestion (`ingestionQueue.ts`) ve OTLP/OTel ingestion (`otelIngestionQueue.ts:1-40`, `OtelIngestionProcessor` kullanır). Her ikisi de "Secondary" kuyruklara yönlendirme desteği taşıyor (`ingestionQueue.ts:18` `SecondaryIngestionQueue`, `otelIngestionQueue.ts:17` `SecondaryOtelIngestionQueue`) — büyük projeler S3 yavaşlaması (`hasS3SlowdownFlag`, `isS3SlowDownError`) durumunda ayrı bir kuyruğa kayabiliyor (`ingestionQueue.ts:73-125` civarı `markProjectS3Slowdown`). Olaylar önce S3/MinIO'ya ham JSON olarak yazılıyor, kuyruk job'ı sadece dosya referansı taşıyor (`ingestionQueue.ts:171-199` `s3Client.download(filePath)` / `listFiles`), böylece kuyruk mesajı küçük kalıyor ve büyük payload'lar S3'te tutuluyor.

## Durum ve bellek
- **ClickHouse**: trace/observation/score'ların tek doğruluk kaynağı. Kanıt: `packages/shared/prisma/migrations/20260723150000_drop_legacy_tracing_tables/migration.sql:1-8` — "The traces, observations and scores tables were superseded by their ClickHouse counterparts in v3" ve ardından `DROP TABLE IF EXISTS "traces"/"observations"/"scores"` Postgres'ten siliniyor. Yani v3'ten itibaren trace verisi Postgres'te değil.
- **Postgres**: proje/organizasyon config'i, `Model`/`Price`/`PricingTier` fiyat tabloları (`packages/shared/prisma/schema.prisma:784-825`), API anahtarları, dataset metadata.
- **Redis**: BullMQ kuyruk arka ucu + model-eşleme L1/L2 önbelleği (`packages/shared/src/server/ingestion/modelMatch.ts:29-40` `LocalCache` + Redis invalidation).
- **S3/MinIO**: ham ingestion olayları (`rawEventBucketPrefix`) ve medya blob'ları; docker-compose'da `minio` servisi (`docker-compose.yml:157-158` `image: cgr.dev/chainguard/minio`).
- Depo teknolojileri (docker-compose.yml): `clickhouse:25.12` (:136-137), `redis:7` (:178-179), `postgres:${POSTGRES_VERSION:-17}` (:195-196).

## Hata yönetimi
- **Merge/idempotency**: Aynı trace/observation id'sine ait birden çok create/update olayı zaman damgasına göre sıralanıp "son yazan kazanır" mantığıyla katlanıyor: `worker/src/services/IngestionService/index.ts:1217-1236` `mergeRecords` → `overwriteObject(result, record, immutableEntityKeys)`. Sıralama kuralı: `index.ts:1240-1260` `toTimeSortedEventList` — eşit zaman damgasında create update'den önce sıralanır, eşit "create"lerde ilk gelen kazanır (yorum: "the first-arriving one wins").
- **Kısmi/geç veri sağlayıcı**: Kullanıcı hiç usage/cost vermezse (`hasProvidedCostDetails` false), worker tiktoken/`@anthropic-ai/tokenizer` ile token sayısını tahmin ediyor (`worker/src/features/tokenisation/usage.ts:3` `@anthropic-ai/tokenizer`, `:48` `tokenizerId === "claude"`); kullanıcı cost verdiyse tokenizasyon atlanıyor (`IngestionService/index.ts:1449-1456` yorum: "leave usage_details blank instead of paying for tokenisation").
- **DLQ**: `worker/src/services/dlq/dlqRetryService.ts:8-40` `DlqRetryService.retryDeadLetterQueue()` — 10 dakikada bir çalışan cron, `queue.getFailed()` ile başarısız job'ları bulup `job.retry()` çağırıyor. Not: retry listesi sadece `ProjectDelete, TraceDelete, ScoreDelete, BatchActionQueue, DataRetentionProcessingQueue` kuyruklarını kapsıyor (`dlqRetryService.ts:9-14`) — ingestion kuyruğu bu otomatik DLQ yeniden denemesine dahil değil (BullMQ kendi `attempts`/backoff ayarına bağlı).
- **Son deneme kontrolü**: `worker/src/features/integrations/bullmqAttempts.ts:20-31` `isLastAttempt` — `job.opts.attempts` eksikse "fail closed" (son deneme değilmiş gibi davran) uyarısı loglanıyor.
- **S3 yavaşlama**: `ingestionQueue.ts` içinde `isS3SlowDownError`/`markProjectS3Slowdown` ile S3 gecikmesi tespit edilip proje ikincil kuyruğa yönlendiriliyor.

## Genişletilebilirlik
Yeni bir LLM sağlayıcısının token/maliyet alanlarını (örn. "cache" veya "reasoning" token'ı) doğru ayrıştırmak için en az şu dosyalara dokunmak gerekiyor:
1. `packages/shared/src/server/otel/OtelIngestionProcessor.ts` — sağlayıcıya özel `providerMetadata`/`gen_ai.usage.*` ayrıştırma bloğu eklemek (örnek: OpenAI için `openaiMetadata["cachedPromptTokens"]` ayrıştırması `OtelIngestionProcessor.ts:2872-2881`; Vercel AI SDK için `ai.usage.cachedInputTokens`/`ai.usage.reasoningTokens` ayrıştırması `:2850-2867`).
2. `packages/shared/src/server/otel/ObservationTypeMapper.ts` — sağlayıcı/çerçeveye özel span-kind → ObservationType eşlemesi eklemek gerekirse (öncelik sıralı `SimpleAttributeMapper` zinciri, `:236-253`).
3. Fiyatlandırma için yeni `Model`/`Price` satırı eklemek (`packages/shared/prisma/schema.prisma:784-825`) — kod değişikliği değil ama veri girişi gerektiriyor.
Yeni bir skor türü eklemek görece ucuz: `ScoreSourceArray`/`ScoreConfigDataType` enum'larını genişletmek yeterli (`packages/shared/src/domain/scores.ts:4-10`, `schema.prisma:476-481`).

## Maliyet ve gecikme sayaçları
- **Token → USD**: `worker/src/services/IngestionService/index.ts` içindeki `getGenerationUsage` (`:1308-1420`) akışı: `findModel` (`packages/shared/src/server/ingestion/modelMatch.ts:43`) ile proje+model adına göre fiyat kaydı bulunur, `matchPricingTier` (`packages/shared/src/server/pricing-tiers/matcher.ts:116`) ile kademe (tier) seçilir, `calculateUsageCosts` (`IngestionService/index.ts:1660-1690`) ile `Decimal` (decimal.js) kullanılarak maliyet hesaplanır.
- **Sağlayıcı maliyet verirse önceliği o alır**: `calculateUsageCosts` `:1671-1690` — "If user has provided any cost point, do not calculate any other cost points" — sağlayıcı `provided_cost_details` gönderdiyse Langfuse kendi hesaplamasını yapmaz, sağlanan değeri aynen kullanır (yalnızca `total` eksikse `input+output` toplar).
- **Fiyat tablosu**: Postgres'te `Model` (`schema.prisma:784-807`, alanlar: `matchPattern`, `inputPrice`, `outputPrice`, `totalPrice`, `unit`, `tokenizerId`) ve `Price`/`PricingTier` tabloları (`schema.prisma:809-839`) — proje bazlı veya global (`projectId` nullable) olabiliyor, kademeli fiyatlandırma (`PricingTier.conditions Json`) destekleniyor.
- **Sağlayıcı token vermezse**: `IngestionService/index.ts:1449-1460` — sadece kullanıcı hem usage hem cost vermediyse ve observation ERROR değilse, worker kendi tokenizer'ı ile tahmini token sayısı üretir (`worker/src/features/tokenisation/usage.ts` — OpenAI için tiktoken, Claude için `@anthropic-ai/tokenizer`).
- **TTFT**: Veri modelinde birinci sınıf alan var: `packages/shared/src/domain/observations.ts:76` `completionStartTime`, `:81` `timeToFirstToken: z.number().nullable()`. Worker ingestion'da `completion_start_time` doğrudan olay gövdesinden aktarılıyor (`IngestionService/index.ts:402-403`); `timeToFirstToken`'ın nasıl hesaplandığı (start_time farkı) doğrulanmadı — sadece alan varlığı ve aktarımı doğrulandı, hesaplama formülü kapsam içi dosyalarda bulunamadı.

## Güçlü yönler (kanıtlı)
- Ölçek için doğru depo ayrımı: yüksek hacimli/append-only trace verisi ClickHouse'a taşınmış, ilişkisel/az hacimli config verisi Postgres'te kalmış (`20260723150000_drop_legacy_tracing_tables/migration.sql`).
- Sağlayıcı maliyeti varsa ona güvenip gereksiz tokenizasyondan kaçınan maliyet-bilinçli tasarım (`IngestionService/index.ts:1449-1456`).
- Olay birleştirme (merge) mantığı açıkça belirtilmiş sıralama/tie-break kurallarıyla (yorumlarla belgelenmiş) idempotent şekilde tasarlanmış (`index.ts:1240-1260`).

## Zayıf yönler (kanıtlı)
- DLQ otomatik yeniden deneme listesi ingestion kuyruğunu kapsamıyor (`dlqRetryService.ts:9-14`) — ingestion tarafında kalıcı hata olursa otomatik kurtarma mekanizması bu serviste görünmüyor (doğrulanmadı: ayrı bir mekanizma olabilir, kapsam dışı kod).
- `bullmqAttempts.ts:23-27` job.opts.attempts eksikse "fail closed" davranıyor ama bu durumun ne sıklıkla oluştuğu/loglandığı dışında ek bir tedbir (alarm, sayaç) kapsanan dosyalarda görülmedi.
- TTFT hesaplama formülünün nerede yapıldığı (start_time - completion_start_time mi, yoksa ayrı bir alan mı) bulunamadı; sadece alanların taşındığı doğrulandı.

## Puan (1–5)
- **olgunluk: 4** — 250+ Postgres migration'ı, v3→v4 veri taşıma geçmişi, ClickHouse'a geçiş gibi üretimde geçirilmiş kanıtlı evrim var (`prisma/migrations/*`).
- **mimari netlik: 4** — S3 staging → Redis/BullMQ kuyruk → merge servisi → ClickHouse akışı net dosya sınırlarıyla ayrılmış, ama OTel çevirici tek dosyada 3864 satıra çıkmış (`OtelIngestionProcessor.ts`), bu da netliği bir miktar düşürüyor.
- **genişletilebilirlik: 3** — yeni sağlayıcı desteği için birden fazla dosyada özel-durum (if/else) eklemek gerekiyor, tek bir eklenti noktası yok (bkz. Genişletilebilirlik bölümü).
- **güvenilirlik ilkelleri: 4** — idempotent merge, sıralama kuralları, S3-yavaşlama yönlendirmesi, DLQ retry servisi somut kodla var; ama ingestion kuyruğu DLQ kapsamı dışında kalmış olması eksik.
- **gözlemlenebilirlik: 4** — kod içinde yoğun `recordIncrement`/`recordHistogram`/`instrumentAsync`/span attribute'ları var (örn. `ingestionQueue.ts` boyunca), kendi kendini izleyen bir sistem.
- **güvenlik duruşu: doğrulanmadı** — kapsam dışı (auth/rbac `web/` altında, incelenmedi).

## ADR-000 K4 kanıtı
Karışık sonuç — hem destekleyen hem sınırlayan kanıt var:
- **Destekleyen**: Çekirdek veri modeli sağlayıcıdan bağımsız, açık uçlu bir sözlük kullanıyor: `usageDetails: z.record(z.string(), z.number())` ve `costDetails: z.record(z.string(), z.number())` (`packages/shared/src/domain/observations.ts:83-85`). Sabit "openai_prompt_tokens" gibi kolonlar yok; her sağlayıcı kendi anahtar adlarıyla bu genel sözlüğe yazabiliyor.
- **Sızan sağlayıcı özellikleri**: Bu esnekliğe rağmen, ingestion/OTel çevirme katmanı sağlayıcıya özel dallanmalar içeriyor. Kanıt: `packages/shared/src/server/otel/OtelIngestionProcessor.ts:2846-2867` Vercel AI SDK'ye özel `ai.usage.cachedInputTokens`/`ai.usage.reasoningTokens` ayrıştırması; `:2870-2881` OpenAI'ye özel `providerMetadata.openai.cachedPromptTokens`/`reasoningTokens`/`acceptedPredictionTokens`/`rejectedPredictionTokens` ayrıştırması. Bunlar `usageDetails["input_cached_tokens"]`, `usageDetails["output_reasoning_tokens"]` gibi yarı-standart anahtörler olarak genel sözlüğe yazılıyor — yani format tek ama üretim kodu her sağlayıcı için ayrı `if` bloğu taşıyor.
- **Yorum**: Langfuse'un "tek ortak model + esnek sözlük alan" yaklaşımı bizim K4 hedefimize yakın bir desen: sağlayıcıya özel alanları sabit şema kolonları yapmak yerine sözlük anahtarı olarak normalize ediyorlar. Ancak bu normalizasyonu üreten kod, sağlayıcı sayısı arttıkça büyüyen bir if/else zinciri (`OtelIngestionProcessor.ts`, 3864 satır) — yani "tek Model Router sınırı" iddiası şema seviyesinde doğru, ama ETL/çeviri seviyesinde her sağlayıcı için özel kod hâlâ gerekiyor. Bizim Model Router'ımız bu çeviriyi sağlayıcı tarafında (router içinde) yaparsa, gözlemlenebilirlik katmanına sadece normalize edilmiş anahtarlar sızar — Langfuse'un ulaştığı noktanın biraz ötesi.

## Alınacak fikir
- **Açık uçlu `usageDetails`/`costDetails` sözlüğü** (`observations.ts:83-85`) — sabit şema kolonları yerine `Record<string,number>` kullanmak, yeni sağlayıcı/metrik eklemek için şema migration'ı gerektirmiyor; bizim trace şemamızda da token/maliyet alanlarını böyle esnek tutmalıyız.
- **"Sağlayıcı veri sağladıysa hesaplama yapma" ilkesi** (`IngestionService/index.ts:1671-1690`) — maliyet hesaplamasında sağlayıcının kendi verdiği rakamı otorite kabul edip yalnızca eksik kaldığında kendi hesabımızı devreye sokmak, çifte kaynak çelişkisini önlüyor.
- **Zaman damgalı fold + tie-break ile merge** (`index.ts:1217-1260`) — dağıtık/tekrar eden olayları idempotent birleştirmek için "son yazan kazanır + açık tie-break kuralı" deseni bizim ingestion katmanımıza doğrudan uyarlanabilir.

## Alınmayacak
- **Tek dosyada devasa OTel çevirici** (`OtelIngestionProcessor.ts`, 3864 satır) — sağlayıcı sayısı arttıkça bakımı zorlaşan bir "god file" deseni; bizim Model Router sınırımızda bu mantığı sağlayıcı adaptörlerine bölmek daha sürdürülebilir.
- **Postgres'te iki kademeli (Model + Price + PricingTier) fiyatlandırma şeması** (`schema.prisma:784-839`) — kendi ölçeğimizde muhtemelen gereksiz karmaşıklık; basit bir fiyat tablosu yeterli olabilir, koşullu kademe (`conditions Json`) ihtiyacımız yoksa eklenmemeli (YAGNI).

## Dürüstlük
- Araç çağrısı tavanına (30) ulaşıldığı için bazı alanlar sadece kısmen doğrulanabildi: `timeToFirstToken` hesap formülü, ClickHouse tablo DDL'lerinin tam sütun listesi, `evalService.ts`'in insan/otomatik skor ayrımı dışındaki tüm akışı (1804 satırın küçük bir kısmı okundu), `worker/src/queues/workerManager.ts` (paralellik/concurrency ayarları) hiç açılmadı.
- Yıldız sayısı, gerçek üretim SLA'ları, güvenlik duruşu (rbac/auth `web/` altında, kapsam dışı) doğrulanamadı — internet erişimi yok, sadece yerel klon.
- Kapsam dışına çıkılmadı; `web/`, `ee/`, `fern/` gibi hariç tutulan klasörlere girilmedi. `packages/shared/src/in-app-agent/` klasörünün var olduğu `ls` çıktısından görüldü ama kapsam dışı olduğu için (yalnızca `evals`/`model-pricing` alt klasörleri isteniyordu) içeriği okunmadı.
- `docker-compose.yml` içindeki servis listesi tam grep edilmedi (sadece image satırları); ortam değişkeni bağımlılıkları incelenmedi.
