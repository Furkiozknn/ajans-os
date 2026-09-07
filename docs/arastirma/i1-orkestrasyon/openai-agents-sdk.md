# OpenAI Agents SDK (Python)

## Kimlik

Doğrulanmış: `openai/openai-agents-python` · 29.230 yıldız · 234 watcher · son push 2026-09-05 · MIT lisans (`LICENSE:1-3`, Copyright OpenAI 2025) · Python · arşivlenmemiş · canlılık: geçti (son commit tarihi güncel, aktif geliştirme — `src/agents/run_internal/` gibi yeni bir iç modülün varlığı yakın zamanda büyük bir refactor geçirdiğini gösteriyor).

PyPI haftalık indirme sayısı: doğrulanmadı (bu oturumda PyPI API'sine erişim yapılmadı, sadece repo klonlandı).

## Çözdüğü problem

README'nin kendi tanımı: "hafif ama güçlü, çok-ajanlı iş akışları kurmak için sağlayıcıdan bağımsız bir çerçeve; OpenAI Responses ve Chat Completions API'lerini ve 100+ başka LLM'i destekler" (`README.md:3`). Kapsadığı çekirdek kavramlar: ajanlar (talimat + araç + guardrail + handoff ile yapılandırılmış LLM'ler), sandbox ajanlar, realtime/voice ajanlar, "agents as tools" / handoff ile devir, guardrail'ler, human-in-the-loop, oturum (session) tabanlı bellek (`README.md:9-18`).

## Mimari (bileşen + veri akışı, dosya yolu ver)

Paket kökü `src/agents/` (`ls` çıktısı). Temel bileşenler:

- **Agent tanımı**: `src/agents/agent.py` — `AgentBase` (agent.py:183) ve ondan türeyen `Agent` dataclass (agent.py:296).
- **Çalıştırma motoru**: `src/agents/run.py` (2595 satır) — dışa açık `Runner` sınıfı (run.py:255) ve `run`/`run_sync`/`run_streamed` metodları. Gerçek döngü mantığı ise ayrı bir iç pakete taşınmış: `src/agents/run_internal/run_loop.py`, `run_steps.py`, `turn_preparation.py`, `turn_resolution.py`, `tool_execution.py`, `tool_planning.py`, `guardrails.py`, `approvals.py`, `session_persistence.py` — yani `run.py` bir cephe (facade), asıl akış `run_internal/` altında modülerleştirilmiş.
- **Devir (handoff)**: `src/agents/handoffs/__init__.py` (388 satır) + `src/agents/handoffs/history.py` (664 satır, girdi filtreleme geçmişi için).
- **Guardrail**: `src/agents/guardrail.py` (343 satır) — input/output guardrail tanımları; `src/agents/tool_guardrails.py` — araç seviyesinde guardrail.
- **Bellek/Session**: `src/agents/memory/` — `session.py` (protokol), `sqlite_session.py` (490 satır, yerleşik SQLite implementasyonu), `openai_conversations_session.py`, `openai_responses_compaction_session.py`.
- **Model soyutlaması**: `src/agents/models/interface.py` — soyut `Model`/`ModelProvider` sınıfları (interface.py:37, 138); `src/agents/models/multi_provider.py` — prefix tabanlı yönlendirme; `src/agents/models/openai_provider.py`, `openai_responses.py`, `openai_chatcompletions.py` — OpenAI implementasyonları.
- **Genişletme (3. parti sağlayıcı) katmanı**: `src/agents/extensions/models/` — `litellm_model.py`, `litellm_provider.py`, `any_llm_model.py`, `any_llm_provider.py`.
- **Tracing**: `src/agents/tracing/` — `setup.py` (global provider), `processors.py` (varsayılan exporter), `provider.py`, `spans.py`, `traces.py`.
- **Hata/Retry**: `src/agents/exceptions.py` (572 satır), `src/agents/retry.py` (464 satır).
- **Durum serileştirme (checkpoint)**: `src/agents/run_state.py` — `RunState` sınıfı (run_state.py:764) ve `to_json`/`from_json`/`to_string`/`from_string` metodları (run_state.py:1776, 2124, 2182, 2256).

