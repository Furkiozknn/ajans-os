# OpenHands (All-Hands-AI)

## Not — repo bölünmesi
Görev tarifi `openhands/controller/`, `openhands/events/`, `openhands/agenthub/codeact_agent/`
gibi yollar veriyordu; bunlar OpenHands'in 2025 öncesi tek-repo mimarisine ait. Klonlanan
`All-Hands-AI/OpenHands` artık **sadece frontend** (Agent Canvas, TypeScript/React):
`D:/Repolar/_inceleme/OpenHands/AGENTS.md:24-25` — "This repo (`OpenHands/OpenHands`) is
**only the agent-canvas frontend**." Python backend (ajan, olay akışı, güvenlik,
condenser) `OpenHands/software-agent-sdk` deposuna taşınmış:
`D:/Repolar/_inceleme/OpenHands/AGENTS.md:31` — "`OpenHands/software-agent-sdk` … agents,
tools, conversations, events, and the REST/WebSocket API surface". Bu yüzden analiz,
ayrıca klonlanan `D:/Repolar/_inceleme/software-agent-sdk` üzerinden yapıldı; aşağıdaki
tüm dosya yolları o depoya görecelidir.

## Kimlik
- **All-Hands-AI/OpenHands** (frontend, orijinal klon): 86.693 yıldız, 490 watcher, son
  push 2026-09-07T23:20:30Z, lisans MIT, dil TypeScript, arşivlenmemiş.
- **OpenHands/software-agent-sdk** (backend, gerçek analiz hedefi): 1.066 yıldız, 11
  watcher, son push 2026-09-07T18:03:11Z, lisans MIT, dil Python, arşivlenmemiş.
- Canlılık (bugün 2026-09-08): geçti — her iki repo da ≤90 gün içinde push almış,
  arşivlenmemiş, OSI onaylı MIT lisanslı.

## Çözdüğü problem
Tek bir Python ajanının (LLM + araç seti) bir görev üzerinde çok adımlı, kesintiye
dayanıklı, insan onayına açık ve isteğe bağlı sandbox'lanmış şekilde kod tabanında
çalışmasını sağlayan bir SDK + sunucu; hem yerel kullanım hem de Docker/uzak
workspace üzerinden izole çalıştırma senaryolarını tek bir konuşma/olay modeliyle
kapsıyor.

## Mimari
Bileşenler ve veri akışı:
- `Agent` (`openhands-sdk/openhands/sdk/agent/agent.py:375`) — LLM çağrısı, araç
  seçimi, güvenlik risk değerlendirmesi ve condenser tetikleme mantığının olduğu
  tek somut ajan sınıfı; `AgentBase`'ten (`openhands-sdk/openhands/sdk/agent/base.py:101`)
  türüyor.
- `LocalConversation` / `RemoteConversation`
  (`openhands-sdk/openhands/sdk/conversation/impl/local_conversation.py:179`,
  `.../impl/remote_conversation.py`) — ajanı adım adım çalıştıran döngü; `run()`
  (`local_conversation.py:1908`) confirmation modunu da yönetiyor.
- `ConversationState` (`openhands-sdk/openhands/sdk/conversation/state.py:82`) —
  mutable, pydantic tabanlı, çalışma zamanı durumu.
- `EventLog` (`openhands-sdk/openhands/sdk/conversation/event_store.py:34`) — her
  olayı ayrı dosyaya yazan, gerçek kaynak (source of truth) olay deposu.
- `CondenserBase` / `RollingCondenser` (`openhands-sdk/openhands/sdk/context/condenser/base.py:16,107`)
  — bağlam penceresi yönetimi.
- `SecurityAnalyzerBase` + `ConfirmationPolicyBase`
  (`openhands-sdk/openhands/sdk/security/analyzer.py:15`,
  `.../security/confirmation_policy.py:9`) — risk değerlendirme ve insan onayı kapısı.
- `BaseWorkspace` / `LocalWorkspace` / `DockerWorkspace`
  (`openhands-sdk/openhands/sdk/workspace/base.py:27`, `.../local.py:17`,
  `openhands-workspace/openhands/workspace/docker/workspace.py:53`) — ajanın komut
  çalıştırdığı ortam.
- `openhands-agent-server` — yukarıdakileri REST/WebSocket API'sine saran sunucu
  (`conversation_router.py`, `event_router.py`, `bash_router.py`, vb.); Agent Canvas
  (ayrı `OpenHands/OpenHands` deposu) bu API'nin istemcisi.

