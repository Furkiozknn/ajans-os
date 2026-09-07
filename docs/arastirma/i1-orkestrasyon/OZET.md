# İ1 — Orkestrasyon ve planlama: iz özeti

Kapsam: multi-agent orchestration, agent routing, dinamik görev planlama, DAG/workflow orkestrasyonu, ajan-ajan iletişimi, uzman ajan mimarileri, multi-agent konsensüs.

Tarih: 2026-09-07 · Protokol: `docs/00-ARASTIRMA-PROTOKOLU.md` §3–§4.

Yedi proje incelendi; yedisi de canlılık kuralını geçti (son push ≤ 90 gün, arşivlenmemiş, OSI lisans). İkisi tohum listesinde yoktu: **Strands Agents** ve **Dapr Agents**.

---

## 1. İncelenen projeler

| Proje | Dil | Yıldız | Son push | Lisans | olgunluk | mimari netlik | genişletilebilirlik | güvenilirlik | gözlem | güvenlik | Kanıt |
|---|---|---|---|---|---|---|---|---|---|---|---|
| LangGraph | Python | 41.147 | 2026-09-06 | MIT | 5 | 4 | 5 | 4 | 3 | 2 | [langgraph.md](langgraph.md) |
| CrewAI | Python | 58.173 | 2026-09-04 | MIT | 5 | 3 | 4 | 3 | 4 | 3 | [crewai.md](crewai.md) |
| OpenAI Agents SDK | Python | 29.230 | 2026-09-05 | MIT | 5 | 4 | 5 | 4 | 3 | 4 | [openai-agents-sdk.md](openai-agents-sdk.md) |
| Strands Agents | Python | 7.165 | 2026-09-04 | Apache-2.0 | 4 | 3 | 5 | 4 | 4 | 3 | [strands-agents.md](strands-agents.md) |
| Mastra | TypeScript | 27.745 | 2026-09-07 | Apache-2.0 (+ `ee/` ticari) | 3 | 3 | 4 | 4 | 3 | 2 | [mastra.md](mastra.md) |
| Dapr Agents | Python | 744 | 2026-08-30 | Apache-2.0 | 2 | 4 | 4 | 4 | 3 | 3 | [dapr-agents.md](dapr-agents.md) |
| ai-workflow-engine (kullanıcının) | Python | 0 | 2026-09-06 | MIT | 2 | 4 | 2 | 1 | 2 | 4 | [ai-workflow-engine.md](ai-workflow-engine.md) |

| Proje | sağlayıcı bağımsız | sözleşme var | insan kapısı | checkpoint |
|---|---|---|---|---|
| LangGraph | evet | kısmen | kısmen | evet |
| CrewAI | evet | kısmen | evet | evet |
| OpenAI Agents SDK | kısmen | evet | evet | evet |
| Strands Agents | evet | kısmen | evet | kısmen |
| Mastra | kısmen | evet | evet | evet |
| Dapr Agents | evet | kısmen | evet | evet |
| ai-workflow-engine | hayır | kısmen | hayır | hayır |

Not: iki proje kendi olgunluğunu kendisi düşürüyor — Dapr Agents `pyproject.toml:44` içinde "Pre-Alpha", Mastra çekirdeği `@mastra/core@1.65.0-alpha.7`. Yıldız sayısı bu izde olgunlukla ilişkili çıkmadı: 744 yıldızlı Dapr Agents, güvenilirlik ilkellerinde 58 bin yıldızlı CrewAI'den yüksek puan aldı.

---

## 2. Yinelenen desenler (birden çok projede bağımsız ortaya çıkan)

**D1 — Durum, checkpoint'in birimidir.** Yedi projenin beşinde yürütme durumu serileştirilebilir tek bir nesneye indirgeniyor ve adım sınırında kalıcılaştırılıyor: LangGraph `BaseCheckpointSaver` (`libs/checkpoint/langgraph/checkpoint/base/__init__.py:177`), OpenAI Agents SDK tam JSON serileştirilebilir `RunState` (`run_state.py:1776-2256`), Mastra `stepResults` + workflow snapshot + `resumePath`, CrewAI `Crew.from_checkpoint` (`crew.py:432-480`), Dapr Agents'ta her `ctx.call_activity` sınırı (`durable.py:1479`). Bu izin en güçlü sinyali budur.