Veri akışı: `Runner.run(starting_agent, input, ...)` (run.py:257) → iç döngü `while True` (run.py:967) her turda modeli çağırır, tool/handoff/guardrail sonucunu değerlendirir → `NextStepHandoff` gelirse `current_agent = turn_result.next_step.new_agent` (run.py:1409-1411) ile ajan değişir ve döngü devam eder → `current_turn > max_turns` olursa `MaxTurnsExceeded` fırlatılır (run.py:1483-1491) → sonuç `RunResult`/`RunResultStreaming` olarak döner; session verilmişse geçmiş otomatik okunup yazılır (`run_internal/session_persistence.py`).

## Klasör yapısı (2 seviye, yorumlu)

```
src/agents/
├── run.py                # Runner API yüzeyi (run/run_sync/run_streamed), ~2600 satır
├── run_internal/         # Asıl döngü: run_loop, turn_preparation/resolution, tool_execution,
│                         # tool_planning, guardrails, approvals, session_persistence, streaming
├── agent.py               # Agent / AgentBase dataclass'ları, agent-as-tool
├── handoffs/              # handoff() fabrika fonksiyonu, HandoffInputData, girdi filtreleri
├── guardrail.py           # InputGuardrail / OutputGuardrail / GuardrailFunctionOutput (tripwire)
├── tool_guardrails.py     # Araç çağrısı seviyesinde guardrail
├── memory/                # Session protokolü + SQLite/OpenAI-conversations implementasyonları
├── models/                # Model/ModelProvider soyutlaması + OpenAI implementasyonları + MultiProvider
├── extensions/models/     # litellm_model.py, litellm_provider.py, any_llm_model.py, any_llm_provider.py
├── tracing/               # TraceProvider, span/trace veri modeli, varsayılan OpenAI exporter
├── exceptions.py          # AgentsException hiyerarşisi (MaxTurnsExceeded, GuardrailTripwire, ...)
├── retry.py               # ModelRetryBackoffSettings, normalize edilmiş hata bilgisi
├── run_state.py           # RunState: JSON'a serileştirilebilir çalışma durumu (checkpoint/resume)
├── realtime/ , voice/     # Realtime ve sesli ajan pipeline'ları (bu incelemenin kapsamı dışında)
└── sandbox/ , mcp/        # Sandbox ajanlar ve MCP sunucu entegrasyonu
```

## Ajan tasarımı

`Agent`, `AgentBase`'den türeyen bir `@dataclass` (agent.py:296, temel sınıf agent.py:182-183). Alanlar: `name` (agent.py:186), `handoff_description` (agent.py:189), `tools` (agent.py:194), `mcp_servers`/`mcp_config` (agent.py:197, 208), `instructions` (agent.py:309), `prompt` (statik veya dinamik fonksiyon, agent.py:325), `handoffs: list[Agent | Handoff]` (agent.py:331), `model: str | Model | None` (agent.py:337), `model_settings` (agent.py:344), `input_guardrails`/`output_guardrails` (agent.py:350, 355), `output_type` (yapısal çıktı şeması, agent.py:360), `hooks` (agent.py:369), `tool_use_behavior` (agent.py:373), `reset_tool_choice` (agent.py:395). Ajanlar aynı zamanda `agent.as_tool(...)` ile başka bir ajanın aracı haline getirilebiliyor (agent.py:585-604, `needs_approval` parametresiyle insan onayına da bağlanabiliyor — human-in-the-loop agent-as-tool düzeyinde de mevcut).

## Orkestrasyon / iş akışı modeli

