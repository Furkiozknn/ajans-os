# Strands Agents SDK

## Kimlik

Doğrulanmış: strands-agents/sdk-python · 7.165 yıldız · 50 watcher · son push 2026-09-04 · Apache-2.0 · Python · arşivlenmemiş · canlılık: geçti. Tohum listesinde YOK — bu bir "listede olmayan aday".

Önemli düzeltme: depo GitHub'da `strands-agents/harness-sdk` adına taşınmış; `git clone` eski `sdk-python` adını otomatik yönlendiriyor (klon başarılı oldu, `git remote -v` hâlâ eski URL'yi gösteriyor çünkü redirect şeffaf). README'deki rozet linkleri de yeni adı doğruluyor (`github.com/strands-agents/harness-sdk/...`). Depo artık tek paket değil, bir **monorepo**: kökte `strands-py/` (PyPI paketi `strands-agents`, kaynak `strands-py/src/strands/`), `strands-ts/` (TypeScript portu), `strands-mcp/` ve `site/` (dokümantasyon) klasörleri var. Bu analiz `strands-py/src/strands/` altındaki Python SDK'sına odaklanır. Lisans: `strands-py/pyproject.toml:12-13` → `license = {text = "Apache-2.0"}`, dosyalar `LICENSE.APACHE` (kök) ve `strands-py/LICENSE`. Son commit: `e3f3ee4`, 2026-09-04 16:36:56 -0400 (git log doğrulandı). PyPI haftalık indirme: doğrulanmadı (ağ erişimi bu görevde kullanılmadı).

## Çözdüğü problem

Model-driven (model-güdümlü) ajan çatısı: LLM'in kendi başına hangi aracı ne zaman çağıracağına karar verdiği bir "ajan döngüsü" (event loop) sağlar; bunun üstüne çoklu-ajan orkestrasyonu (Graph, Swarm, agent-as-tool, A2A protokolü), 11 farklı model sağlayıcısına tek arayüzden erişim, oturum kalıcılığı, checkpoint/resume, insan-onay kapıları (HITL) ve OpenTelemetry tabanlı gözlemlenebilirlik ekler. Kapsam, klasik "basit ajan kütüphanesi" tanımının çok ötesine geçmiş: `sandbox/`, `injection/`, `interventions/`, `memory/`, `plugins/`, `steering/`, `background_tasks/` gibi kurumsal-seviye alt sistemler eklenmiş (repo adının `harness-sdk`'ya dönüşmesi bu genişlemeyi yansıtıyor).

## Mimari (bileşen + veri akışı; dosya yolu ver)

Çekirdek akış: `Agent.__call__` (`strands-py/src/strands/agent/agent.py:833`) → `invoke_async` (`agent.py:927`) → `stream_async` (`agent.py:1270`) → her turn için `event_loop_cycle` (`event_loop/event_loop.py:189`) çağrılır. `event_loop_cycle`:
1. Limit kontrolü — `_check_limits` (`event_loop/event_loop.py:69`)
2. Model çağrısı — `_handle_model_execution` (`event_loop/event_loop.py:455`), model akışını `event_loop/streaming.py` üzerinden tüketir
3. Araç çağrısı varsa `_handle_tool_execution` (`event_loop/event_loop.py:784`)
4. Çok turlu araç etkileşimleri için `recurse_event_loop` (`event_loop/event_loop.py:411`) ile döngü kendini yeniden çağırır
5. Sonuç 7'li tuple olarak yayınlanır: `(StopReason, Message, EventLoopMetrics, request_state, Interrupts, structured_output, Checkpoint)` (`event_loop.py:220-236` docstring'de tanımlı, `stop_reason == "checkpoint"` durumu dahil).

Model soyutlaması `models/model.py:181` — `Model(abc.ABC)` — soyut metodlar `stream` (250), `structured_output` (229), `count_tokens` (290), `estimate_utilization` (318). Bu arayüzü `models/` altında 11 somut sağlayıcı uygular: `anthropic.py`, `bedrock.py`, `gemini.py`, `litellm.py`, `llamaapi.py`, `llamacpp.py`, `mistral.py`, `ollama.py`, `openai.py`, `openai_responses.py`, `sagemaker.py`, `writer.py`. Bağımlılıklar opsiyonel extra olarak tanımlı (`strands-py/pyproject.toml:49-96`, örn. `anthropic = ["anthropic>=0.21.0,<1.0.0"]`).

