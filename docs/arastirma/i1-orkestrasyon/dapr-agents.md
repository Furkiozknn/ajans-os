# Dapr Agents

## Kimlik

Doğrulanmış: dapr/dapr-agents · 744 yıldız · 25 watcher · son push 2026-08-30 · Apache-2.0 · Python · arşivlenmemiş · canlılık: geçti. Tohum listesinde YOK — "listede olmayan aday". Yıldız sayısı düşük ama bu, CNCF'in kendi Dapr projesinin resmi alt projesi (github.com/dapr organizasyonu altında, `dapr`, `dapr-ext-fastapi`, `dapr-ext-workflow` paketlerine doğrudan pin'li bağımlılık — `pyproject.toml:30-32`). Yıldız kanıt değil: paket `pyproject.toml:44` içinde `"Development Status :: 2 - Pre-Alpha"` olarak sınıflandırılmış, yani proje kendini olgun ilan etmiyor. Buna karşılık kod tabanı büyük ve aktif (workflow runner tek başına 1654+659 satır, agents/durable.py 4353 satır) — commit yoğunluğu, yıldız sayısından daha güvenilir bir sinyal.

## Çözdüğü problem

Çoklu-ajan LLM orkestrasyonunu, kendi event-loop'unu yönetmek yerine Dapr'ın Durable Task tabanlı Workflow motoruna devrederek "dayanıklı" (durable) hale getirmek: süreç çökse/yeniden başlasa bile iş akışı kaldığı yerden — LLM çağrıları ve araç sonuçları tekrar çalıştırılmadan — devam eder. Ayrıca ajanlar arası iletişimi merkezî bir orkestratör süreci yerine Dapr pub/sub (Redis/Kafka/vb.) üzerinden dağıtık servisler olarak modelliyor (`examples/04-multi-agent-workflows/services/*`).

## Mimari (bileşen + veri akışı; dosya yolu ver)

Üç katman:

1. **WorkflowRunner** (`dapr_agents/workflow/runners/base.py:49`) — `DaprWorkflowClient` etrafında ince bir sarmalayıcı. `run_workflow` (satır 381) workflow'u zamanlar; geçici gRPC hatalarında (`CANCELLED`/`UNAVAILABLE`) üstel geri çekilmeli 3 deneme yapar (satır 410 `_max_retries = 3`). `run_workflow_async`, `wait_for_workflow_completion`, `terminate_workflow` de burada.
2. **AgentRunner** (`dapr_agents/workflow/runners/agent.py:134`) — `WorkflowRunner`'ı genişletip FastAPI/pub-sub route'larını (`register_routes`, `subscribe`, `serve`), HITL onay endpoint'lerini (`_mount_hitl_routes`, satır 1392) ve `@workflow_entry` keşfini (`discover_entry`, satır 601) bağlar.
3. **DurableAgent** (`dapr_agents/agents/durable.py:259`) — asıl ajan/orkestratör mantığı. `agent_workflow` (satır 559) tek-ajan döngüsünü, `orchestration_workflow` (satır 1308) çok-ajan orkestrasyonunu tanımlar. Her iki workflow da deterministik Python generator'ları olarak yazılmış; tüm yan etkili/deterministik-olmayan işler (LLM çağrısı, araç çalıştırma, rastgele seçim, zamanlama) `ctx.call_activity(...)` ile activity'lere devredilir.

Veri akışı (çok ajanlı orkestrasyon): İstek → `orchestration_workflow` → `get_team_members` activity ile ajan kayıt defteri (state store) sorgulanır (satır 1329) → strateji `initialize` activity'si (satır 1339/1388) → döngüde `select_next_task`/`select_next_agent` activity'si (satır 1479, 1877) seçilen ajana `ctx.call_child_workflow` veya pub/sub mesajı ile görev iletilir → yanıt `handle_response` activity'sinde (satır 1894) işlenir → `check_completion` (satır 1908) devam/bitiş kararı verir → `finalize_orchestration` (satır 1928) nihai mesajı üretir.

## Klasör yapısı (2 seviye, yorumlu)