Merkezi model **tek döngülü Runner + handoff ile ajan değişimi**, çoklu-ajan grafiği değil. `Runner.run` (run.py:257) bir `starting_agent` ve `input` alır; `max_turns` parametresi `DEFAULT_MAX_TURNS = 10` olarak tanımlı (`src/agents/run_config.py:45`). Döngü `while True` (run.py:967) her turda: model çağrısı → araç/handoff/guardrail sonucu değerlendirme. Handoff bir "araç gibi" sunuluyor: `handoff()` fabrika fonksiyonu (`handoffs/__init__.py:222-338`) `on_handoff` callback'i, `input_filter` (geçmişi filtreleme, `handoffs/__init__.py:158, 227`) ve hedef ajanı taşıyan bir `Handoff` nesnesi üretiyor. Runner bunu algılayınca `NextStepHandoff` next-step tipiyle işaretliyor ve `current_agent`'ı `turn_result.next_step.new_agent`'a çeviriyor (run.py:1409-1414, akışın streaming varyantı run.py:2105-2108'de aynı desende tekrarlanıyor). `max_turns` aşılırsa `MaxTurnsExceeded` istisnası fırlatılıyor, ancak bir "max turns handler" ile bu durum yakalanıp özel bir çıktı senteslenebiliyor (run.py:1483-1571, `finalize_max_turns_handler_output`). Ayrıca ajan-içi araç olarak başka bir ajanı çağırmak (`agent.as_tool`, agent.py:585) alternatif bir "alt-görev" orkestrasyon deseni sunuyor.

## Durum ve bellek

`Session` bir `Protocol` (memory/session.py:15) — zorunlu metodlar `get_items`, `add_items`, `pop_item`, `clear_session` (memory/session.py:26-53). Yerleşik implementasyon `SQLiteSession` (`memory/sqlite_session.py`, 490 satır, thread-safe, `asyncio` + `threading.Lock` kullanıyor). Ayrıca OpenAI'a özel `openai_conversations_session.py` (OpenAI'ın sunucu taraflı "conversations" API'siyle senkron oturum) ve `openai_responses_compaction_session.py` (Responses API context sıkıştırma) var — bunlar OpenAI'a özgü, diğer sağlayıcılarla kullanılamaz.

Çalışma durumu (turn ilerlemesi, mevcut ajan, bekleyen araç onayları) ayrı bir mekanizma: `RunState` (run_state.py:764) tamamen JSON'a serileştirilebiliyor (`to_json`/`from_json`/`to_string`/`from_string`, run_state.py:1776/2124/2182/2256). Bu, bir çalıştırmanın ortasında durup (ör. insan onayı beklerken) durumu diske/DB'ye yazıp sonra `Runner.run(..., previous_response_id=...)` veya doğrudan `RunState`'i geri vererek devam ettirilebilmesini sağlıyor — yani **checkpoint/resume yerleşik bir birinci sınıf özellik**.

## Hata yönetimi