Akış: Kullanıcı mesajı → `Conversation.run()` → `Agent.step()` → LLM çağrısı → Action
event → (varsa) güvenlik/onay kapısı → Workspace'te yürütme → Observation event →
`EventLog`'a append → `ConversationState` güncellenir → condenser eşiği aşılırsa
bağlam sıkıştırılır.

## Klasör yapısı
```
software-agent-sdk/
├── openhands-sdk/openhands/sdk/      # çekirdek SDK
│   ├── agent/                        # AgentBase, Agent, subagent çağırma mantığı
│   ├── conversation/                 # State, EventLog, Local/RemoteConversation
│   ├── event/                        # Event taban sınıfı + llm_convertible/ (Action/Observation)
│   ├── context/condenser/            # RollingCondenser, LLMSummarizingCondenser
│   ├── security/                     # SecurityAnalyzerBase, ConfirmationPolicy, grayswan/
│   ├── subagent/                     # .md'den AgentDefinition yükleme + registry
│   └── workspace/                    # BaseWorkspace, LocalWorkspace
├── openhands-tools/openhands/tools/  # TerminalTool, FileEditorTool, preset/ (default/gemini/gpt5 ajan config'leri)
├── openhands-workspace/openhands/workspace/  # docker/, apptainer/, remote_api/, cloud/ — uzak/izole çalıştırma
└── openhands-agent-server/openhands/agent_server/  # FastAPI router'ları (REST/WS API)
```

## Ajan tasarımı
Ajan bir **pydantic config sınıfı** olarak tanımlanıyor, ayrı bir "agenthub" alt sınıf
hiyerarşisi yok. `AgentBase` (`agent/base.py:101`) `DiscriminatedUnionMixin, ABC`'den
türüyor; `tools: list[Tool]` alanı (`agent/base.py:125`), `system_prompt` /
`system_prompt_filename` (jinja şablon) alanları (`agent/base.py:202-238`) sözleşmeyi
oluşturuyor. Somut `Agent` sınıfı (`agent/agent.py:375`) `CriticMixin`,
`ResponseDispatchMixin`, `AgentBase`'i birleştiriyor; `step()`
(`agent/agent.py:637`) tek adımı yürütüyor. Her ajan için güvenlik analizörü
varsayılan olarak zorunlu kılınıyor:
`agent/agent.py:428-437` — `_add_security_prompt_as_default` /
`kwargs.setdefault("llm_security_analyzer", True)`.
Farklı "ajan tipleri" artık ayrı Python sınıfları değil, `openhands-tools/openhands/tools/preset/`
altında `default.py`, `gemini.py`, `gpt5.py`, `planning.py` gibi **araç+prompt
kombinasyonu üreten fonksiyonlar** (`get_default_agent`, vb.).

## Orkestrasyon / iş akışı modeli
Tekil ajan + isteğe bağlı **subagent delegasyonu** — graf/DAG değil. Subagent'lar Markdown
dosyalarından tanımlanıyor: `openhands-sdk/openhands/sdk/subagent/load.py:175` —
`load_agents_from_dir` bir dizindeki `.md` dosyalarını `AgentDefinition.load()` ile
okuyor (`subagent/load.py:208`); `subagent/registry.py:49` `AgentFactory` bunları
saklıyor. Ana döngü dinamik plan grafiği üretmiyor; `LocalConversation.run()`
(`conversation/impl/local_conversation.py:1908-1920`) tek bir konuşmayı adım adım
ilerletiyor ve confirmation modunda "ilk çağrı action üretir durur, ikinci çağrı
yürütür" iki-aşamalı akışı belgeleniyor (aynı dosya, 1911-1919 arası docstring).
Paralellik için `agent/parallel_executor.py` dosyası mevcut (yalnızca dosya adı
doğrulandı, içeriği bu araştırmanın kapsamı dışında bırakıldı).

## Durum ve bellek
**Soru: durum event stream'de mi yoksa mutable state'te mi yaşıyor, replay/resume var mı?**
İkisi birden: `EventLog` (`conversation/event_store.py:34`) her olayı ayrı dosyaya
`model_dump_json` ile yazan (`event_store.py:225,232`) kalıcı gerçek kaynak;
`ConversationState` (`conversation/state.py:82`) ondan türetilen mutable pydantic
nesnesi — `persistence_dir` alanı açıkça "resuming conversations" için var
(`state.py:102-105`). `append_event` (`state.py:315`) yorum satırında "append
replays only the new tail — O(k)" diyerek artımlı replay'i belgeliyor
(`state.py:344`). `LocalConversation` içinde resume yolu somut:
"Create-or-resume: factory inspects BASE_STATE to decide" (`local_conversation.py:321`)
ve "the agent is resumed from base_state.json" (`local_conversation.py:332,388`).
Yani süreç yeniden başlasa bile `base_state.json` + olay dosyalarından konuşma
kaldığı yerden devam ettirilebiliyor.