```
dapr_agents/
  agents/                  # Ajan çekirdeği
    durable.py             # DurableAgent: agent_workflow + orchestration_workflow (4353 satır)
    base.py                # AgentBase: LLM döngüsü, mesajlaşma temeli (2213 satır)
    orchestration/          # Strateji Pattern: OrchestrationStrategy ABC + 3 somut strateji
    orchestrators/llm/      # LLM-tabanlı planlayıcı orkestratörün prompt/schema/state'i
    executors/               # Dış ajan runtime'ları (Claude Agent SDK vb.) için soyut arayüz
  workflow/
    runners/                # WorkflowRunner (base) ve AgentRunner (agent.py) — Dapr istemci sarmalayıcıları
    decorators/              # @workflow_entry, @message_router, @http_router
    utils/                    # pubsub.py, registration.py, subscription.py — routing altyapısı
  memory/                    # MemoryBase + ConversationDaprStateMemory (state store kalıcılığı)
  llm/                        # Sağlayıcı istemcileri: openai, anthropic, mistral, nvidia, litellm, dapr (conversation API)
  storage/daprstores/          # DaprStateStore sarmalayıcısı (state.redis vb. component'lere karşı)
  types/tools.py                # ToolExecutionStatus / ToolExecutionRecord
examples/
  04-multi-agent-workflows/     # Redis pubsub+state component'leriyle gerçek çok-servisli örnek
```

## Ajan tasarımı

`DurableAgent(AgentBase)` (`dapr_agents/agents/durable.py:259`) hem tekil ajan hem orkestratör rolünü aynı sınıfta taşır; `execution.orchestration_mode` set edilmişse `_orchestration_strategy` bir `AgentOrchestrationStrategy`/`RoundRobinOrchestrationStrategy`/`RandomOrchestrationStrategy` örneğiyle doldurulur (satır 461-472, `match self.execution.orchestration_mode` bloğu). Araç çağırma iki yola ayrılır: sıradan araçlar `ctx.call_activity(self._activity_name(self.run_tool), ...)` ile activity içinde çalışır (`durable.py:930` civarı); `WorkflowContextInjectedTool` (örn. ajan-araç-olarak-çağrı, `ask_user`) workflow'un kendi içinde `ctx.call_child_workflow` erişimi gerektiği için activity'ye değil doğrudan workflow generator'ına gömülür (`durable.py:857-926` yorumu: "cannot be ran within an activity bc activities do not have the workflow context").

## Orkestrasyon / iş akışı modeli

Üç orkestratör tipi `dapr_agents/agents/orchestration/` altında **Strategy Pattern** ile ayrılmış, hepsi aynı soyut sözleşmeyi (`strategy.py:33` `OrchestrationStrategy(ABC)`) uygular: `initialize`, `select_next_agent`, `process_response`, `should_continue`, `finalize`.

- **RoundRobin** (`roundrobin_strategy.py`): `agent_index = (turn - 1) % len(agent_names)` (satır ~97) — tamamen deterministik, sıralı isimler üzerinden.
- **Random** (`random_strategy.py`): `random.choice(agent_names)` / `random.choice(candidates)` (satır 152, 161) — önceki konuşmacıyı tekrar seçmemeye çalışır.
- **Agent (LLM-tabanlı)** (`agent_strategy.py`): "most sophisticated" olarak belgelenmiş; asıl mantık strateji sınıfında değil doğrudan `orchestration_workflow` içinde (satır 1334-1420), çünkü plan üretimi/sonraki adım seçimi LLM çağrısı gerektirir ve bunlar activity olarak (`self.call_llm`) tetiklenir.

Kritik mimari nokta: **rastgelelik ve LLM çağrıları asla workflow fonksiyonunun kendi gövdesinde çalıştırılmıyor.** `select_next_agent` (random dahil) `select_next_task` activity'si üzerinden çağrılıyor (`durable.py:1479` → `1877` `select_next_task` → `strategy.select_next_agent`). Strateji dosyasının kendi docstring'i bunu açıkça hedefliyor: *"Pure functions enable replay-safe workflows"* (`strategy.py:20`). Yani `random.choice`'ın kendisi deterministik değildir ama onu çağıran kod bir **activity**'dir; Dapr Workflow (Durable Task Framework) activity sonucunu execution history'e bir kez yazar ve replay sırasında activity'yi tekrar çalıştırmadan geçmişten okur — dolayısıyla workflow'un kendisi deterministik kalır, non-determinism activity sınırının arkasına hapsedilmiş olur.

