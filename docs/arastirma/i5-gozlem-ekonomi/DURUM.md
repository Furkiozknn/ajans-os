# İ5 Gözlem ve ekonomi — DURUM (yarım kaldı)

*Son güncelleme: 2026-09-08, 03:45 · bütçe duvarına yaklaşıldığı için durduruldu*

Bu iz **bitmedi**. Yol haritasındaki kutucuk bilerek boş bırakıldı.
Sonraki tur bu dosyayı okur, aşağıdaki "bitenler"i **tekrar incelemez**.

---

## Bitenler (4 / hedef 6–8)

| Dosya | Kategori | Durum |
|---|---|---|
| `otel-genai-semconv.md` | tracing standardı (birincil kaynak) | yazıldı — **uyarı için aşağıya bak** |
| `langfuse.md` | tracing platformu + maliyet hesabı | yazıldı |
| `nvidia-nim-mcp.md` | model failover (kullanıcının deposu) | yazıldı |
| `model-comparison-harness.md` | benchmark/değerlendirme (kullanıcının deposu) | yazıldı |

`OZET.md` **yazılmadı** — protokol §4'ün istediği yedi bölüm için en az
6 proje gerekiyor, elde 4 var. Yarım özet yazmaktansa yazılmadı.

## Kalanlar (sonraki turun işi)

Öncelik sırasıyla. Her biri için odak sorusu yazılı — açık uçlu
"depoyu incele" verme (tuzak #16/#17).

1. **LiteLLM** — `D:\Repolar\_inceleme\litellm` **klonlu, hazır**.
   Odak: Router'ın seçim politikası (`litellm/router.py` ve
   `litellm/router_strategy/`) — en düşük gecikme / en düşük maliyet /
   usage-based seçim gerçekten nasıl hesaplanıyor? Fiyat tablosu
   (`model_prices_and_context_window.json`) nasıl güncelleniyor?
   Circuit breaker / cooldown var mı (`litellm/router_utils/`)? Bu, K4
   Model Router sınırının **en yakın hazır uygulaması** — en yüksek değerli
   kalan madde.
   *Girme:* `litellm/llms/` (yüzlerce sağlayıcı adaptörü), `tests/`, `ui/`,
   `docs/`, `enterprise/`.

2. **RouteLLM** — `D:\Repolar\_inceleme\RouteLLM` **klonlu, hazır**.
   Odak: "güçlü model mi zayıf model mi" kararı hangi sinyalle veriliyor
   (`routellm/routers/`), eğitim verisi gerekiyor mu, kalite kaybı nasıl
   ölçülüyor. K4 için: yönlendirme kararı **model-agnostik** mi yoksa
   belirli bir model çiftine mi bağlı?

3. **OpenTelemetry GenAI — gerçek depo.**
   `D:\Repolar\_inceleme\semantic-conventions-genai` **klonlu, hazır**
   (bu turda indirildi). **Bu maddeyi atlama** — aşağıdaki uyarıya bak.

4. **semantic-router** (aurelio-labs) — `D:\Repolar\_inceleme\semantic-router`
   **klonlu, hazır**. Tohum listesinde **olmayan** aday. Odak: LLM
   çağırmadan, gömme benzerliğiyle yönlendirme — maliyeti sıfıra yakın bir
   router katmanı mümkün mü? Karar eşiği nasıl kalibre ediliyor?

5. **openllmetry** (traceloop) — klonlanmadı. Tohum listesinde **olmayan**
   ikinci aday. Odak: OTel GenAI kurallarını gerçekten uygulayan bir
   enstrümantasyon kütüphanesi neyi standarttan saparak eklemek zorunda
   kalmış? (Standardın pratikteki boşluklarını en hızlı bu gösterir.)

6. **promptfoo veya DeepEval** — klonlanmadı. Odak: deterministik
   doğrulayıcı ile LLM-yargıç nasıl bir arada duruyor; "değerlendirilemedi"
   ayrı bir durum mu. İ4'ün ana bulgusunun İ5 tarafındaki karşılığı.

