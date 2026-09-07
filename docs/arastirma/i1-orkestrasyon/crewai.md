# CrewAI

## Kimlik

Doğrulanmış: crewAIInc/crewAI · 58.173 yıldız · 396 watcher · son push 2026-09-04 (yerel klon `git log -1` ile doğrulandı) · MIT (`LICENSE:1` — "Copyright (c) 2025 crewAI, Inc.") · Python · arşivlenmemiş · canlılık: geçti. PyPI haftalık indirme sayısı doğrulanmadı (bu ortamdan ağ erişimiyle kontrol edilmedi).

Not: Depo artık tek paket değil, bir monorepo. Kaynak `lib/crewai/src/crewai/` altında; ayrıca `lib/crewai-core` (çekirdek yardımcılar, ör. `crewai_core.printer`, `crewai_core.version`), `lib/crewai-tools`, `lib/crewai-files`, `lib/cli`, `lib/devtools` alt paketleri var (`lib/` dizini, `find` çıktısı).

## Çözdüğü problem

Birden fazla LLM ajanının rol/hedef/geçmiş (role/goal/backstory) ile tanımlanıp, görev listesi üzerinde sıralı veya yönetici-ajan (hierarchical) modeliyle iş bölüşümü yapmasını; ayrıca saf görev-tabanlı modelin yetmediği durumlar için olay güdümlü (event-driven) durum makinesi (`Flow`) ile deterministik iş akışı kurmayı hedefliyor. İkisi de aynı pakette birlikte yaşıyor ve karışık kullanılabiliyor (`flow/runtime/_actions.py` içindeki `CrewAction`, bir Flow adımının bir Crew'u çalıştırabilmesini sağlıyor).

## Mimari

Ana bileşenler ve veri akışı (sequential crew örneği):

```
Crew.kickoff(inputs)                         crew.py:995
  -> prepare_kickoff()                       crew.py:1051 (crews/utils.py)
  -> _run_sequential_process()               crew.py:1512
       -> _execute_tasks(self.tasks)         crew.py:1561
            for each Task:
              prepare_task_execution()       (crews/utils.py)
              task.execute_sync(agent, ctx, tools)   task.py:585
                -> Task._execute_core()      task.py:809
                     -> agent.execute_task()  (agent/core.py)
                          -> CrewAgentExecutor.invoke()  agents/crew_agent_executor.py:230
                               -> _invoke_loop() (ReAct benzeri: LLM çağrısı -> Action/Final Answer ayrıştırma -> tool çağırma -> tekrar)
                     -> guardrail(lar) varsa _invoke_guardrail_function()  task.py:1327
                     -> human_input istenmişse _handle_human_feedback -> HumanInputProvider  core/providers/human_input.py
              _process_task_result() / _store_execution_log()   crew.py:1879, 1482
  -> _create_crew_output(task_outputs)       crew.py:1922
```

Hierarchical süreçte fark: `_run_hierarchical_process()` (crew.py:1516) önce `_create_manager_agent()` (crew.py:1521) çağırır — kullanıcı `manager_agent` vermemişse, `AgentTools(agents=self.agents).tools()` (delegate_work + ask_question tool'ları, `tools/agent_tools/agent_tools.py:22-36`) ile donatılmış otomatik bir yönetici `Agent` üretir; sonra aynı `_execute_tasks` akışı çalışır — fark, task'a agent atanmamışsa manager'ın delegasyon yapması.

Flow tarafı ayrı bir motor: `Flow` sınıfı (`flow/runtime/__init__.py:442`) bir Pydantic `BaseModel` + `FlowMeta` metaclass; `@start`/`@listen`/`@router` dekoratörleri (`flow/dsl/_start.py`, `_listen.py`, `_router.py`) metodun üstüne bir `FlowMethodDefinition` (tetikleyici koşul) iliştirir. `kickoff()` (flow/runtime/__init__.py:2069) başlangıç metodlarını sırayla çalıştırır (`_execute_start_method`, satır 2811); her metod bitince `_execute_listeners()` (satır 3141) tetiklenen router/listener'ları bulur (`_find_triggered_methods`, satır 3287) ve router'ları sıralı, normal listener'ları `asyncio.gather` ile paralel çalıştırır (satır ~3230). Bu, event-bus tabanlı değil, doğrudan async çağrı zinciriyle yürüyen bir yürütme grafiği.

Dosya yolları: `lib/crewai/src/crewai/crew.py`, `task.py`, `process.py`, `execution.py`, `agent/core.py`, `agents/crew_agent_executor.py`, `flow/runtime/__init__.py`, `flow/runtime/_actions.py`, `memory/unified_memory.py`, `tools/base_tool.py`, `tools/tool_usage.py`.

## Klasör yapısı

```
lib/crewai/src/crewai/
  crew.py            # Crew Pydantic modeli: kickoff, sequential/hierarchical yürütme, checkpoint/fork
  task.py            # Task modeli: execute_sync/async, guardrail retry, human_input tetikleme
  process.py         # Process enum'u: sequential | hierarchical (11 satır, sadece enum)
  execution.py       # Contextvar tabanlı "execution_uuid" (iç içe kickoff'larda izleme kimliği)
  agent/             # core.py (Agent sınıfı, 2155 satır), utils.py, planning_config.py
  agents/            # crew_agent_executor.py (ReAct döngüsü), agent_builder/ (BaseAgent soyutlaması), tools_handler.py, cache/
  flow/
    dsl/             # @start, @listen, @router, and_/or_ koşul birleştiriciler
    runtime/         # __init__.py (4015 satır, asıl yürütme motoru), _actions.py (Code/Tool/Crew/Agent/Expression/Script/Each aksiyonları)
    persistence/     # sqlite.py + base.py: flow state'in diske/DB'ye yazılması
  memory/            # unified_memory.py (remember/recall/forget/scope), storage/ (lancedb, qdrant backend'leri)
  tools/             # base_tool.py (BaseTool/Tool/@tool dekoratörü), tool_usage.py (çağrı+retry+hata), agent_tools/ (delegate/ask)
  hooks/             # decorators.py, dispatch.py, llm_hooks.py, tool_hooks.py — PRE_STEP/POST_STEP interception noktaları
  state/             # checkpoint_config.py, runtime.py — RuntimeState.from_checkpoint / kaydetme
  core/providers/    # human_input.py — HumanInputProvider protokolü (sync/async terminal prompt)
lib/crewai-core/      # ayrı paket: printer, version, auth gibi çekirdek yardımcılar
lib/crewai-tools/     # üçüncü parti/örnek tool koleksiyonu (ayrı paket)
```

## Ajan tasarımı

`Agent` sınıfı `BaseAgent`'i (soyut, `agents/agent_builder/base_agent.py`) genişletiyor; `role`, `goal`, `backstory`, `allow_delegation`, `tools`, `llm` gibi alanlarla tanımlanıyor (`agent/core.py:216` sınıf docstring'i alanları listeliyor). Bir ajanın asıl "beyni" `CrewAgentExecutor` (`agents/crew_agent_executor.py`) — bu, LLM'e mesaj gönderip (`_invoke_loop`), dönen metni `AgentAction`/`AgentFinish` olarak ayrıştıran (parser), action ise ilgili tool'u çalıştırıp sonucu tekrar mesaj geçmişine ekleyen klasik bir ReAct döngüsü. `invoke()` metodu (satır 230) her çağrıda mesajları sıfırlar, `_invoke_loop()` çalıştırır, `ask_for_human_input` bayrağı task'tan gelmişse (`task.human_input`, `agent/core.py:986`) `_handle_human_feedback` çağırır.

Delegasyon, ayrı bir ajan sınıfı değil; manager ajana `AgentTools` üzerinden iki tool eklenerek yapılıyor: `DelegateWorkTool` ve `AskQuestionTool` (`tools/agent_tools/agent_tools.py:26-36`). Yani "hangi ajana ne iş verileceği" LLM'in tool-çağırma kararına bırakılmış, ayrı bir planlayıcı bileşen yok (opsiyonel `planning` özelliği hariç, `agent/planning_config.py`).

## Orkestrasyon / iş akışı modeli

İki paralel model var:

1. **Crew + Process** — statik görev listesi, `Process.sequential` (tasks sırayla, `_execute_tasks`, crew.py:1561) veya `Process.hierarchical` (bir manager ajan araya girer, crew.py:1516-1552). Async görevler (`task.async_execution`) `Future` olarak biriktirilip bir sonraki senkron görevden önce `_process_async_tasks` ile toplanıyor (crew.py:1601-1618) — yani sınırlı bir paralellik modeli, tam DAG değil.
2. **Flow** — dekoratör tabanlı, olay güdümlü durum makinesi. `@start` giriş noktası, `@listen(x)` bir metodun/router sonucunun tetiklediği adım, `@router` koşullu dallanma üretir (bir string/enum döndürüp onu yeni bir "trigger" olarak yayınlar, `flow/runtime/__init__.py:2811-2860`). `or_()`/`and_()` ile çoklu tetikleyici birleştirme var (`flow/dsl/_conditions.py`). Listener'lar `asyncio.gather` ile paralel (satır ~3230), router'lar sıralı çalışıyor — bu, bilinçli bir tasarım kararı (router'lar akışı kontrol ettiği için sıra önemli).

Flow, bir Crew'u adım olarak sarabiliyor (`flow/runtime/_actions.py:130` `CrewAction.run` — `await crew.kickoff_async(...)` çağırıyor), yani iki model tek bir çalışma ağacında birleşebiliyor.

## Durum ve bellek

`Memory` sınıfı (`memory/unified_memory.py:76`) tek bir birleşik arayüz sunuyor: `remember()` (satır 430), `recall()` (satır 681), `forget()` (818), `update()` (852), ve hiyerarşik `scope()`/`slice()`/`tree()` (898-1001) ile ad alanlı (namespaced) bellek gezintisi. Yazmalar arka planda thread havuzuna gönderiliyor (`_submit_save`, satır 297) ve `drain_writes()` (350) ile senkronize ediliyor — crew `kickoff` sonunda `_drain_memory_writes()` (crew.py:1890) bunu garantiliyor. Depolama katmanı değiştirilebilir: `storage/lancedb_storage.py`, `storage/qdrant_edge_storage.py`, `storage/kickoff_task_outputs_storage.py`.

Durum kalıcılığı (checkpoint) ayrı bir katman: `Crew.from_checkpoint(config: CheckpointConfig)` (crew.py:432) `RuntimeState.from_checkpoint(...)` ile diskten/depodan bir `Crew` nesnesini geri kurup `_restore_runtime()` çağırıyor; `Crew.fork()` (crew.py:457) aynı checkpoint'ten dallanmış yeni bir kimlik üretiyor. Flow tarafında da benzer bir mekanizma var: `flow/persistence/sqlite.py` + `flow/persistence/base.py`, flow state'ini adım adım SQLite'a yazıyor. `kickoff(from_checkpoint=...)` her iki ana giriş noktasında da (Crew ve Flow) destekleniyor.

## Hata yönetimi

Üç ayrı katmanda hata/retry mantığı var:

- **Guardrail retry** (task çıktı doğrulama): `Task._invoke_guardrail_function` (task.py:1327) `guardrail_max_retries` (varsayılan 3, task.py:279) kadar deniyor; her başarısız denemede `agent.execute_task` yeniden çağrılıyor ve `tool_failures` biriktiriliyor (`accumulated_failures`, satır 1345); son denemede de başarısızsa `Exception` fırlatıyor (satır 1387-1393). Eski `max_retries` alanı deprecate edilmiş, `guardrail_max_retries`'e yönlendiriliyor (task.py:275-277, 574).
- **Agent döngüsü içi hatalar**: `CrewAgentExecutor` içinde `max_iter` sınırına ulaşılınca (`has_reached_max_iterations`, `utilities/agent_utils.py:363`) `handle_max_iterations_exceeded` (satır 376) devreye giriyor — LLM'e "artık nihai cevabı ver" mesajı ekleyip bir kerelik ek çağrı yapıyor. `OutputParserError` ayrı yakalanıp (`agents/crew_agent_executor.py:456`) `handle_output_parser_exception` ile toparlanıyor (`utilities/agent_utils.py:755`); bilinmeyen hatalar `handle_unknown_error` (satır 727) ile loglanıp yeniden fırlatılıyor.
- **Tool çağrı hataları**: `ToolUsage.use`/`_use` (tools/tool_usage.py:148, 503) her tool çağrısını `try/except` ile sarmalıyor, `last_failure = failure_from_exception(e)` (satır 471, 728) ile kaydediyor ve `should_retry` bayrağıyla (satır 296, 553) tek bir yeniden deneme yapıyor; sonuç `TaskOutput.tool_failures` alanına taşınıp guardrail/human tarafından görünür kılınıyor (task.py: `merge_tool_failures`).

Crew seviyesinde genel hata: `kickoff()`'un `except Exception as e` bloğu (crew.py:1067-1076) `_dispatch_execution_end_failure` çağırıp `CrewKickoffFailedEvent` yayınlıyor, sonra hatayı tekrar fırlatıyor (yutmuyor) — yani üst katman (kullanıcı kodu) hatayı görmek zorunda; framework sessizce yutmuyor.

## Genişletilebilirlik

Tool tanımlamak için üç yol var: `BaseTool` alt sınıfı (`tools/base_tool.py:103`), fonksiyon + `@tool` dekoratörü (satır 678-732, isim override destekli), veya LangChain tool'unu `Tool.from_langchain()` (satır 609) ile sarmalamak. `to_structured_tool()` (satır 405) her `BaseTool`'u ortak `CrewStructuredTool` temsiline çeviriyor — çağrı zamanı bu ortak tip üzerinden yürüyor. `max_usage_count` alanı (satır 269) bir tool'un kaç kez çağrılabileceğini sınırlıyor (`_claim_usage`, satır 302) — basit bir kota mekanizması.

LLM sağlayıcı bağımsızlığı: `llm.py` + `llms/` dizini (görülmedi ama `create_llm()` çağrısı crew.py:1541'de) çoklu sağlayıcıyı soyutluyor; `BaseLLM` (`llms/base_llm.py`, agent/core.py'de import ediliyor) ortak arayüz. MCP desteği ayrı bir modül olarak var (`mcp/`, `tools/mcp_tool_wrapper.py`, `tools/mcp_native_tool.py`) — crew.py:1766 `_inject_mcp_tools` ile task'lara MCP tool'ları enjekte ediliyor.

Hook sistemi (`hooks/decorators.py`, `hooks/dispatch.py`) `InterceptionPoint.PRE_STEP`/`POST_STEP` (task.py:837-838, 900-902) ile her task/agent adımının öncesinde/sonrasında payload'u değiştirebilen genel bir orta katman sağlıyor — guardrail'den ayrı, daha genel bir "middleware" noktası.

## Güçlü yönler (kanıtlı)

- Guardrail retry mekanizması, başarısız denemelerdeki tool hatalarını da (`accumulated_failures`, task.py:1345-1443) biriktirip nihai çıktıya taşıyor — hata bilgisi sessizce kaybolmuyor.
- `execution.py` (contextvar tabanlı `execution_uuid`) iç içe kickoff'larda (crew-in-flow, nested flow) tek bir izlenebilir kimliği koruyor; dosyanın kendi docstring'i bunun neden event-bus üzerinden değil kickoff çağrı zincirinden yapıldığını açıklıyor (execution.py:1-13) — tasarım kararı belgelenmiş.
- Flow motorunda router'ların sıralı, normal listener'ların paralel (`asyncio.gather`) çalıştırılması (flow/runtime/__init__.py:3141-3230) bilinçli bir ayrım: akış kontrolü deterministik kalıyor, bağımsız işler paralelleşiyor.
- Checkpoint/fork ikilisi (`Crew.from_checkpoint`, `Crew.fork`, crew.py:432-480) aynı checkpoint'ten hem "kaldığı yerden devam et" hem "yeni bir dal aç" senaryosunu tek API ile karşılıyor.

## Zayıf yönler (kanıtlı)

- `flow/runtime/__init__.py` tek dosyada 4015 satır — yürütme motoru, koşul çözümleme, persistans entegrasyonu, human-feedback, racing-listener mantığı hepsi aynı modülde; okunabilirlik ve test izolasyonu için yüksek karmaşıklık riski taşıyor.
- Async görev paralelliği sınırlı: `_execute_tasks` (crew.py:1561-1618) async task'ları yalnızca bir sonraki senkron task'a kadar biriktiriyor (`futures.append`, sonra `_process_async_tasks`) — gerçek bir DAG zamanlayıcısı değil, sıralı listede "yerel paralellik cepleri" var.
- Tool çağrı hatalarında retry mantığı (`tools/tool_usage.py`) tek seferlik (`should_retry` bir bool, sayaç değil) — üstel geri çekilme (backoff) veya yapılandırılabilir deneme sayısı görülmedi; sağlayıcı/ağ kaynaklı geçici hatalarda esneklik sınırlı olabilir.
- Manager agent tools kontrolü sert bir hata ile sonuçlanıyor: kullanıcı `manager_agent`'a tool eklerse `_create_manager_agent` (crew.py:1521-1540) önce uyarı loglayıp tool listesini temizliyor, SONRA yine de `raise Exception(...)` (satır 1539) fırlatıyor — hem "düzelttim" hem "hata verdim" çelişkili davranışı kodda görünür (muhtemelen kasıtsız, ama kanıtlanmış davranış).

## Puan (1–5)

olgunluk: 5 — monorepo yapısı, ayrı `crewai-core`/`crewai-files`/`crewai-tools` paketleri, deprecate edilen alanların geriye dönük uyumla taşınması (`max_retries` → `guardrail_max_retries`, task.py:275) uzun süredir üretimde olan bir projenin izleri.
mimari netlik: 3 — Crew/Process ve Flow modelleri ayrı ve iyi belgelenmiş dosya organizasyonuna sahip, ama `flow/runtime/__init__.py`'nin 4000+ satırlık tekilliği ve crew.py'nin 2490 satırlık "Crew nesnesinin her şeyi yapması" (tool enjeksiyonu, checkpoint, memory, execution hepsi aynı sınıfta) netliği zedeliyor.
genişletilebilirlik: 4 — üç farklı tool tanımlama yolu, MCP desteği, hook sistemi (PRE_STEP/POST_STEP), takılabilir bellek backend'leri (`storage/lancedb_storage.py`, `qdrant_edge_storage.py`) somut kanıt.
güvenilirlik ilkelleri: 3 — guardrail retry ve tool retry var ama tool retry tek seferlik ve sayaç/backoff yapılandırması görülmedi; checkpoint/resume güçlü bir dayanıklılık ilkeli.
gözlemlenebilirlik: 4 — OpenTelemetry entegrasyonu (`baggage`, `attach`/`detach`, crew.py importları), zengin event sistemi (`TaskStartedEvent`, `MethodExecutionFinishedEvent` vb.), `TraceCollectionListener` (crew.py) somut kanıt.
güvenlik duruşu: 3 — `security/` dizini ve `Fingerprint` mekanizması (crew.py:893, task.py fingerprint property) var ama bu incelemede araç/izin sınırlama (sandboxing) veya girdi doğrulama derinliğine inilmedi; kapsam dışı bırakıldı.

## Alınacak fikir

- Guardrail + retry birikimli hata taşıma modeli (task.py:1327-1443) — hangi problemi çözüyor: bir doğrulama katmanı (guardrail) başarısız olup ajana yeniden denetsin dediğinde, önceki denemelerdeki tool hataları kaybolmadan nihai çıktıya ekleniyor. ajans-os'ta nereye oturur: I3 (insan kapısı / guardrail sözleşmesi) alanında, bir görev çıktısının otomatik doğrulanıp reddedilme-yeniden deneme döngüsünün "hata izini kaybetmeme" ilkesi olarak.
- Checkpoint + fork ikilisi (crew.py:432-480, `CheckpointConfig`) — hangi problemi çözüyor: uzun süren bir ajan koşusunun ortasından devam etme VE aynı noktadan alternatif bir dal deneme ihtiyacını tek bir kalıcı durum temsiliyle çözüyor. ajans-os'ta nereye oturur: checkpoint/durability sözleşmesi (16 alanlı ajan sözleşmesindeki "checkpoint" maddesi) için somut bir referans tasarım.
- PRE_STEP/POST_STEP hook noktaları (task.py:837-838, 900-902; `hooks/dispatch.py`) — hangi problemi çözüyor: guardrail'den bağımsız, her adımın girdi/çıktısını değiştirebilen genel bir orta katman ihtiyacını (loglama, PII maskeleme, ek doğrulama) tek bir noktadan enjekte etmeyi sağlıyor. ajans-os'ta nereye oturur: gözlemlenebilirlik ve politika uygulama (policy enforcement) katmanı.

## Alınmayacak

- Flow motorunun tek dev dosyada (`flow/runtime/__init__.py`, 4015 satır) toplanmış olması — neden: test edilebilirlik ve okunabilirlik için modülerlik ajans-os'un mimari netlik hedefiyle çelişir; aynı işlevsellik ayrı dosyalara bölünerek alınmalı, dosya yapısı örnek alınmamalı.
- Tool retry'ın tek seferlik, sayaç/backoff'suz oluşu (`tools/tool_usage.py` `should_retry` bool) — neden: ajans-os'un güvenilirlik ilkeleri için yapılandırılabilir deneme sayısı ve üstel geri çekilme gerekiyor; bu haliyle geçici ağ/sağlayıcı hatalarında yetersiz kalır.
- Manager agent tool doğrulamasındaki çelişkili hata davranışı (crew.py:1521-1540, önce sessizce düzelt sonra yine de exception fırlat) — neden: bir sözleşme ihlalinde ya sessizce düzelt ya da hata ver, ikisini birden yapmak çağıran kod için öngörülemez davranış üretir.

## Matris cevapları

saglayici_bagimsiz: evet — `create_llm()` + `BaseLLM` soyutlaması (agent/core.py, llms/base_llm.py) ve ayrı `llms/` dizini çoklu sağlayıcıyı destekliyor; crew.py:1541 `self.manager_llm = create_llm(self.manager_llm)` bunu doğruluyor.
sozlesme_var: kismen — Pydantic modelleri (Crew, Task, Agent alanları) ve `FlowMethodDefinition` net şema sözleşmeleri sağlıyor, ama ajanlar arası (delegate/ask) sözleşme LLM'in serbest metin tool-çağırma kararına bırakılmış, katı bir arayüz sözleşmesi değil — bu yüzden "kismen".
insan_kapisi: evet — `task.human_input` alanı + `HumanInputProvider` protokolü (core/providers/human_input.py) hem sync hem async terminal tabanlı insan geri bildirim döngüsü sağlıyor (satır 172-330 civarı), training modu dahil.
checkpoint: evet — `CheckpointConfig`, `Crew.from_checkpoint`/`Crew.fork` (crew.py:432-480) ve Flow tarafında `flow/persistence/sqlite.py` ile hem Crew hem Flow seviyesinde kalıcı durum/devam ettirme mevcut.