**D2 — İnsan kapısı "askıya al + dış olayı bekle" olarak modelleniyor.** Üç bağımsız proje aynı çözüme vardı: LangGraph `interrupt()` / `GraphInterrupt` (`types.py:851`, `errors.py:102`), Mastra suspend/resume, Dapr Agents `wait_for_external_event` + timer yarışı (`durable.py:1196-1288`). Onay, bloke eden bir girdi çağrısı değil; durum kalıcılaştırılır, süreç ölebilir, akış olayla canlanır. CrewAI'nin terminal tabanlı `human_input` döngüsü (`core/providers/human_input.py`) bunun ilkel hâli.

**D3 — Model sağlayıcısı ABC ile soyutlanıyor; çekirdek LLM bilmiyor.** LangGraph çekirdeğinde (`pregel/main.py`, `_loop.py`, `_algo.py`) hiçbir sağlayıcı bağımlılığı yok. Strands `Model(abc.ABC)` (`models/model.py:181`) + 11 opsiyonel implementasyon; CrewAI `create_llm()`/`BaseLLM`; OpenAI SDK prefix tabanlı `MultiProvider` (`multi_provider.py:62`). ADR-000 K4'ün "ince model sınırı" kararını bu desen destekliyor.

**D4 — Retry yürütücüye gömülmüyor, politika nesnesi oluyor.** LangGraph `RetryPolicy` (`types.py:418`) + `run_with_retry` (`pregel/_retry.py`), Strands hook tabanlı retry (`event_loop/_retry.py:21`), Mastra adım bazlı retryable/non-retryable ayrımı, Dapr Agents activity retry policy. Böylece farklı adımlar farklı politika taşıyabiliyor.

**D5 — Yönlendirme = bir sonraki ajanı belirten dönüş değeri.** OpenAI SDK handoff'u `current_agent = turn_result.next_step.new_agent` ile yapıyor (`run.py:1409-1414`); LangGraph'ta düğüm `Command`/`Send` ile kendi hedefini döndürüyor (`types.py:704,799`). Yönlendirme ayrı bir servis değil, adım çıktısının bir alanı.

**D6 — Araç sözleşmesi katı, ajan sözleşmesi gevşek.** Yedi projenin hepsinde araçlar JSON şemasıyla tanımlı (Strands `ToolSpec` `types/tools.py:30`, `tools/registry.py:576` doğrulama; Mastra `StandardSchemaWithJSON`), ama ajanlar arası devir çoğunlukla LLM'in serbest metin kararına bırakılmış. Matriste beş "kısmen"in sebebi bu. **Bu bir boşluk ve bizim fırsatımız** (ADR-000 K3).

---

## 3. Ayrışan yaklaşımlar

| Problem | Yaklaşım A | Yaklaşım B | Hangisi ne zaman |
|---|---|---|---|
| Yürütme modeli | **Graf/BSP** — LangGraph Pregel superstep'i (`pregel/_loop.py:599`), paralel düğümler, yazmalar `apply_writes` ile birleşir (`_algo.py:232`) | **Rol/konuşma** — CrewAI sequential/hierarchical (`crew.py:995-1922`), akış LLM kararıyla ilerler | Graf: dallanma önceden bilinebiliyorsa ve tekrar üretilebilirlik şartsa. Rol: problem keşifsel, plan çalışma anında oluşuyorsa |
| Dayanıklılık | **Deterministik replay** — Dapr Agents non-determinizmi activity sınırına hapsedip geçmişi yeniden oynatıyor (`strategy.py:20`) | **Snapshot** — LangGraph/Mastra durumu kaydedip oradan devam ediyor | Replay: süreç ölümüne dayanıklı uzun akışlar; bedeli altyapı (Dapr sidecar + state store). Snapshot: tek süreç, düşük operasyon maliyeti |
| Ajan döngüsü | **Ayrı döngü** — OpenAI SDK `Runner` (`run.py`), Strands event loop | **Workflow'un bir örneği** — Mastra ajan döngüsünü workflow motoru üzerine kurmuş (`loop/loop.ts`) | B, suspend/resume/retry/snapshot'ı bedavaya alıyor; A daha basit ama aynı ilkelleri iki yerde yazmaya zorluyor |
| Paralellik ve çakışma | **Katman içi `asyncio.gather`** — ai-workflow-engine topolojik katman + semaphore | **Superstep + kanal birleştirme** — LangGraph (`channels/binop.py`, `channels/last_value.py`) | Paralellik ikisinde de var; fark, aynı alana yazan iki adımın sonucunu LangGraph'ın birleştirebilmesi, ai-workflow-engine'de böyle bir mekanizmanın olmaması |