**Bağlam penceresi (soru 3):** `CondenserBase.condense()`
(`context/condenser/base.py:32-33`) soyut arayüz; varsayılan
`LLMSummarizingCondenser` (`context/condenser/llm_summarizing_condenser.py:38,48,51`)
`max_size=240` olay eşiğini aşınca (`llm_summarizing_condenser.py:154`
`if len(view) > self.max_size`) ilk `keep_first=2` olay hariç kalanları ayrı bir LLM
çağrısıyla özetleyip (`_generate_condensation`, satır 189) tek bir özet olayına
indiriyor (`RollingCondenser`, `condenser/base.py:107`).

## Hata yönetimi
**İnsan onayı kapısı (soru 2):** `ConfirmationPolicyBase.should_confirm(risk)`
(`security/confirmation_policy.py:9-11`) soyut arayüz; somut politikalar
`AlwaysConfirm` (27), `NeverConfirm` (35) ve risk eşiğine göre karar veren
`ConfirmRisky` (43, `threshold` alanına göre `risk.is_riskier(threshold)`).
`SecurityAnalyzerBase.security_risk(action)` (`security/analyzer.py:15,26`) her
action event'ine `SecurityRisk` (LOW/MEDIUM/HIGH/UNKNOWN,
`security/risk.py:13,20-23`) atıyor. Karar noktası `agent/agent.py:1047-1062`:
analizör varsa risk hesaplanır, yoksa `UNKNOWN` atanır; `state.confirmation_policy.should_confirm(risk)`
herhangi bir action için `True` dönerse konuşma `WAITING_FOR_CONFIRMATION` durumuna
geçiyor (`agent.py:1059-1062`). Kapı **kapatılabiliyor**: `NeverConfirm`
(`confirmation_policy.py:35-41`) hiçbir riski onaya sormuyor; varsayılan olarak
`llm_security_analyzer=True` her ajana zorla ekleniyor (`agent.py:437`) ama
confirmation policy'nin kendisi kullanıcı tercihine bırakılmış.
Ayrıca `defense_in_depth/` ve `grayswan/` alt paketleri (shell AST/pattern analizi,
`security/_shell_ast.py`, `security/shell_parser.py`) ek statik risk katmanları
sağlıyor.

Diğer hata primitifleri: `AgentErrorEvent` (`event/llm_convertible/observation.py:138`)
hataları olay akışına yazıyor; `ConversationExecutionStatus` enum'u
(`conversation/state.py:48`) `IDLE/PAUSED/ERROR/STUCK/WAITING_FOR_CONFIRMATION`
durumlarını tanımlıyor ve `run()` bu duruma göre devam/dur kararı veriyor
(`local_conversation.py:1926-1930`); `conversation/stuck_detector.py` dosyası ayrı
bir takılma-tespit modülü olarak duruyor.