## Klasör yapısı (2 seviye, yorumlu)

```
strands-py/src/strands/
├── agent/                  # Agent sınıfı, agent-as-tool, agent-delegation, A2A tekil ajan sarmalayıcı
│   ├── agent.py             # Ana Agent sınıfı (100K+ satır dosya)
│   ├── _agent_as_tool.py    # Bir Agent'ı başka bir Agent'a araç olarak sunma
│   └── a2a_agent.py         # A2A protokolüyle uzak ajanı yerel Agent gibi sarmalama
├── event_loop/              # Ajan döngüsü çekirdeği
│   ├── event_loop.py         # event_loop_cycle, recurse_event_loop
│   └── _retry.py             # ModelRetryStrategy (exponential backoff)
├── multiagent/               # Çoklu-ajan orkestrasyon desenleri
│   ├── base.py                # MultiAgentBase, NodeResult, MultiAgentResult, Status
│   ├── graph.py                # Graph/GraphBuilder — yönlendirilmiş graf orkestrasyonu
│   ├── swarm.py                # Swarm — handoff tabanlı eşler-arası devir
│   └── a2a/                    # Agent-to-Agent protokol sunucusu/executor/dönüştürücüler
├── models/                   # Model sağlayıcı soyutlaması + 11 somut sağlayıcı
│   └── routing/                # Model yönlendirme (ModelRouter)
├── session/                  # Oturum kalıcılığı
│   ├── session_manager.py      # Soyut SessionManager (HookProvider + ABC)
│   ├── session_repository.py   # Soyut CRUD deposu (Session/SessionAgent/SessionMessage)
│   ├── file_session_manager.py, s3_session_manager.py, repository_session_manager.py, snapshot_session_manager.py
├── hooks/                    # Yaşam döngüsü olay/kanca sistemi
│   ├── events.py                # 15 hook olayı (Before/AfterModelCall, Before/AfterToolCall, Node/MultiAgent olayları vb.)
│   └── registry.py              # HookRegistry — callback kayıt/çağırma
├── telemetry/                 # OpenTelemetry entegrasyonu
│   ├── tracer.py                 # Tracer sınıfı, OTEL_EXPORTER_OTLP_ENDPOINT desteği
│   └── metrics.py                 # EventLoopMetrics
├── tools/                     # Araç sistemi
│   ├── decorator.py               # @tool dekoratörü, FunctionToolMetadata (şema çıkarımı)
│   ├── registry.py                 # ToolRegistry — keşif, doğrulama, dinamik kayıt
│   └── mcp/, executors/, structured_output/
├── experimental/checkpoint/    # Checkpoint/resume (deneysel klasörde)
├── vended_interventions/hitl/  # İnsan-onay kapısı (HumanInTheLoop)
├── memory/, storage/, sandbox/, injection/, interventions/, plugins/, background_tasks/  # Genişletilmiş kurumsal alt sistemler
└── types/                      # TypedDict/dataclass sözleşmeleri (ToolSpec, exceptions, Messages)
```

## Ajan tasarımı

`Agent.__init__` (`agent.py:213-240`) çok geniş bir kompozisyon yüzeyi sunar: `model`, `tools`, `system_prompt`, `conversation_manager`, `plugins`, `hooks`, `interventions`, `session_manager`, `memory_manager`, `tool_executor`, `retry_strategy` (varsayılan `ModelRetryStrategy`), `concurrent_invocation_mode`, `checkpointing: bool`. Tek bir "ajan" nesnesi; multi-agent düzeyi ayrı sınıflarla (`Graph`, `Swarm`) sağlanıyor, `MultiAgentBase(ABC)` (`multiagent/base.py:217`) ortak temel. Ajan-araç-olarak-ajan deseni `_AgentAsTool(AgentTool)` (`agent/_agent_as_tool.py:33`) ile native destekleniyor — bir `Agent` doğrudan başka bir `Agent`'ın araç listesine eklenebiliyor.

