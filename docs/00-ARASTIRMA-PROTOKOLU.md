# Araştırma protokolü

Bu belge, Faz 1'de her araştırma turunun **nasıl** yapılacağını
tanımlar. Amaç karşılaştırılabilir, kanıta dayalı, kopyaya kapalı
analizler üretmek. Protokolü atlayan araştırma sentezde kullanılmaz.

---

## 1. Temel kurallar

**Kanıt kuralı.** Her iddia bir dosya yoluna, commit'e veya belge
URL'sine bağlanır. "Orkestrasyonu güçlü" değil —
"`graph/executor.py:112` — düğümler arası durum geçişi immutable
snapshot ile yapılıyor, bu yüzden rollback ucuz". Kanıtsız iddia silinir.

**README'ye güvenme kuralı.** README pazarlamadır. Şunlar açılır:
`ARCHITECTURE.md` / `docs/`, klasör ağacı (2 seviye), çekirdek
modül (orchestrator / graph / runtime / agent base class), hata
yönetimi kodu, test klasörü. Kod okunmadan yazılan analiz geçersiz.

**Canlılık kuralı.** Aday proje şu üçünü sağlamalı: son push ≤ 90 gün,
arşivlenmemiş, OSI lisanslı. Sağlamayan yalnızca "tarihî referans"
olarak, ayrı işaretle geçer.

**Derinlik > genişlik.** Her izde 6–10 proje. Yirmi yüzeysel özet
yerine altı derin analiz.

**Kopya yasağı.** Amaç fikir çıkarmak, kod taşımak değil. Her analizin
sonunda iki liste zorunlu: *Alınacak fikir* (neden, hangi problemi
çözüyor) ve *Alınmayacak* (neden zararlı/gereksiz/uyumsuz).

**Tek kaynak yasağı.** Hiçbir proje "ana model" değildir.
`agency-agents` dahil — o yalnızca "prompt kütüphanesi" kategorisinin
bir örneğidir.

**Yıldız sayısı kanıt değildir.** Watcher/star oranı, gerçek
kullanım (npm/PyPI indirme), issue kapanma hızı ve son 90 gün commit
yoğunluğu birlikte değerlendirilir.

---

## 2. Araştırma izleri

Yirmi beş alan altı ize toplanmıştır. Her iz bir gece görevi.

| İz | Alanlar |
|---|---|
| **İ1 Orkestrasyon ve planlama** | multi-agent orchestration, agent routing, dynamic task planning, DAG/workflow orchestration, agent-to-agent communication, specialist agent architectures, multi-agent consensus |
| **İ2 Bellek ve bağlam** | memory / long-term memory, context management, RAG, knowledge layer |
| **İ3 Araçlar ve güvenlik sınırı** | MCP, A2A, tool management & permissions, sandboxing, security / guardrails, agent identity / trust, human-in-the-loop |
| **İ4 Güvenilirlik** | evaluator / critic / reviewer, reflection & self-correction, failure detection / recovery, retry / fallback / checkpoint / rollback |
| **İ5 Gözlem ve ekonomi** | observability / tracing, evaluation & benchmarking, cost / latency optimization, model routing, production deployment |
| **İ6 Otonom kodlama ve öğrenme** | autonomous coding agents, self-learning / continuous optimization |

### Aday tohum listesi (hipotez — canlı doğrulanacak)

Bu liste başlangıç noktasıdır, sınır değil. Araştırmacı her izde en az
iki **listede olmayan** aday bulmakla yükümlüdür. Listedeki bir proje
canlılık kuralını geçemiyorsa çıkar, yerine koy.

- **İ1:** LangGraph, CrewAI, AutoGen / AG2, OpenAI Agents SDK,
  Google ADK, Microsoft Semantic Kernel, MetaGPT, CAMEL, Mastra, Agno,
  smolagents, Pydantic AI, Temporal (durable execution), Inngest,
  Prefect/Dagster (DAG modeli için)
- **İ2:** Letta (MemGPT), mem0, Zep, LlamaIndex, Haystack, Cognee,
  LangChain memory modülleri, Anthropic context-management belgeleri
- **İ3:** MCP spesifikasyonu ve referans sunucular, A2A spesifikasyonu,
  E2B, Daytona, guardrails-ai, NVIDIA NeMo Guardrails, LlamaFirewall,
  Open Policy Agent (izin modeli için), mcp-vet (kullanıcının kendi
  aracı — güven denetimi)
- **İ4:** Reflexion, Self-Refine, LATS, DSPy (optimizasyon/assertion),
  Instructor (yapılandırılmış çıktı + retry), LangGraph checkpointing,
  Temporal saga/compensation, AutoGen critic desenleri