## Genişletilebilirlik
**Soru 5 — yeni ajan eklemek kaç dosya?** İki farklı katman var:
- **Subagent** (mevcut Agent'a görev delege edilen alt-ajan): tek bir Markdown
  dosyası yazıp `register_agent_if_absent` ile kaydetmek yeterli —
  `openhands-tools/openhands/tools/preset/default.py:141-166`
  (`register_builtins_agents`, "Load and register builtin agents from
  `subagent/*.md`"). Python koduna dokunulmuyor.
- **Yeni araç**: `tool/registry.py:register_tool` (`openhands-sdk/openhands/sdk/tool/registry.py:113`)
  + `BUILT_IN_TOOL_CLASSES` eşlemesi (`agent/base.py:603-604`) — bir sınıf +
  bir kayıt çağrısı.
- **Yeni "ajan tipi"** (farklı prompt/araç kombinasyonu, ör. Gemini/GPT-5 preset'leri):
  `openhands-tools/openhands/tools/preset/` altına bir dosya (`gemini.py`, `gpt5.py`
  örnekleri) — `AgentBase`'i miras almaya gerek yok, mevcut `Agent` sınıfını farklı
  `tools=[...]` ve `system_prompt_filename` ile örnekliyorlar. Eski "agenthub/N tane
  ajan sınıfı" modelinden, "tek Agent sınıfı + config preset" modeline geçilmiş.

## Güçlü yönler (kanıtlı)
- Event-sourced state + kuyruk (tail) replay: `event_store.py:34` (her olay ayrı
  dosya) + `state.py:344` (yalnızca yeni kuyruğu replay ederek O(k) senkronizasyon) —
  süreç çökse bile `base_state.json`'dan devam edilebiliyor (`local_conversation.py:321-332`).
- Güvenlik analizörü ile onay politikası ayrık iki arayüz: risk hesaplama
  (`SecurityAnalyzerBase`) ile "ne zaman sor" kararı (`ConfirmationPolicyBase`)
  birbirinden bağımsız, `ConfirmRisky` gibi eşik tabanlı politika kolayca takılabiliyor
  (`confirmation_policy.py:43-61`).
- Sandbox yolu somut ve üretime hazır: `DockerWorkspace`
  (`openhands-workspace/openhands/workspace/docker/workspace.py:53`) container'ı
  `docker run` ile başlatıp (`workspace.py:236-257`) `volumes`/`network` alanlarıyla
  (97,119) izolasyonu parametreleştiriyor.
- Bağlam sıkıştırma pluggable ve varsayılanı belgeli sabitlerle geliyor
  (`max_size=240`, `keep_first=2`, `llm_summarizing_condenser.py:48,51`).

## Zayıf yönler (kanıtlı)
- Sorumluluk beş ayrı depoya (frontend, sdk, agent-server, workspace, automation)
  dağılmış (`AGENTS.md:28-54`) — tek depoda "OpenHands nasıl çalışır" sorusuna cevap
  yok, bu araştırmanın kendisi de yanlış depoyu klonlayarak başladı.
- Varsayılan çalışma ortamı izole değil: `LocalWorkspace`
  (`openhands-sdk/openhands/sdk/workspace/local.py:17`) doğrudan konak dosya
  sistemini kullanıyor; README bunu açıkça uyarıyor — "the agent will have full
  access to your filesystem" (`D:/Repolar/_inceleme/OpenHands/README.md:66,109`).
  İzolasyon (`DockerWorkspace`) opt-in.
- İnsan onayı kapısı `NeverConfirm` (`confirmation_policy.py:35-41`) ile tamamen
  kapatılabiliyor; güvenlik analizörü zorla açık olsa da (`agent.py:437`) onay adımı
  değil, yalnızca risk etiketleme garanti ediliyor.

## Puan (1–5)
olgunluk 4 · mimari netlik 3 (çok-repo dağınıklığı puanı düşürüyor) ·
genişletilebilirlik 4 · güvenilirlik ilkelleri 4 · gözlemlenebilirlik 3 ·
güvenlik duruşu 3

## Alınacak fikir
- Event-sourced `EventLog` + türetilmiş mutable `ConversationState` + tail-replay
  resume (`event_store.py:34`, `state.py:344`) — kendi otonom görev kuyruğumuzda
  (`gorevler/`) bir çalıştırma yarıda kesilirse kaldığı yerden devam etme problemini
  doğrudan çözen, kopyalanabilir bir model: olay dosyalarını append-only tut, durumu
  onlardan türet.
- Ayrık `SecurityAnalyzer` (risk hesapla) + `ConfirmationPolicy` (ne zaman sor) ikilisi
  (`security/analyzer.py:15`, `confirmation_policy.py:9`) — "dışarı açılan işlemler
  onay ister" kuralımızı tek bir politika nesnesine (ör. `ConfirmRisky` benzeri eşik)
  bağlamak, her çağrı sitesine ayrı if/else yazmaktan daha az kırılgan.

## Alınmayacak
- Beş-repo mimarisi (frontend/sdk/agent-server/workspace/automation ayrımı,
  `AGENTS.md:47-54`) — bizim tek-kişilik/tek-makine ölçeğimizde gereksiz operasyonel
  yük; tek depoda modül ayrımı yeterli.
- `LocalWorkspace` varsayılanı (host dosya sistemine sınırsız erişim,
  `workspace/local.py:17`) — sabit sınırlarımızla (kalıcı silme, kimlik bilgisi vb.)
  uyumsuz; bizde sandbox/izin kontrolü opt-in değil zorunlu olmalı.