## Orkestrasyon / iş akışı modeli

İki resmi çoklu-ajan deseni var, ikisi de `MultiAgentBase` (`multiagent/base.py:217`, soyut `invoke_async` satır 271, `stream_async` satır 284) türetiyor:

- **Graph** (`multiagent/graph.py:502`, `GraphBuilder` satır 309): Yönlendirilmiş graf, düğümler arası kenarlar koşullu olabilir (`GraphEdge` satır 195). Koşullar hem eski stil `Callable[[GraphState], bool]` hem yeni stil `EdgeConditionWithContext` (invocation_state alan) destekliyor — `_is_context_condition` (satır 97) imza incelemesiyle (`inspect.signature`) ayrım yapıyor.
- **Swarm** (`multiagent/swarm.py:266`): Ajanlar arası "handoff" (devir) modeli. `SwarmState.handoff_node`/`handoff_message` (satır 193-194) bir sonraki çalışacak ajanı taşıyor. Güvenlik sınırları kodda somut: maksimum handoff sayısı (satır 210, `len(self.node_history) >= max_handoffs`) ve tekrarlayan-handoff tespiti (satır 222-231, bir pencere içindeki benzersiz ajan sayısı eşik altına düşerse durduruyor) — sonsuz devir döngüsüne karşı yerleşik koruma.
- **A2A (Agent-to-Agent protokolü)**: hem sunucu tarafı (`multiagent/a2a/server.py`, `executor.py`, `_converters.py`) hem istemci tarafı (`agent/a2a_agent.py:44`, `A2AAgent(AgentBase)` — uzak bir A2A ajanını yerel `Agent` arayüzü gibi sarmalıyor) var.

## Durum ve bellek

Oturum kalıcılığı iki katmanlı: soyut `SessionManager(HookProvider, ABC)` (`session/session_manager.py:31`) — zorunlu metodlar `redact_latest_message`, `append_message`, `sync_agent`, `initialize` (satır 68/78/88/97) — ve tek/çoklu-ajan/bidi (iki yönlü sesli) senaryoları için ek hook'lar (satır 105-162). Depolama tarafı ayrı soyutlanmış: `SessionRepository(ABC)` (`session/session_repository.py:12`) CRUD metodları tanımlıyor (`create_session`, `read_session`, `create_agent`, `read_agent`, `update_agent`, `create_message`, `read_message`, `update_message`, `list_messages`). Somut implementasyonlar: `file_session_manager.py`, `s3_session_manager.py`, `repository_session_manager.py`, `snapshot_session_manager.py`. Ayrıca `experimental/checkpoint/checkpoint.py:46` — `Checkpoint` sınıfı — event loop'un `stop_reason == "checkpoint"` durumuyla entegre resume mekanizması sağlıyor, ancak `experimental/` klasöründe olduğu için stabil API garantisi yok.

## Hata yönetimi

`types/exceptions.py` 15 özel istisna tanımlıyor: `EventLoopException`, `MaxTokensReachedException`, `ContextWindowOverflowException`, `MCPClientInitializationError`, `ModelThrottledException`, `SessionException`, `SnapshotException`, `ProviderTokenCountError`, `ToolProviderException`, `StructuredOutputException`, `ConcurrencyException`, `IdempotencyAbortedError`, `CheckpointException`, `StorageError`, `AggregateMemoryError` (satır 6-155). Retry, hook tabanlı ayrı bir modülde: `ModelRetryStrategy(HookProvider)` (`event_loop/_retry.py:21`) `AfterModelCallEvent`'e abone olup üstel geri çekilme uyguluyor — varsayılanlar `max_attempts=6, initial_delay=4, max_delay=240` (docstring satır 27-30: 4s→8s→16s→32s→64s), `is_retryable` sadece `ModelThrottledException`'ı yakalıyor (satır 63-70) ama alt sınıflarla genişletilebilir olarak tasarlanmış.

## Genişletilebilirlik