---

## 4. Anti-pattern'ler

**A1 — Tanrı nesnesi / tek dosyada her şey.** Beş projede aynı çürüme: Strands `agent/agent.py` 27 parametreli, 100K+ baytlık sınıf (`agent/agent.py:213-240`); Mastra `agent.ts` 10.026 satır; CrewAI `flow/runtime/__init__.py` 4000+ satır ve `crew.py` 2490 satır (araç enjeksiyonu + checkpoint + bellek + yürütme aynı sınıfta); Dapr Agents `durable.py` 4353 satır; LangGraph `pregel/main.py` 3500+ satır. Sonuç: bileşen izole test edilemiyor. **Bizde karşılığı:** ADR-000 K2'nin "tek başına test edilebilir" şartı bu izin en yaygın hatasına karşı alınmış somut bir önlem.

**A2 — Soyutlamayı kurup delmek.** Dapr Agents'ta `OrchestrationStrategy` ABC beş zorunlu metotla tanımlı (`strategy.py:33`), ama en gelişmiş strateji mantığının çoğunu sözleşmenin dışına taşımış — bunu kendi docstring'i itiraf ediyor (`agent_strategy.py:22-23`). Sözleşmenin varlığı uyum demek değil; uyum test edilmeli.

**A3 — Bağımsızlığı model katmanında ilan edip yan sistemlerde kaybetmek.** OpenAI Agents SDK'nın model katmanı gerçekten takılabilir, ama varsayılan tracing doğrudan `api.openai.com/v1/traces/ingest` adresine gidiyor (`tracing/processors.py:45`) ve iki Session implementasyonu OpenAI'a özel. Bağımsızlık iddiası model + bellek + gözlem üçünde birden sınanmalı.

**A4 — Lisans beyanı ile gerçeğin ayrışması.** Mastra `package.json` "Apache-2.0" diyor; `ee/` alt ağacı (`auth/ee`, `agent-builder/ee`) OSI-dışı ticari Mastra EE License ile korunuyor — ve orada duran şey tam olarak ince taneli yetkilendirme. Lisans README'den değil LICENSE dosyalarından okunmalı.

**A5 — Güvenilirlik ilkelini "sonra ekleriz" diye ertelemek.** Kullanıcının `ai-workflow-engine` deposu bunun canlı örneği: temiz mimari (netlik 4) ve gerçekten iyi güvenlik savunmaları (path injection, Jinja2 SSTI sandbox, YAML anchor-bomb — hepsi test edilmiş, puan 4), ama retry/fallback/checkpoint üçü de yok (puan 1). Tek hata tüm koşuyu düşürüyor, yeniden çalıştırma sıfırdan başlıyor (`README.md:166,168`). Bu ilkeller sonradan eklenince yürütücünün tamamına dokunmayı gerektirir.

---

## 5. Bizim için öneri

**Ö1 — Checkpoint kurucu ilke olsun, sonradan eklenen değil.** Beş projede bağımsız olarak aynı çözüm çıktı (D1) ve yokluğu tek projede belirleyici zayıflık oldu (A5). Orchestrator'ın durumu ilk günden serileştirilebilir tek bir nesne olsun; kalıcılaştırma arayüzü LangGraph'ın `BaseCheckpointSaver`ı gibi ayrı ve değiştirilebilir olsun (`libs/checkpoint/langgraph/checkpoint/base/__init__.py:177`).