- **İ5:** Langfuse, OpenTelemetry GenAI semantic conventions, Arize
  Phoenix, promptfoo, DeepEval, RAGAS, Braintrust, LiteLLM (router),
  OpenRouter, RouteLLM, Not Diamond
- **İ6:** OpenHands, SWE-agent, Aider, Cline, Devin benzeri açık
  projeler, Claude Code'un kendi ajan/alt-ajan modeli, SWE-bench /
  Terminal-bench (ölçüm), DSPy/TextGrad (kendini optimize etme)

Not: kullanıcının kendi depoları (`ai-workflow-engine` DAG motoru,
`ai-job-gateway` async iş sözleşmesi, `model-comparison-harness`,
`mcp-vet`, `nvidia-nim-mcp` fallback zinciri) **İ1, İ3, İ5**'te birer
aday olarak değerlendirilir — kayırılmadan, aynı rubrikle.

---

## 3. Proje başına çıkarım şablonu

Her proje için `docs/arastirma/<iz>/<repo-adi>.md` dosyası, şu
başlıklarla, bu sırayla:

```markdown
# <proje adı>

## Kimlik
repo · yıldız · watcher · son push · lisans · dil · haftalık indirme (varsa)
canlılık: geçti / tarihî referans

## Çözdüğü problem
Tek paragraf. Kimin için, hangi acıyı.

## Mimari
Bileşenler ve aralarındaki veri akışı. Mümkünse küçük bir diyagram
(metin). Hangi dosyada hangi bileşen — yol ver.

## Klasör yapısı
2 seviye ağaç, yorumlu. Ne nerede.

## Ajan tasarımı
Ajan nasıl tanımlanıyor (sınıf / config / prompt)? Sözleşmesi var mı?
Yetenek, girdi/çıktı, araç, izin nasıl ifade ediliyor?

## Orkestrasyon / iş akışı modeli
Graf mı, rol tabanlı mı, konuşma mı, DAG mı? Dinamik plan üretebiliyor
mu? Paralellik nasıl?

## Durum ve bellek
Durum nerede yaşıyor? Kalıcı mı? Checkpoint var mı? Bellek katmanları?

## Hata yönetimi
Retry, fallback, timeout, rollback, insan onayı. Kodda nerede.

## Genişletilebilirlik
Yeni ajan / araç / model eklemek kaç dosyaya dokunmak?
Çekirdek bozulmadan eklenebiliyor mu?

## Güçlü yönler (kanıtlı)
## Zayıf yönler (kanıtlı)

## Puan (1–5)
olgunluk · mimari netlik · genişletilebilirlik · güvenilirlik
ilkelleri · gözlemlenebilirlik · güvenlik duruşu

## Alınacak fikir
- <fikir> — neden, hangi problemi çözüyor, bizde nereye oturur

## Alınmayacak
- <özellik> — neden (zararlı / gereksiz / uyumsuz / tek sağlayıcıya bağımlı)
```

Puanlama rubriği:

| Puan | Anlamı |
|---|---|
| 5 | Üretimde kanıtlanmış, belgelenmiş, test edilmiş |
| 4 | Sağlam, küçük eksiklerle |
| 3 | Çalışıyor, ama belgelenmemiş veya kırılgan |
| 2 | Kısmen var, kavram düzeyinde |
| 1 | Yok veya yalnızca vaat |

---

## 4. İz özeti

Her iz için `docs/arastirma/<iz>/OZET.md`:

1. İncelenen projeler tablosu (kimlik + puanlar)
2. Bu izdeki **yinelenen desenler** — birden çok başarılı projede
   bağımsız olarak ortaya çıkan fikirler. Bunlar en güçlü sinyaldir.
3. **Ayrışan yaklaşımlar** — projelerin farklı çözdüğü aynı problem;
   hangisi neden, hangi koşulda.
4. **Anti-pattern'ler** — birden çok projede soruna yol açmış seçimler.
5. **Bizim için öneri** — 3–5 madde, her biri kanıta bağlı.
6. **Açık sorular** — sentez aşamasında karar verilmesi gerekenler.

---

## 5. Dürüstlük disiplini

- Bir projeyi incelemeye vaktin/bütçen yetmediyse "incelenmedi" yaz;
  README'den özet uydurma.
- Doğrulayamadığın sayıyı "≈" veya "doğrulanmadı" ile işaretle.
- Bir fikri beğendiysen zayıflığını da yaz; bir fikri beğenmediysen
  güçlü yanını da.
- Kullanıcının kendi depolarını kayırma; aynı rubrik, aynı sertlik.