Hook sistemi (`hooks/registry.py:177` `HookRegistry`, `add_hook` satır 287, `invoke_callbacks` satır 355) 15 yaşam döngüsü olayına (`hooks/events.py`) dışarıdan callback bağlamaya izin veriyor: `AgentInitializedEvent`, `BeforeInvocationEvent`/`AfterInvocationEvent`, `MessageAddedEvent`, `Before/AfterToolsEvent`, `Before/AfterToolCallEvent`, `Before/AfterModelCallEvent`, `MultiAgentInitializedEvent`, `Before/AfterNodeCallEvent`, `Before/AfterMultiAgentInvocationEvent` (satır 27-480). Araç tanımı `@tool` dekoratörüyle (`tools/decorator.py:744`, `FunctionToolMetadata` satır 80 fonksiyon imzasından JSON şeması çıkarıyor, `DecoratedFunctionTool` satır 454) tek satırla yapılabiliyor; `ToolRegistry` (`tools/registry.py:30`) dizin taraması, dinamik kayıt (`register_dynamic_tool` satır 561) ve şema doğrulaması (`validate_tool_spec` satır 576) sağlıyor. Ayrıca `Plugin`, `InterventionHandler`, `MemoryManager` gibi ek genişletme noktaları var (`vended_interventions/hitl/hitl.py:87` — `HumanInTheLoop(InterventionHandler)` — insan onayı gerektiren araç çağrılarını yakalayan somut örnek; risk sınıflandırması için LLM tabanlı `_create_llm_risk_classifier`, `vended_interventions/hitl/classifier.py:95`).

## Güçlü yönler (kanıtlı)

- Model sağlayıcı soyutlaması gerçekten sağlayıcıdan bağımsız: tek `Model(abc.ABC)` arayüzü (`models/model.py:181`), 11 somut implementasyon, hepsi opsiyonel extra olarak paketlenmiş (`pyproject.toml:49-96`) — kullanıcı sadece ihtiyacı olanı kurar.
- Swarm deseninde sonsuz döngüye karşı somut, kod-seviyesinde kanıtlanmış koruma var: hem sert handoff tavanı hem istatistiksel tekrar tespiti (`multiagent/swarm.py:210-231`).
- Hook sistemi çok granüler (araç-öncesi/sonrası, model-öncesi/sonrası, node-öncesi/sonrası, multi-agent-öncesi/sonrası ayrı ayrı) — retry stratejisi bile bu genel hook mekanizması üzerine kurulu (`_retry.py:21` bir `HookProvider`), yani çekirdek davranış bile uzantı noktasından geçiyor.
- Graf koşulları hem eski hem yeni imzayı `inspect.signature` ile geriye-uyumlu şekilde destekliyor (`graph.py:97-109`) — API evrimi özenli yönetilmiş.

## Zayıf yönler (kanıtlı)

- Proje sınırları belirsizleşmiş: `agent.py` tek dosyada 100.169 bayt (~satır sayısı çok yüksek), tek sınıfın (`Agent`) sorumluluk alanı checkpoint, concurrency, memory, tool execution, session hepsini kapsıyor — `__init__` imzası tek başına 27 parametre (`agent.py:213-240`).
- Checkpoint/resume mekanizması `experimental/` klasöründe (`experimental/checkpoint/checkpoint.py:46`) — event loop'un çekirdek stop-reason sözleşmesine gömülü olmasına rağmen (7'li tuple'da 7. eleman) resmi/stabil API değil; kararsız bir özelliğe çekirdek akış bağımlı.
- Depo aslında artık "SDK" değil bir monorepo (`strands-py/`, `strands-ts/`, `strands-mcp/`, `site/`) ve adı `harness-sdk`'ya taşınmış olmasına rağmen PyPI paket adı hâlâ `strands-agents` (`strands-py/pyproject.toml:7`) — isimlendirme/kapsam tutarsızlığı, yeni gelen için kafa karıştırıcı.
- Kapsam çok genişlemiş (`sandbox/`, `injection/`, `steering/`, `plugins/`, `vended_plugins/`, `vended_memory_stores/` gibi 2026 itibarıyla eklenmiş çok sayıda alt sistem) — "birkaç satırda ajan" vaadiyle (README) gerçek kod tabanının karmaşıklığı arasında büyüyen bir makas var.