**Ö2 — İnsan kapısını "askıya al + dış olay" olarak modelle.** D2'deki üç bağımsız uygulama bunu doğruluyor. Gece çalışan bir sistem için kritik: onay bekleyen akış, süreci canlı tutmadan beklemeli. ADR-000 K6'nın doğrudan uygulanışı. Kanıt: `types.py:851` (LangGraph), `durable.py:1196-1288` (Dapr Agents).

**Ö3 — Ajanlar arası devri makine-okur sözleşmeye bağla; ekosistemde buradaki boşluk gerçek.** D6: yedi projenin hiçbirinde ajan-ajan devri şemayla doğrulanmıyor; en iyi durumda kod-seviyesi sınıf arayüzü var (Strands `MultiAgentBase`). `contracts/agent.schema.json` başlangıç; `task.schema.json` ve `message.schema.json` bu boşluğu kapatmak üzere tasarlanmalı (ADR-000 K3).

**Ö4 — Retry/timeout politika nesnesi olsun; devir döngüsüne tavan koy.** D4'e ek iki somut fikir: Strands'ın Swarm'daki sert handoff tavanı ve tekrarlayan-devir istatistiksel tespiti (`multiagent/swarm.py:210-231`), ajanların birbirine top atmasını durduruyor; Dapr Agents'ın "her araç hatasını akışı patlatmadan bir mesaja çevir" yaklaşımı (`durable.py:3097-3106`) kısmi hatayı akış içinde tutuyor.

**Ö5 — Sağlayıcı bağımsızlığını üç eksende birden test et.** A3'ün dersi: model, bellek/oturum ve gözlem katmanlarının üçü de değiştirilebilir olmalı. "LiteLLM takılabiliyor" tek başına bağımsızlık kanıtı değil. ADR-000 K4'ün doğrulama ölçütü bu olsun.

---

## 6. Açık sorular (sentezde karara bağlanacak)

1. **Graf mı, rol tabanlı mı, ikisi mi?** LangGraph ve CrewAI aynı problemi farklı çözüyor (§3). Tek bir yürütme modeli mi seçeceğiz, yoksa Mastra gibi ajan döngüsünü workflow motorunun üzerine mi kuracağız? Sonuncusu ilkelleri tek yerde toplar ama motoru karmaşıklaştırır.
2. **Deterministik replay bedeline değer mi?** Dapr Agents'ın dayanıklılığı gerçek, ama altyapı bağımlılığı (sidecar + state store) tek makinede çalışan bir sistem için ağır. Snapshot yeterli mi?
3. **Paralel yazma çakışması nasıl çözülecek?** LangGraph kanal birleştiricisi kullanıyor (`channels/binop.py`); ai-workflow-engine'de böyle bir mekanizma yok. Bizim durum modelimiz birleştirilebilir mi olacak?
4. **Ajan-ajan sözleşmesi ne kadar katı olmalı?** Çok katı sözleşme, ekosistemin bilerek gevşek bıraktığı yeri kapatır ama dinamik plan üretimini kısıtlayabilir. Sınır nerede?
5. **`ai-workflow-engine` yeniden mi kullanılacak, yoksa fikirleri mi alınacak?** Mimari netliği ve güvenlik savunmaları güçlü; güvenilirlik ilkelleri yok ve `ai-job-gateway`e sıkı bağlı (sağlayıcı bağımsız: hayır). Karar Faz 3'e ait.

---

## 7. İncelenmeyenler (dürüstlük notu)

- **AutoGen (`microsoft/autogen`)** — son push 2026-04-15, canlılık kuralının 90 gün eşiğini geçemedi; tarihî referans olarak bile açılmadı, bütçe yetmedi. Konuşma tabanlı orkestrasyon ve konsensüs desenleri için sonraki turda bakılmalı.
- **Multi-agent konsensüs** izin kapsamındaydı ama incelenen yedi projede birinci sınıf bir konsensüs mekanizması bulunamadı (Strands Swarm ve CrewAI hierarchical en yakını). Bu, "ekosistemde yok" mu yoksa "yanlış yerde arandı" mı — açık.
- Haftalık indirme sayıları projelerin çoğunda doğrulanmadı; matriste kullanılmadı.