## Durum ve bellek

- **Konuşma belleği**: `ConversationDaprStateMemory` (`dapr_agents/memory/daprstatestore.py:29`), her mesajı `{agent_name}:_memory_{workflow_instance_id}` anahtarında Dapr state store'a (örnekte `state.redis`, bkz. `examples/04-multi-agent-workflows/resources/memorystore.yaml`) yazar. `add_message` (satır 74) **etag tabanlı optimistic concurrency** kullanır: `get_state` → mesajı listeye ekle → `save_state(..., etag=etag)`; çakışma olursa 10 denemeye kadar (`max_attempts = 10`, satır 96) üstel+jitter'lı bekleme ile retry eder (satır 117-133).
- **Ajan kayıt defteri**: örnekte ayrı bir `state.redis` component'i (`agentregistrystore*.yaml`) — orkestratör hangi ajanların mevcut olduğunu `get_team_members` activity'siyle buradan okuyor (`durable.py:1329`).
- **Workflow durumu**: Dapr Workflow'un kendi execution history'si (arka planda yine bir state store'a — genelde Actor state store'a — yazılır) checkpoint mekanizmasıdır; kod bunu görmez, `ctx.call_activity`/`yield` sınırları örtük checkpoint noktalarıdır.

## Hata yönetimi

- **Activity seviyesi retry**: Her `ctx.call_activity` çağrısına `retry_policy=self._retry_policy` geçiliyor; politika `wf.RetryPolicy(max_number_of_attempts=..., first_retry_interval=..., max_retry_interval=..., backoff_coefficient=..., retry_timeout=...)` olarak `durable.py:447-458`'de kuruluyor — kullanıcı yapılandırmasından (`WorkflowRetryPolicy`) türetiliyor.
- **Workflow zamanlama retry**: `WorkflowRunner.run_workflow` (`base.py:381`) sadece geçici gRPC hatalarını (`CANCELLED`, `UNAVAILABLE`) 3 kez üstel geri çekilmeyle yeniden dener (satır 410-436); diğer hatalarda direkt raise eder.
- **Araç hataları**: `run_tool` activity'si (`durable.py:3097`) "Once the validation guards below pass, always returns a ToolMessage — even if tool execution itself fails" ilkesiyle yazılmış (satır 3103-3106) — her `tool_call_id`'nin karşılığı bir mesaj olsun diye hata da bir `ToolMessage` içine gömülüyor, workflow'u patlatmıyor. `ToolExecutionStatus` enum'u (`dapr_agents/types/tools.py:146`) `PENDING/RUNNING/COMPLETED/FAILED/TIMEOUT/DENIED/SKIPPED` durumlarını ayırt ediyor.
- **İnsan onayı / HITL**: `_request_approval` (`durable.py:1196`) bir `ApprovalRequiredEvent`'i pub/sub'a yayınlar (`publish_approval_request` activity, satır 1262), sonra `ctx.wait_for_external_event(event_name)` ile workflow'u **durdurur** (satır 1276); zaman aşımı yapılandırılmışsa bir `ctx.create_timer` ile yarıştırılır, süre dolarsa "auto-denying" (satır 1288). Bu, Dapr Workflow'un dış olaya kadar süresiz askıya alınabilme özelliğinin doğrudan kullanımı.

## Genişletilebilirlik