## Puan (1-5)

olgunluk: 4 — Apache-2.0, aktif geliştirme (2026-09-04 son push), 11 model sağlayıcısı üretim kalitesinde ayrı dosyalar halinde uygulanmış.
mimari netlik: 3 — çekirdek event loop / model / tool ayrımı temiz, ama `agent.py` tek dosyada aşırı büyümüş ve deneysel/vended klasörler sınırları bulanıklaştırıyor.
genişletilebilirlik: 5 — hook sistemi, plugin sistemi, intervention handler'lar ve @tool dekoratörü birlikte çok sayıda net uzantı noktası sağlıyor (`hooks/registry.py`, `tools/decorator.py`).
güvenilirlik ilkelleri: 4 — retry (exponential backoff, hook tabanlı), swarm handoff limitleri, context-window/max-tokens özel istisnaları kod seviyesinde somut (`_retry.py:21`, `swarm.py:210-231`, `types/exceptions.py`).
gözlemlenebilirlik: 4 — OpenTelemetry doğrudan entegre (`telemetry/tracer.py:84`, OTLP endpoint env değişkeni desteği satır 206), `EventLoopMetrics` ayrı modülde.
güvenlik duruşu: 3 — insan-onay kapısı (`HumanInTheLoop`) ve LLM tabanlı risk sınıflandırıcı var (kanıtlı: `vended_interventions/hitl/hitl.py:87`, `classifier.py:95`) ama "vended_" öneki bunun opsiyonel/örnek nitelikli olduğunu, çekirdek zorunluluk olmadığını gösteriyor.

## Alınacak fikir

1. Retry mantığını genel hook sistemi üzerine kurma deseni (`ModelRetryStrategy(HookProvider)`, `_retry.py:21`) — ajans-os'ta da retry/circuit-breaker'ı özel bir mekanizma değil, genel olay/hook sözleşmesinin bir tüketicisi olarak tasarlamak, hem test edilebilirlik hem kullanıcı override'ı için iyi bir örnek.
2. Swarm'daki somut sonsuz-döngü koruması (sert handoff tavanı + tekrarlayan-devir istatistiksel tespiti, `swarm.py:210-231`) — çok-ajanlı devir/handoff deseni ajans-os'a girecekse bu iki kontrolü (sabit limit + pencere içi çeşitlilik eşiği) doğrudan örnek alınabilir.

## Alınmayacak

`Agent` sınıfının 27 parametreli, 100K+ baytlık tek-dosya tasarımı (`agent/agent.py:213-240`) — checkpoint, concurrency, memory, session, tool execution, plugin, intervention hepsinin tek nesnede toplanması kompozisyon yerine "tanrı nesnesi" riskini gösteriyor; ajans-os'ta ajan çekirdeği ile bu yan-sistemler arasında daha net dosya/sorumluluk sınırı çizilmeli.

## Matris cevapları

saglayici_bagimsiz: evet — `Model(abc.ABC)` soyut arayüzü (`models/model.py:181`) ve 11 bağımsız sağlayıcı implementasyonu (`models/anthropic.py`, `bedrock.py`, `litellm.py`, `ollama.py`, `openai.py`, vb.), hepsi opsiyonel extra (`pyproject.toml:49-96`).
sozlesme_var: kismen — araç tarafında JSON-şema tabanlı katı bir sözleşme var (`types/tools.py:30` `ToolSpec`, `tools/registry.py:576` `validate_tool_spec`), ama ajanlar arası (multi-agent) resmi bir "sözleşme" dosyası/spesifikasyonu yok, sadece kod-seviyesi sınıf arayüzleri (`MultiAgentBase`).
insan_kapisi: evet — `HumanInTheLoop(InterventionHandler)` somut sınıfı, LLM tabanlı risk sınıflandırıcı ile birlikte var (`vended_interventions/hitl/hitl.py:87`, `classifier.py:46-95`).
checkpoint: kismen — `Checkpoint` sınıfı ve event loop'ta `stop_reason == "checkpoint"` desteği mevcut, ama `experimental/checkpoint/checkpoint.py:46` altında, yani deneysel/kararsız API statüsünde.