`src/agents/exceptions.py` bir `AgentsException` (exceptions.py:434) kök sınıfı etrafında hiyerarşi kuruyor: `MaxTurnsExceeded` (444), `ModelBehaviorError` (454, modelin beklenmeyen/şemaya uymayan çıktı üretmesi), `ModelRefusalError` (466), `ModelTimeoutError` (477), `UserError` (487, geliştirici hatası — ör. `handoff()`'a yanlış imzalı `on_handoff` verilmesi, `handoffs/__init__.py:294-311`), `MCPToolCancellationError` (497), `ToolTimeoutError` (507), `InputGuardrailTripwireTriggered` (519), `OutputGuardrailTripwireTriggered` (532), `ToolInputGuardrailTripwireTriggered` (545), `ToolOutputGuardrailTripwireTriggered` (560). Guardrail mekanizması: `GuardrailFunctionOutput.tripwire_triggered: bool` alanı (guardrail.py:20-31) true olursa çalıştırma anında durduruluyor ve ilgili `*TripwireTriggered` istisnası fırlatılıyor — hem girdi/çıktı seviyesinde (`guardrail.py`) hem de tekil araç çağrısı seviyesinde (`tool_guardrails.py`).

Retry: `src/agents/retry.py` model çağrıları için yapılandırılabilir `ModelRetryBackoffSettings` (initial_delay, max_delay, multiplier, jitter — retry.py:17-30) ve normalize edilmiş hata bilgisi (`ModelRetryNormalizedError`: status_code, error_code, retry_after, is_abort, is_network_error, is_timeout — retry.py:48-59) sunuyor; bu, sağlayıcıdan gelen ham hatayı ortak bir modele indirgeyip retry kararını sağlayıcıdan bağımsız veriyor.

## Genişletilebilirlik

Model katmanı açıkça eklenti noktası olarak tasarlanmış: `Model`/`ModelProvider` soyut sınıfları (models/interface.py:37, 138) her sağlayıcının uyması gereken sözleşmeyi tanımlıyor. `MultiProvider` (models/multi_provider.py:62) model adı ön ekine göre yönlendirme yapıyor — dokümante edilen varsayılan eşleme: `"openai/"` veya öneksiz → `OpenAIProvider`, `"litellm/"` → `LitellmProvider`, `"any-llm/"` → `AnyLLMProvider` (multi_provider.py:64-68 docstring). LiteLLM desteği `pyproject.toml`'da opsiyonel bağımlılık olarak tanımlı (`litellm = ["litellm>=1.83.0"]`) ve `src/agents/extensions/models/litellm_model.py` + `litellm_provider.py` dosyalarında somutlaşıyor — yani 100+ modele (Anthropic, Gemini, açık kaynak, vb.) LiteLLM üzerinden erişim çekirdek pakete sıkı bağlı değil, ayrı bir extras grubu. Ayrıca `any_llm_provider.py` ile ikinci, daha genel bir "any OpenAI-uyumlu uç nokta" yolu da var.

## Güçlü yönler (kanıtlı)

- Model sağlayıcı gerçekten soyutlanmış ve prefix ile takılabilir (multi_provider.py:62-79), bu iddia hem `Model`/`ModelProvider` ABC'leriyle (interface.py:37,138) hem de gerçek üçüncü parti implementasyonlarla (`extensions/models/litellm_*.py`) kod seviyesinde doğrulanıyor.
- Çalışma durumu tam JSON serileştirilebilir (`run_state.py:1776-2256`), bu da insan-onaylı (human-in-the-loop) uzun süren iş akışlarını ve süreç yeniden başlatmalarını kod düzeyinde destekliyor.
- Hata hiyerarşisi ayrıntılı ve amaca yönelik ayrılmış — guardrail tripwire'ları ayrı istisna sınıflarına sahip (exceptions.py:519-570), bu da çağıran kodun "guardrail mi patladı yoksa model mi hata verdi" ayrımını programatik olarak yapmasını sağlıyor.
- Runner'ın iç mantığı `run_internal/` altında ~15 küçük modüle bölünmüş (turn_preparation, tool_execution, guardrails, approvals, session_persistence vb.) — `run.py`'nin kendisi sadece dış API yüzeyi, bu da bakım kolaylığı için iyi bir ayrım.

## Zayıf yönler (kanıtlı)

- Varsayılan tracing backend'i doğrudan OpenAI'a gidiyor: `BackendSpanExporter._OPENAI_TRACING_INGEST_ENDPOINT = "https://api.openai.com/v1/traces/ingest"` (tracing/processors.py:45) ve `get_trace_provider()` ilk erişimde `default_processor()`'ı otomatik kaydediyor (tracing/setup.py:52-56) — yani hiçbir ek yapılandırma yapılmazsa iz verileri OpenAI'a gönderilmeye çalışılıyor (`tracing_disabled: bool = False` varsayılanı, run_config.py:397). Devre dışı bırakmak veya değiştirmek mümkün ama varsayılan davranış tek-sağlayıcı yönelimli.
- `Runner.run` çekirdek dosyası (`run.py`) 2595 satır ve içinde `run`, `run_sync`, `run_streamed`, resume varyantları gibi çok sayıda benzer kod yolu tekrarlanıyor (ör. `max_turns` kontrolü ve handoff işleme mantığı hem run.py:1409-1414 hem run.py:2105-2108'de neredeyse birebir tekrar ediyor) — bu, akışı takip etmeyi ve bakımını zorlaştıran bir kod tekrarı.
- Bazı bellek implementasyonları OpenAI'a özel ve taşınabilir değil: `openai_conversations_session.py` ve `openai_responses_compaction_session.py` (memory/ klasörü) doğrudan OpenAI'ın sunucu taraflı conversation/response API'lerine bağımlı; LiteLLM/any-llm üzerinden başka bir sağlayıcı kullanan bir kurulum bu iki session implementasyonunu kullanamaz, sadece `SQLiteSession` veya kendi Session implementasyonuna düşer.

## Puan (1-5)

- olgunluk: 5 — 29k yıldız, aktif ve sık commit, iç mimarisi (`run_internal/`) yakın zamanda büyük bir refactor'dan geçmiş, resmi OpenAI deposu.
- mimari netlik: 4 — `run_internal/` altında sorumluluklar iyi ayrılmış (turn_preparation, tool_execution, guardrails vb.) ama `run.py`'nin kendisi hâlâ 2600 satırlık, tekrarlı bir cephe.
- genişletilebilirlik: 5 — `Model`/`ModelProvider` ABC'leri ve prefix tabanlı `MultiProvider` (multi_provider.py:62) ile hem LiteLLM hem any-llm hem özel sağlayıcı somut kodla kanıtlanmış şekilde takılabiliyor.
- güvenilirlik ilkelleri: 4 — `max_turns` sınırı (run_config.py:45), yapılandırılabilir retry/backoff (retry.py:17-59) ve tripwire tabanlı guardrail istisnaları (exceptions.py:519-570) somut ve ayrıntılı.
- gözlemlenebilirlik: 3 — tracing alt sistemi zengin (span/trace veri modeli) ama varsayılanı OpenAI'ın kendi ingest uç noktasına gönderiyor (tracing/processors.py:45); başka bir backend'e bağlamak ek yapılandırma/kod gerektiriyor.
- güvenlik duruşu: 4 — girdi/çıktı guardrail'leri hem ajan hem araç seviyesinde ayrı istisna sınıflarıyla net bir tripwire modeli sunuyor (guardrail.py:20-31, tool_guardrails.py) ve `needs_approval` ile agent-as-tool düzeyinde insan onayı destekleniyor (agent.py:600).

## Alınacak fikir

`Model`/`ModelProvider` soyutlaması + prefix tabanlı `MultiProviderMap` deseni (models/interface.py, models/multi_provider.py:19-79): ajans-os'ta sağlayıcı bağımsızlığı istiyorsak bu "prefix ile yönlendirilen provider map" yaklaşımı doğrudan örnek alınabilir — model adının önekine göre (`"openai/"`, `"litellm/"`, `"kendi-prefix/"`) farklı implementasyona yönlendirmek, tek bir `ModelProvider` arayüzü etrafında sağlayıcı eklemeyi/çıkarmayı kod değişikliği gerektirmeden mümkün kılıyor. Ayrıca `RunState.to_json`/`from_json` (run_state.py:1776-2256) ile tam checkpoint/resume deseni, uzun süren veya insan onayı bekleyen görevler için doğrudan uygulanabilir bir örnek.

## Alınmayacak

Varsayılan tracing'in doğrudan OpenAI'ın kendi ingest uç noktasına (`api.openai.com/v1/traces/ingest`) gönderilmesi (tracing/processors.py:45) — ajans-os sağlayıcıdan bağımsız kalmak istiyorsa, "iz toplama varsayılan olarak tek bir şirketin sunucusuna gider, kapatman/değiştirmen gerekir" modeli yerine varsayılanı yerel/nötr bir exporter (ör. dosyaya veya stdout'a yazan) olacak şekilde tasarlamak daha tutarlı olur.

## Matris cevapları

- saglayici_bagimsiz: kismen (çekirdek `Model`/`ModelProvider` soyutlaması ve `MultiProvider` prefix yönlendirmesi tam sağlayıcı-bağımsız — LiteLLM/any-llm somut kodla kanıtlı; ancak varsayılan tracing OpenAI'ın kendi ingest uç noktasına gidiyor ve iki Session implementasyonu (`openai_conversations_session.py`, `openai_responses_compaction_session.py`) doğrudan OpenAI'a özel API'lere bağımlı.)
- sozlesme_var: evet (`Model`/`ModelProvider` abstract base class'ları — models/interface.py:37,138 — ve `Session` Protocol/`SessionABC` — memory/session.py:15,58 — açık, kod düzeyinde uygulanan sözleşmeler.)
- insan_kapisi: evet (`agent.as_tool(..., needs_approval=...)` — agent.py:600 — ve `run_internal/approvals.py` ile araç çağrılarının onaya bağlanması yerleşik bir mekanizma.)
- checkpoint: evet (`RunState.to_json`/`to_string`/`from_json`/`from_string` — run_state.py:1776,2124,2182,2256 — çalışma durumunu tam JSON'a serileştirip devam ettirebiliyor.)