**İncelenmeyecekler ve nedeni:**
- `portkey-gateway` — İ4'te zaten incelendi (`docs/arastirma/i4-guvenilirlik/portkey-gateway.md`),
  gateway/fallback tarafı orada kayıtlı. İ5'te tekrar açmak israf; matriste
  `iz: ["i4","i5"]` olarak işaretlenmesi yeterli.
- `Braintrust`, `Not Diamond` — kapalı kaynak / SaaS ağırlıklı; protokol §1
  canlılık kuralı OSI lisans istiyor. Açılmadı.
- `RAGAS` — İ2'nin RAG kapsamıyla örtüşüyor; İ5 için marjinal.

---

## ⚠️ Sonraki turun mutlaka bilmesi gereken bulgu

**OTel GenAI spec'i artık `open-telemetry/semantic-conventions` deposunda
değil.** v1.42.0'da ayrı bir depoya taşındı
(`semantic-conventions/CHANGELOG.md:118-122` — *"Move Generative AI semantic
conventions to a dedicated repository"*). `docs/gen-ai/` altındaki tüm
dosyalar artık yalnızca "Moved" yönlendirme sayfası
(`semantic-conventions/docs/gen-ai/gen-ai-spans.md:5 "# Moved: Generative AI
semantic conventions"`). Bu, elle doğrulandı.

Bu yüzden `otel-genai-semconv.md`, o depoda **deprecated olarak dondurulmuş**
son gerçek içeriğe dayanıyor: `model/gen-ai/deprecated/*.yaml` (registry /
spans / metrics / events, ~2688 satır, v1.41.0 anı). İçerik gerçek ama
**donmuş**. Analiz dosyasının "Dürüstlük" bölümünde bu açıkça yazılı.

**Sonraki turun görevi:** `_inceleme/semantic-conventions-genai` (klonlu)
üzerinden analizi **tazele** — özellikle şu üç soruyu yeniden sor, çünkü
cevapları taşınmadan sonra değişmiş olabilir:
1. Maliyet için standart bir attribute eklendi mi? (Donmuş sürümde **yok** —
   dört YAML'da `cost|price|usd|dollar` araması sıfır sonuç verdi.)
2. Herhangi bir alan `stability: stable` oldu mu? (Donmuş sürümde
   **hiçbiri** — tamamı deneysel.)
3. Ajan span'lerinin parent/child hiyerarşisi açık bir attribute'a bağlandı
   mı, yoksa hâlâ OTel trace context varsayımına mı dayanıyor? (Donmuş
   sürümde doğrulanamadı.)

Tazeleme, dosyayı sıfırdan yazmak değil: mevcut `otel-genai-semconv.md`'nin
başına "v1.42+ farkları" bölümü eklemek yeterli. Donmuş sürümün analizi
tarihî referans olarak değerli — ekosistemin nereden geldiğini gösteriyor.

---

## Şu ana kadarki ADR-000 K4 kanıtı (birikimli)

K4: *"Sistem hiçbir LLM sağlayıcısına doğrudan bağlanmaz. Tek bir Model
Router sınırı vardır."*

**Dört kaynağın dördü de K4'ü güçlendiriyor; çürüten kanıt bulunamadı.**
Ama üçü aynı çatlağı bağımsız olarak gösteriyor — bu, protokol §4'ün
"yinelenen desen en güçlü sinyaldir" ölçütünü karşılıyor:

> **Ortak sınır şemada kuruluyor, ama sınırı doldurmak için sağlayıcıya
> özel çeviri kodu kaçınılmaz.**

- `langfuse.md`: veri modeli tam sağlayıcı-bağımsız (`usageDetails`/
  `costDetails` açık uçlu `Record<string,number>`), ama ETL katmanında
  OpenAI ve Vercel AI SDK'ye özel if/else blokları var
  (`input_cached_tokens`, `output_reasoning_tokens`). "Tek ortak model"
  doğru, "tek çeviri sınırı" değil.
- `otel-genai-semconv.md`: ortak şema var, ama Anthropic (cache formülü),
  OpenAI (`service_tier`, `system_fingerprint`), AWS Bedrock (zorunlu
  `guardrail.id`) için **ayrı uzantı dosyaları** gerekmiş.
- `nvidia-nim-mcp.md`: NVIDIA modelleri elle `api_base` sarmalaması
  istiyor, diğer sağlayıcılar istemiyor
  (`nvidia_image.py:118-124`); ayrıca yetenek (vision) ortak listeye
  sığmadığı için ikinci bir liste açılmak zorunda kalınmış
  (`nvidia_image.py:168-172`).
- `model-comparison-harness.md`: aynı `api_base` istisnası ikinci kez,
  bağımsız bir depoda (`grading.py:47-49`).

**Faz 3 için taşınacak sonuç (henüz karar değil, kanıt):** Model Router
sözleşmesi üç şeye yer ayırmak zorunda — (1) sağlayıcıya özel taşıma
ayarı (`api_base` gibi), (2) yetenek beyanı (`text`/`vision`/`embedding`/
`safety`) çünkü düz sağlayıcı listesi yetmiyor, (3) açık uçlu
`usage`/`cost` sözlüğü çünkü sağlayıcılar sürekli yeni token türü
ekliyor (cache, reasoning). Sabit alanlı bir şema bir yıl içinde eskiyor.

**İkinci birikimli bulgu — henüz üç kaynaktan:** maliyet, iz standardının
parçası **değil**. OTel GenAI'da USD attribute'u yok; Langfuse maliyeti
kendi hesaplıyor (Postgres'te fiyat tablosu + sağlayıcı verisi otoriteyse
onu tercih ederek); iki kullanıcı deposu hiç hesaplamıyor. Yani "maliyet
sayacı" bizim kendi kuracağımız katman — standarttan hazır gelmiyor.

---

## Bu turdaki doğrulama

`node arac/kanit-dogrula.js i5-gozlem-ekonomi --yaz` çalıştırıldı →
`DENETIM-otomatik.md`.

| Toplam | TAM | YAKIN | VAR | Şüpheli |
|---|---|---|---|---|
| 201 | 98 | 10 | 84 | 9 |

Doğrulanabilir 117 alıntının **%92**'si tuttu (İ4'te %93'tü — aynı bantta).

Şüpheli 9'un **6'sı elle bakıldı ve hepsi tuttu** — altısı da aracın
token ayrıştırma yanılması:
- `model-comparison-harness/pyproject.toml:6` → `license = { text = "MIT" }` ✔ tam
- `backends.py:39-48` → `async def run(self, params: ...) -> dict[str, Any]:`
  satır 45'te, aralık içinde ✔ (araç imzayı parafraze sandı)
- `grading.py:117-120` → `"judge returned unparseable output: ..."` satır 120 ✔
- `grading.py:71-72` → araç cümledeki başka bir token'ı (`HttpBackend`) aradı;
  alıntı `for provider in _JUDGE_PROVIDERS` satırına ✔
- `nvidia_image.py:612` → `"(best-effort fallback verdict from {model}, ...)"` ✔ tam
- `nvidia_image.py:148` → `return response.choices[0].message.content, response.model` ✔;
  buradaki iddia bir **yokluk** iddiası (`usage` okunmuyor), token araması
  doğası gereği yokluğu doğrulayamaz.

Kalan **3 şüpheli** (`otel-genai-semconv.md`) elle bakılmadı — protokol §4
zaten resmî `DENETIM.md`'nin **ayrı bir koşuda** yazılmasını istiyor.
Sonraki denetim koşusunun işi.

## Bu turda yapılmayanlar

- `OZET.md` — 4 proje yeterli değil (yukarıda).
- `DENETIM.md` — protokol gereği ayrı koşu; iz zaten bitmedi.
- Matris girdisi — Faz 2'nin işi, iz özeti olmadan üretilemez.