- **LLM sağlayıcıları**: `dapr_agents/llm/` altında openai, anthropic, mistral, nvidia, huggingface, elevenlabs, iflytek, litellm ve `llm/dapr` (Dapr'ın kendi `conversation.*` component API'si, örn. `examples/04-multi-agent-workflows/resources/openai.yaml`'daki `type: conversation.openai`) — sağlayıcı bağımsızlığı hem doğrudan SDK entegrasyonlarıyla hem Dapr'ın conversation building-block'uyla iki kanaldan sağlanıyor.
- **Orkestrasyon stratejileri**: `OrchestrationStrategy` ABC (`strategy.py:33`) yeni bir strateji eklemeyi (örn. graph-tabanlı) mevcut üç sınıfa (`agent_strategy.py`, `roundrobin_strategy.py`, `random_strategy.py`) bakarak kolaylaştırıyor; state şeması strateji-özel (docstring'lerde belgelenmiş), workflow çekirdeğine dokunmadan eklenebilir.
- **Dış ajan runtime'ları**: `AgentExecutorBase` (`dapr_agents/agents/executors/base.py:33`) Claude Agent SDK, LangGraph, AutoGen, OpenAI Assistants gibi harici çalışma zamanlarını `AgentEvent` akışı olarak DurableAgent'a bağlamak için soyutlanmış (satır 17-24 docstring).
- **Araçlar**: MCP (`dapr_agents/tool/mcp/`), HTTP (`dapr_agents/tool/http/`), workflow-context-injected (`dapr_agents/tool/workflow/`) olmak üzere üç araç kategorisi var.

## Güçlü yönler (kanıtlı)

- Non-determinism (LLM çağrısı, `random.choice`, zaman) tutarlı biçimde activity sınırının arkasına itilmiş — `strategy.py:20` bunu açıkça tasarım ilkesi olarak belirtiyor ve `durable.py:1877`'deki çağrı zinciri bunu doğruluyor.
- Bellek yazımı etag tabanlı optimistic concurrency ile korunuyor (`daprstatestore.py:74-133`) — çoklu eşzamanlı yazarlarda veri kaybını önlüyor.
- HITL onayı gerçek bir durable suspend/resume: `wait_for_external_event` + opsiyonel timer yarışı (`durable.py:1276-1288`) — workflow saatlerce/günlerce askıda kalabilir, süreç yeniden başlasa bile devam eder.
- Araç hatası her koşulda bir `ToolMessage`'a dönüştürülüp konuşma geçmişine ekleniyor (`durable.py:3103-3106`), LLM'in tutarlı bir sohbet geçmişi görmesini garanti ediyor.

## Zayıf yönler (kanıtlı)

- Ajan-arası mesajlaşma **Dapr actor modelini kullanmıyor** (`dapr.actor` importu kod tabanında bulunamadı) — tamamen pub/sub + workflow child-call kombinasyonu; "actor modeli" bekleyenler için bu bir varsayım hatası olabilir.
- Ağır altyapı bağımlılığı: çalışması için Dapr sidecar + en az bir state store + bir pub/sub component'i (örnekte ikisi de Redis, `examples/04-multi-agent-workflows/resources/{memorystore,pubsub,registrystore}.yaml`) şart — yerel geliştirmede bile Redis + `dapr init` gerektiriyor.
- `pyproject.toml:44`'te proje kendini `"Development Status :: 2 - Pre-Alpha"` ilan ediyor; API'lerin kırılganlığına işaret.
- `agent_strategy.py:22-23`'ün kendi docstring'i itiraf ediyor: "For AgentOrchestrationStrategy, most logic is handled directly in the orchestration_workflow" — yani en sofistike strateji, Strategy Pattern soyutlamasını yarı yarıya delip iş mantığının çoğunu workflow dosyasına (durable.py, tek dosyada 4353 satır) geri taşımış; soyutlama sızdırıyor.
- `ConversationDaprStateMemory.add_message` (satır 96-133) çakışma altında 10 kez senkron `time.sleep` ile retry ediyor — bu bir **activity içinde** çalışıyorsa sorun değil, ama yüksek eşzamanlı senaryoda gecikme birikimi riski var; kod bunu "TODO: make this nicer in future" notuyla kendisi de kabul ediyor (satır 92).

## Puan (1–5)

olgunluk: 2 — proje kendini "Pre-Alpha" sınıflandırmış (`pyproject.toml:44`), 744 yıldız ve CNCF şemsiyesi olsa da API stabilitesi iddiası yok.
mimari netlik: 4 — activity/workflow ayrımı, Strategy Pattern ve dosya bazlı sorumluluk bölünmesi tutarlı ve iyi belgelenmiş (docstring'ler tasarım ilkesini açıkça anlatıyor).
genişletilebilirlik: 4 — `OrchestrationStrategy` ABC ve çoklu LLM sağlayıcı katmanı somut, çalışan üç örnekle (roundrobin/random/agent) kanıtlanmış.
güvenilirlik ilkelleri: 4 — activity retry policy, etag'li state yazımı, geçici gRPC hatası retry'ı ve HITL timeout/timer yarışı hepsi kodda somut olarak var.
gözlemlenebilirlik: 3 — OpenTelemetry bağımlılıkları (`pyproject.toml` içinde `opentelemetry-*` 6 paket) ve `agents/telemetry/otel.py` mevcut ama bu incelemede derinlemesine okunmadı (kanıt sınırlı).
güvenlik duruşu: 3 — HITL onay akışı hassas araç çağrılarına insan kapısı koyuyor (`durable.py:1196-1288`) ama bu incelemede kimlik doğrulama/yetkilendirme katmanları (`agents/utils/auth.py`) detaylı incelenmedi.

## Alınacak fikir

1. **Non-determinizmi activity sınırına hapset**: Kendi orkestrasyon motorumuzda da rastgele seçim, zaman damgası, LLM çağrısı gibi her şeyi "checkpoint'lenebilir adım" olarak modelleyip ana kontrol akışını (sıra, döngü, karar ağacı) bunlardan ayrı, saf/deterministik tutmalıyız — replay/resume güvenliği bunun üzerine kurulu (kanıt: `dapr_agents/agents/orchestration/strategy.py:20` ve `durable.py:1877`).
2. **Her hatayı mesaja çevir, akışı patlatma**: `run_tool` activity'sinin "her tool_call_id için mutlaka bir ToolMessage döndür, hata da olsa" ilkesi (`durable.py:3103-3106`) doğrudan uygulanabilir bir desen — LLM'e tutarlı geçmiş sunmak crash'ten daha değerli.

## Alınmayacak

Redis zorunluluğu gibi ağır altyapı bağımlılığını olduğu gibi kopyalamamalıyız; ajans-os'ta dayanıklı yürütme fikrini (checkpoint + replay) daha hafif bir kalıcılık katmanına (örn. dosya/SQLite tabanlı) uyarlamak, Dapr sidecar + Redis zorunluluğunu getirmeden aynı garantiyi (deterministik replay, etag'li yazım) taklit etmek daha uygun — bu depo bunu bir platform kararı (Dapr'a tam bağımlılık) olarak çözmüş, biz bunu bir kütüphane kararına indirgemeliyiz.

## Matris cevapları

saglayici_bagimsiz: evet — `dapr_agents/llm/` altında openai, anthropic, mistral, nvidia, huggingface, litellm ve Dapr'ın kendi `conversation.*` component API'si (`llm/dapr/`) birlikte var; hiçbiri çekirdek workflow koduna sabitlenmemiş.
sozlesme_var: kismen — orkestrasyon stratejileri için gerçek bir ABC sözleşmesi var (`strategy.py:33`, 5 zorunlu metot), ama en sofistike strateji (`AgentOrchestrationStrategy`) kendi docstring'ine göre mantığının çoğunu bu sözleşmenin dışına, `orchestration_workflow` içine taşımış (`agent_strategy.py:22-23`).
insan_kapisi: evet — `_request_approval` + `wait_for_external_event` + timeout/timer yarışı ile durable, süresiz askıya alınabilen bir onay akışı var (`durable.py:1196-1288`).
checkpoint: evet — her `ctx.call_activity`/`yield` sınırı Dapr Workflow'un (Durable Task Framework) execution history'sine yazılan bir checkpoint'tir; non-determinizm activity'ye hapsedilerek deterministik replay garanti ediliyor (`strategy.py:20`, `durable.py:1479`).
