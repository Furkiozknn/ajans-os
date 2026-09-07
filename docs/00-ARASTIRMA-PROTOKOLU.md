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

*Satır disiplini (İ1 denetiminden):* aralık veriyorsan (`a-b`) anahtar
token o aralığın **içinde** olmalı; tek satır veriyorsan ±3 satırda
bulunabilmeli. Satır numarası oynak dosyalarda (`pyproject.toml`,
`package.json`) satırın yanına anahtar kelimeyi de yaz
(`pyproject.toml:72 "Development Status :: 2 - Pre-Alpha"`). Denetim
bunu `sed -n` ile birebir kontrol eder; tutmayan alıntı iddiayı
düşürmese de araştırmacının güvenilirlik puanını düşürür.

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

**Klon kuralı.** Kod okumak için klon gerekiyorsa `D:\Repolar\_inceleme\<repo>`
altına al (`git clone --depth 1`). Çalışma deposunun içine klonlama; oraya
yazılan şey commit'e girer. `_inceleme/` git dışıdır, istenince silinir.

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
7. **İncelenmeyenler** — bütçe/canlılık yüzünden açılmayan adaylar, neden.

### Denetim adımı (`DENETIM.md`)

İz özeti yazıldıktan sonra, **araştırmayı yapan koşudan farklı bir
koşu** özetteki en az 12 dosya:satır alıntısını `D:\Repolar\_inceleme`
klonlarında birebir doğrular ve `docs/arastirma/<iz>/DENETIM.md` yazar:
kaç alıntı tam / aralık içi / kaymış / **uydurma**; kayırma var mı;
dürüstlük bölümü var mı; karar (sentezde kullanılabilir / düzeltme
gerekir). Uydurma sayısı sıfırdan büyükse iz özeti sentezde kullanılmaz,
araştırma maddesi yeniden açılır. Örnek: `i1-orkestrasyon/DENETIM.md`.

---

## 5. Dürüstlük disiplini

- Bir projeyi incelemeye vaktin/bütçen yetmediyse "incelenmedi" yaz;
  README'den özet uydurma.
- Doğrulayamadığın sayıyı "≈" veya "doğrulanmadı" ile işaretle.
- Bir fikri beğendiysen zayıflığını da yaz; bir fikri beğenmediysen
  güçlü yanını da.
- Kullanıcının kendi depolarını kayırma; aynı rubrik, aynı sertlik.

---

## 6. Karşılaştırma matrisi (Faz 2 çıktısının biçimi)

İz özetleri bittikten sonra tek bir matris üretilir. Amaç, sentez
aşamasında "hangi proje neyi iyi yapıyor" sorusuna **bakmadan cevap
verebilmek**; bu yüzden biçim sabittir ve makine-okur bir kopyası olur.

### 6.1 İki çıktı

- `docs/01-KARSILASTIRMA-MATRISI.md` — insan için tablo + kısa yorum
- `docs/01-matris.json` — aynı verinin makine-okur hâli; sonraki
  analizler (en iyi fikirler, anti-pattern'ler) buradan okur

### 6.2 Satır: proje. Sütunlar (sabit, sıra değişmez)

| Sütun | Tip | Kaynak |
|---|---|---|
| `repo` | string | kimlik |
| `iz` | i1…i6 | hangi izde incelendi (birden fazla olabilir) |
| `canlilik` | gecti / tarihi | protokol §1 |
| `yildiz`, `son_push`, `lisans`, `dil` | | kimlik |
| `olgunluk` … `guvenlik` (6 puan) | 1–5 | protokol §3 rubrik |
| `saglayici_bagimsiz` | evet / kismen / hayir | tek LLM sağlayıcısına bağlı mı |
| `sozlesme_var` | evet / kismen / hayir | ajan makine-okur sözleşmeyle mi tanımlı |
| `insan_kapisi` | evet / kismen / hayir | riskli işlemde onay mekanizması |
| `checkpoint` | evet / kismen / hayir | durumdan devam edilebiliyor mu |
| `kanit` | dosya yolu | `docs/arastirma/<iz>/<repo>.md` |

"kismen" kullanılıyorsa proje dosyasında **neden kısmen** yazılı olmalı.

### 6.3 JSON biçimi

```json
{
  "uretim_tarihi": "YYYY-AA-GG",
  "projeler": [
    {
      "repo": "org/ad",
      "iz": ["i1", "i4"],
      "canlilik": "gecti",
      "yildiz": 0, "son_push": "YYYY-AA-GG", "lisans": "MIT", "dil": "Python",
      "puan": { "olgunluk": 4, "mimari_netlik": 3, "genisletilebilirlik": 4,
                "guvenilirlik": 3, "gozlemlenebilirlik": 2, "guvenlik": 2 },
      "saglayici_bagimsiz": "evet",
      "sozlesme_var": "kismen",
      "insan_kapisi": "hayir",
      "checkpoint": "evet",
      "kanit": "docs/arastirma/i1-orkestrasyon/org-ad.md"
    }
  ]
}
```

### 6.4 Matrisin altındaki yorum (en fazla bir sayfa)

1. **Sütun bazında liderler** — her ölçütte en iyi 2–3 proje, neden.
2. **Boşluklar** — hiçbir projenin iyi yapmadığı şey. Bunlar bizim
   fırsatımız ve en dikkatli tasarlanacak yerler.
3. **Çelişkiler** — bir ölçütte iyi olup diğerinde kötü olan
   projeler; ödünleşim (trade-off) nerede.

### 6.5 Faz 3 için ADR biçimi

Mimari kararlar `docs/adr/SABLON.md` biçiminde yazılır. Her ADR'de
"Dahil etme ölçütü" tablosu doludur; dolmuyorsa bileşen mimariye
girmez. ADR numaraları 001'den başlar, boşluk bırakılmaz.
