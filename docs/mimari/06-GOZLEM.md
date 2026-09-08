# 06 — Gözlemlenebilirlik mimarisi

> Faz 3, `YOL-HARITASI.md` "Observability Architecture" maddesi.
> Girdi: [`00-BLUEPRINT.md`](00-BLUEPRINT.md) §2.13 ve §3.2,
> [`04-DEGERLENDIRME.md`](04-DEGERLENDIRME.md) §8,
> [`05-GUVENLIK.md`](05-GUVENLIK.md) §8,
> [ADR-000](../adr/ADR-000-program-ve-ilkeler.md) K7,
> [ADR-002](../adr/ADR-002-yurutme-ve-iletisim.md),
> [ADR-003](../adr/ADR-003-ilerleme-kaydi.md),
> ve İ5 izi (`docs/arastirma/i5-gozlem-ekonomi/`).
> Çıktı sözleşmesi: [`contracts/span.schema.json`](../../contracts/span.schema.json).

Bu belge **yeni kanıt üretmiyor.** Her `dosya:satır` alıntısı İ5 izinin
belgelerinden alındı; bu turda hiçbir klona girilmedi. İ5'in kendi
`DENETIM.md`'si 324 alıntının 213'ünü doğrulayabildi ve **yanlış iddia
bulmadı** — bulduğu 32 şüpheli kayıt adres/gösterim hatasıydı ve düzeltildi.
Bir uyarı taşınıyor: denetim aracı iki OTel klonunu (donmuş
`semantic-conventions` ile tazeleme `semantic-conventions-genai`) ayırt
edemiyor, bu yüzden `registry.yaml` ve `changelog.d/*.breaking.md`
alıntılarının hangi depoda eşleştiği makine tarafından teyit edilmedi.
Aşağıda o alıntılara dayanan iki karar (D3 ve D7) **bu zayıflıkla birlikte**
işaretlenmiştir.

---

## 1. Tek cümlelik akış

Her bileşen kendi sınırında bir **span** yazar; span'ler tek yönlü akar,
kimseyi çağırmaz; koşu bitince bu kayıtlar değerlendirmenin ve K7'nin
öneri üretiminin tek girdisidir.

```
1–9. adımdaki her bileşen ──(tek yön)──► Observability ──► span kaydı
                                                             │
                              ┌──────────────────────────────┤
                              ▼                              ▼
                    sayaçlar (§5, §6)              K7 öneri girdisi (§7)
```

Blueprint §3.2'nin 10. satırı bunu zaten yazmıştı: *"Observability ← 1–9
arasındaki her olay için span (tek yönlü)"*. Bu belge o satırın veri
karşılığını tanımlıyor.

---

## 2. Taşıyıcı karar: span doğruluk kaynağı değildir

**D1 — İz türetilmiş bir gözlemdir; ilerlemenin kaydı adım-sonucu
tablosudur.**

ADR-003 seçenek S2'yi (event log + deterministik replay) reddetti ve S3'ü
(adım-sonucu tablosu) seçti. Gözlemlenebilirlik doğası gereği olay
biçimlidir; bu iki şey birbiriyle çelişebilirdi. Çelişmiyor, çünkü rolleri
ayrı:

| | Adım-sonucu tablosu (`task.schema.json` `run.step_records`) | Span akışı (`span.schema.json`) |
|---|---|---|
| Rolü | Doğruluk kaynağı. "Bu adım yapıldı mı?" | Türetilmiş gözlem. "Ne oldu, ne kadar sürdü, kaça mal oldu?" |
| Kaybı ne demek | İlerleme kaybı — adım tekrar çalışır, yan etki tekrarlanabilir | Yalnızca görünürlük kaybı |
| Yazma anı | Yan etkiden **önce** (`BASLADI`) | Sınır kapanınca, sonradan |
| Kim güvenir | Orchestrator, Recovery Manager | Değerlendirme, Cost Manager, K7 |

Bunun işleyen sonucu tek cümle: **span yazımı başarısız olursa adım
başarısız sayılmaz.** Tersi olsaydı gözlem katmanı, izlemesi gereken
sistemin arıza kaynağı hâline gelirdi. Bu, ADR-003'ün "replay
yükümlülüğü kabul edilemez" gerekçesinin doğal devamıdır.

**D2 — Observability hiçbir bileşeni çağırmaz.**

ADR-002'nin kuralı: bileşenler birbirini çağırmaz. Observability bu kuralın
en katı hâlini taşır çünkü tek yönlü **dinleyicidir** (blueprint §3.2). Bir
span'in içeriği hiçbir zaman bir kararın *senkron* girdisi olmaz; kararlar
span'lerden **türetilen sayaçları** (§5, §6) okur, span'in kendisini değil.
Bu ayrım olmadan "gözlem" sessizce bir kontrol düzlemine dönüşür.

---

## 3. İz modeli

### 3.1 Üç seviye, ve ajan span'i model bilmez

**D3 — Token ve para muhasebesi yalnızca tek modele ve tek çağrıya karşılık
gelen sınırda tutulur.**

Bu, İ5'in en değerli tek bulgusu ve doğrudan OTel'in kendi kırıcı
değişikliğinden geliyor. `changelog.d/469.breaking.md` cache token
alanlarını internal `invoke_agent` span'inden **kaldırıyor** ve gerekçesini
yazıyor: *"Cache breakdowns on that span aggregate across models and
inference calls, which makes them misleading; consumers should aggregate
them from `gen_ai.inference.client` spans instead."* O span türü
`spans.yaml:171`'de tanımlı.

Aynı yönde üç kırıcı değişiklik daha var: `gen_ai.agent.id` internal ajan
span'lerinden çıkarıldı (`changelog.d/242.breaking.md`),
`gen_ai.provider.name` `invoke_agent`'tan çıkarıldı
(`changelog.d/289.breaking.md`), `gen_ai.agent.version` çıkarıldı
(`changelog.d/322.breaking.md`). Üçünün ortak mantığı: **ajan span'i model
bilmez; model bilgisi bir alt katmanda, çağrı span'inde yaşar.**

Bizim hiyerarşimiz bunu baştan benimsiyor:

```
run                 ← koşu; bütçe, süre, sonuç
└── invoke_agent    ← ajan çağrısı; model YOK, token YOK, maliyet YOK
    ├── inference   ← tek model, tek çağrı; model + usage + cost BURADA
    ├── execute_tool
    │   └── permission_check
    ├── evaluate
    │   └── critique
    ├── memory_write
    └── recovery
```

Şema bunu dayatıyor: `model`, `usage` ve `cost` alanları yalnızca
`operation: "inference"` olan span'de bulunabilir (çapraz kontrol §8).
Ajan seviyesinde toplam görmek isteyen **toplar**; toplama işi tüketicinin,
üretim noktası çağrı sınırının.

*Kanıtın zayıf yeri:* bu dört `changelog.d/*.breaking.md` alıntısı
tazeleme deposundan geliyor ve İ5 denetimi iki OTel klonunu ayırt
edemiyor (§0). Alıntı metni birebir kayıtlı, ama hangi klonda olduğu
makineyle teyit edilmedi.

### 3.2 Hiyerarşi açık bir alanla taşınır

**D4 — `parent_span_id` açık bir alandır; OTel trace context'ine
güvenilmez.**

İ5 OZET §6 bunu açık soru olarak bırakmıştı: *"Span hiyerarşisi (parent/child)
açık bir `gen_ai.*` attribute'una mı bağlanacak, yoksa OTel trace context'ine
mi güvenilecek?"* Tazeleme cevabı verdi: **bağlanmadı.** OTel'de gruplama
kimlikleri var — `gen_ai.conversation.id`, `gen_ai.agent.id`,
`gen_ai.agent.name` — ama parent/child taşıyan bir alan yok; hiyerarşiye tek
normatif gönderme `events.yaml:18`: *"This event SHOULD be parented to GenAI
operation span being evaluated when possible"*. Yani ilişki OTel'in kendi
trace context'ine bırakılmış.

Biz o varsayıma güvenmiyoruz. Gerekçe D1'den çıkıyor: iz bizde bir dosya
kaydıdır, canlı bir toplayıcı boru hattı değil. Dışa aktarım katmanı hiç
çalışmasa bile ağaç kayıtta durmalı. Langfuse de bağımsız olarak aynı
seçimi yapmış: `parentObservationId: z.string().nullable()`
(`observations.ts:60`) — observation ağacı bu alanla kuruluyor.

Kök span'de alan `null`'dur ve **zorunludur** — atlanamaz. "Alan yok"
ile "üstü yok" farklı şeylerdir; ikincisi bir bilgidir, birincisi bir
boşluk.

### 3.3 Sınıf listesi kapalıdır

`operation` kapalı bir enum'dur (`run`, `invoke_agent`, `inference`,
`execute_tool`, `permission_check`, `evaluate`, `critique`, `memory_write`,
`recovery`). Kapalılık bilinçli: yeni bir sınıf eklemek, o sınıfın **hangi
sayacı beslediğini** yazmayı zorunlu kılar. Kural 6 — tüketicisi olmayan
sinyal üretilmez.

Langfuse'ün `ObservationType` enum'u (`observations.ts:5-16`: `SPAN, EVENT,
GENERATION, AGENT, TOOL, CHAIN, RETRIEVER, EVALUATOR, EMBEDDING, GUARDRAIL`)
on üye taşıyor. Bizde dokuz var ve `RETRIEVER`/`EMBEDDING`/`GUARDRAIL`
karşılıkları **yok**, çünkü o bileşenler mimaride yok (blueprint §4.3
Knowledge Layer ve §4.4 ayrı denetim motoru girmedi). Sinyal sınıfı,
olmayan bileşen için açılmaz.

---

## 4. Hangi olaylar kaydedilir

Blueprint §3.2'nin dokuz adımı ile span sınıfları birebir eşleşir. Sol
sütun akıştaki adım, sağ sütun o sınırda yazılan span:

| §3.2 adımı | Span | Ne taşır |
|---|---|---|
| 1. Task Manager adım kaydı | *(span yok)* | Bu tablodur, iz değil (D1) |
| 2. Agent Registry | `invoke_agent` başlangıcı | Ajan kimliği, sözleşme sürümü |
| 3. Memory Manager | `memory_write` | Yalnızca yazma; okuma span üretmez |
| 4. Context Manager | `invoke_agent` özniteliği | Kısılma uygulandı mı |
| 5. Model Router → LLM | `inference` | **model + usage + cost** |
| 6. Cost Manager | *(span yok)* | `inference.cost`'u okur, kendi span'i yok |
| 7. Araç çağrısı | `execute_tool` → `permission_check` | Karar üç değerli |
| 8. Evaluator / Critic | `evaluate` → `critique` | Sonuç üç değerli |
| 9. Task Manager bitiş | *(span yok)* | Tablo |

Üç yerde bilinçli olarak span **yoktur**:

1. **Adım kaydının kendisi.** D1: tablo doğruluk kaynağıdır, kendi
   gözlemini üretmesi çift muhasebedir.
2. **Bellek okuması.** Her okuma span'i üretmek, iz hacmini bilgi
   katmadan büyütür. Yazma bir izin işlemidir (kural 10), okuma değildir.
3. **Cost Manager.** Maliyet `inference` span'inde doğar; Cost Manager
   onu okur. Ayrı span açsaydı aynı para iki yerde sayılırdı — D3'ün
   ihlali.

**Hata olayları span değil, span'in `outcome` alanıdır.** OTel'de
`event.gen_ai.client.operation.exception` ayrı bir *event*
(`events-deprecated.yaml:417`, önerilen severity WARN
`events-deprecated.yaml:432`), ama normatif olarak yine bir span'e
parent'lanması isteniyor. Bizde ayrı bir varlık türü açmak yerine span'in
sonucuna yazılıyor; bir sınırın nasıl bittiği o sınırın kendi kaydına
aittir.

`outcome` içinde **hata türü ile hata metni ayrıdır**. İki bağımsız proje
birbirinden habersiz aynı ilkeye ulaşmış: `model-comparison-harness`'ta
ayrı `error_type` alanı (`runner.py:22-26`), LiteLLM'de saf bir fonksiyon
429/401'i cooldown'a alıp diğer 4xx'i almıyor
(`cooldown_handlers.py:205-251`). Çağıran, serbest metni string eşleyerek
dallanmak zorunda kalmamalı. OTel'in `error.type`'ı serbest metindir
(`spans-deprecated.yaml:20-24`); biz orada ondan ayrılıp kapalı bir enum
kullanıyoruz — çünkü bizim tüketicimiz insan değil, Recovery Manager.

---

## 5. Maliyet ve gecikme sayaçları

### 5.1 Para hiçbir standardın parçası değil

Bu, İ5'in en net negatif bulgusu: hem donmuş hem tazeleme OTel deposunda
`cost|price|usd|dollar` araması **sıfır sonuç** veriyor, ve iz belgesi bunu
geçici bir eksiklik değil "kalıcı bir tasarım tercihi" olarak yorumluyor.
Spec token sayar, para saymaz.

Bu yüzden `cost` alanı bizim icadımızdır ve iki bağımsız projenin düştüğü
çukura düşmemek zorundadır. Langfuse Postgres'te kendi tablosunu kurmuş
(`schema.prisma:784-807` — `matchPattern`, `inputPrice`, `outputPrice`,
`tokenizerId`), LiteLLM kök `model_prices_and_context_window.json` +
`litellm.model_cost` sözlüğünü kullanıyor. **İkisinde de** tablonun
nasıl/ne zaman güncellendiği doğrulanamadı. Aynı boşluk, iki bağımsız
depoda — AP10'un ta kendisi.

**D5 — Fiyat tablosu veridir, ve her maliyet kaydı hangi tabloyla
hesaplandığını taşır.**

`cost.price_table` alanı `version` + `digest` (sha256) taşır. Sürüm beyandır,
özet ölçümdür — ADR-007'nin izin için kurduğu ayrımın aynısı. Bir ay sonra
"bu sayı hangi fiyatla çıktı" sorusu kayda bakarak cevaplanabilir; iki
olgun projede bu iz yok.

**D6 — Bilinmeyen maliyet `null`, sıfır değil; ve `null` ise sebebi
zorunludur.**

Kural 11 zaten `null` diyordu. Buraya bir şey ekleniyor: `usd: null` ise
`unknown_reason` alanı **zorunludur** ve üç değerlidir
(`fiyat-tablosunda-yok`, `usage-alinmadi`, `olculmedi`). Gerekçe İ5 AP2'den:
`nvidia_image.py:148` `litellm.acompletion` yanıtındaki `usage` alanını
okumadan atıyor — token sayısı bedavaya elde iken kayboluyor. Bu üç sebep
birbirinden farklı arızalardır ve farklı düzeltmeler ister; tek bir `null`
üçünü de gizler. "Bilmiyorum" kabul edilir, **sessiz bilmemek** edilmez.

Sağlayıcı maliyeti kendisi veriyorsa o otoritedir, kendi hesabımızı
yapmayız — Langfuse'ün ilkesi aynı: *"If user has provided any cost point,
do not calculate any other cost points"*
(`IngestionService/index.ts:1671-1690`).

### 5.2 Fiyat tablosunun güncelleme prosedürü

İ5 OZET §6'nın açık sorusu: *"Fiyat tablosunun güncel tutulma prosedürü ne
olacak? Hiçbir incelenen kaynak buna net bir cevap vermiyor."* Kapatılıyor:

| Soru | Karar |
|---|---|
| Nerede yaşar | `data/fiyat-tablosu.json` — veri, kod değil (kural 11) |
| Kim günceller | İnsan, elle. Otomatik çekme yok — kaynak API'si de bayatlayabilir ve bayatlığı görünmez olur |
| Ne sıklıkla | Sürüm etiketi tarihlidir; **90 günden eski tablo `usd`'yi `null` yapar**, `unknown_reason: "fiyat-tablosunda-yok"` |
| Nasıl doğrulanır | Tablonun `digest`'i her maliyet kaydında yazılı; tablo değişip özet değişmezse çelişki görünür |

Üçüncü satır asıl karardır. Bayat tablo sessizce yanlış maliyet raporlamak
yerine **bilmediğini söyler**. AP10'un mekanizması, kataloğun eskimesi
değil, eskidiğinin fark edilmemesidir.

### 5.3 Gecikme

`duration_ms` her span'de bulunur ve **bilinmiyorsa `null`'dur, sıfır
değil** — kural 11'in gecikmeye uygulanışı. Ölçülmemiş süre "anında"
demek değildir.

OTel tarafında karşılıklar var: `metric.gen_ai.client.operation.duration`
histogram, birim `s` (`metrics-deprecated.yaml:74-98`); akış için
`time_to_first_chunk` / `time_per_output_chunk`
(`metrics-deprecated.yaml:99-137`). Token tarafında
`metric.gen_ai.client.token.usage` histogram, birim `{token}`, zorunlu
boyut `gen_ai.token.type` (`metrics-deprecated.yaml:54-73`).

Bunları **metrik olarak üretmiyoruz.** Span kaydından türetilebilen bir
sayıyı ikinci bir yolla ayrıca yayınlamak, iki yolun ayrışması riskini
bedava satın almaktır. Histogramlar dışa aktarım katmanında (§9)
span'lerden hesaplanır.

---

## 6. Sekiz sayaç ve tüketicileri

Kural 6: her sinyalin bir tüketicisi ve yetki seviyesi vardır. Önceki iki
belge sekiz sayaç ilan etti ve tanımını buraya bıraktı. Hepsinin span
karşılığı burada:

| # | Sayaç | Kaynak span | Tüketici | Yetki |
|---|---|---|---|---|
| 1 | `degerlendirilmedi_orani` | `evaluate.outcome` | ADR-004 yeniden açılma koşulu | Karar verir |
| 2 | `mutant_yakalama_orani` | benchmark koşusu `evaluate` | Doğrulayıcı bakımı | Karar verir (1,0 altı arıza) |
| 3 | `retry_sonrasi_gecti_orani` | `critique` → sonraki `evaluate` | Critic istemi, `max_critique_items` | Ayar verir |
| 4 | `kapi_maliyeti` | `evaluate` + `critique` `duration_ms`/`cost` | Cost Manager | Bütçe girdisi |
| 5 | Araç gecikmesinin izinde geçen oranı | `permission_check.duration_ms` / `execute_tool.duration_ms` | ADR-005 yeniden açılma koşulu (%10) | Karar verir |
| 6 | `HUMAN_REQUIRED` oranı | `permission_check.outcome` | Otonominin fiili sınırı | **Yalnızca ölçülür** |
| 7 | Özet uyuşmazlığından düşen izin sayısı | `permission_check` + ADR-007 `binding` | Özet tanımının doğruluğu | Uyarı verir |
| 8 | Gölge detektörlerin `kaldi` oranı | `shadow: true` span'ler | Gölgeden çıkma ölçütü | Ölçüsü yoksa çıkamaz |

Sayaç 6'nın yetkisi bilerek "yalnızca ölçülür"dür ve bu 05-GUVENLIK §8'de
gerekçelendirilmişti: "çok fazla onay isteniyor" bir performans bulgusudur,
kapıyı gevşetmek için gerekçe olamaz. Gözlem katmanı bu sayıyı üretir ve
**hiçbir yere bağlamaz**; bağlanmaması onun tasarımıdır, eksiği değil.

**Gölge mod (`shadow: true`).** AP5 → kural 6: ölçülmemiş detektör gölge
modda başlar ve ürettiği sinyal hiçbir kararın girdisi olamaz. Bu, İ5'in
§3'te bulduğu ayrışmanın doğru tarafıdır: `nvidia-nim-mcp`'nin sağlık
probu sonuç üretiyor ama zincir sırasını etkilemiyor — bilgi üretiliyor,
kullanılmıyor; LiteLLM'de cooldown mekanizması sağlık sinyalini doğrudan
filtreye besliyor (`cooldown_handlers.py:205-251`,
`constants.py:74` `DEFAULT_COOLDOWN_TIME_SECONDS = 5`). İkisi arasındaki
fark, "gözlem üretip atmak" ile "gözlemi kararın girdisi yapmak"tır.

Gölge mod bu ikisinden **hiçbiri değildir**: geçicidir ve **çıkış ölçütü
yazılıdır** (sayaç 8). Ölçüsü olmayan detektör gölgede kalır; sonsuza kadar
gölgede kalan detektör silinir. Kullanılmayan sinyal, üretilmeyen sinyalden
pahalıdır.

---

## 7. İz → değerlendirme → öğrenme veri sözleşmesi

ADR-000 K7 döngüyü tanımlamıştı: *izler (traces) → değerlendirme → öneri →
insan onayı → uygulama.* Bu belge o zincirin **ilk iki halkasını** taşıyor;
üçüncü halka (öneri sözleşmesi) Faz 3'ün "Self-improvement Architecture"
maddesine ait ve burada yazılmadı.

Zincirin geçtiği veri:

```
span kayıtları
    │  §6'nın sekiz sayacı  ──────────────► değerlendirme kararları
    │
    └─ K7 girdi paketi:
         · run_id + trace_id                (hangi koşu)
         · invoke_agent span'leri            (hangi ajan, hangi sözleşme sürümü)
         · evaluate/critique span'leri       (ne kaldı, neden)
         · inference cost/usage toplamı      (kaça mal oldu)
         · outcome.error_type dağılımı       (hangi sınıf hata tekrarlıyor)
```

**D7 — K7'nin girdisi span kayıtlarıdır; öneri üretimi span'leri okur,
canlı sistemi değil.**

Gerekçe D1'in devamı: öneri, olmuş bitmiş bir koşu hakkındadır. Canlı
duruma bakan bir öneri üreteci, gözlemlediği sistemi etkileme yoluna
sahip olur — K7'nin "kendiliğinden değiştirmez" kuralının en sessiz ihlali
budur.

**Öğrenmenin sözleşme yüzeyi:** K7 girdi paketi, yukarıda tanımlanan span
alanlarından **türetilir**; öğrenme döngüsü için span şemasına fazladan
hiçbir alan eklenmedi ve var olan sözleşmelerden (`task`, `message`,
`permission`, `agent`) hiçbirinde değişiklik istenmiyor. Bu belgenin
getirdiği tek yeni sözleşme `span.schema.json`'dır. Öneri üretimi için
ileride yeni bir alan gerekirse bu bir sözleşme değişikliğidir ve
`contract_version` artar.

**Açık uçlu sözlüklerin terfi kuralı.** İ5 OZET §6'nın son açık sorusu:
*"Açık uçlu usage/cost sözlüğündeki bir alanın ne zaman 'çekirdeğe terfi
ettiği'ne kim/nasıl karar verecek?"* Kapatılıyor:

> `usage.extra` ve `attributes` bir **bekleme odasıdır, kalıcı çöp kutusu
> değildir.** Bir alan **iki bağımsız sağlayıcıda** aynı kavramı taşımaya
> başladığında çekirdek alana terfi eder ve `contract_version` artar.
> Terfi etmeyen alan **altı ay sonra silinir** — kimse okumuyorsa sinyal
> değildir (kural 6).

Bu kuralın kanıtı OTel'in kendi evrimidir: donmuş sürümde Anthropic'e özel
sayılan cache token'ları tazeleme deposunda çekirdek registry'ye terfi etti
(`registry.yaml:301`, `registry.yaml:308`), modalite kırılımıyla birlikte
(`registry.yaml:374`), ve ayrı bir `model/anthropic/` klasörü kalmadı. Ama
uzantı katmanı **boşalmadı**: `model/openai/registry.yaml` (39 satır) ve
`model/aws-bedrock/registry.yaml` (17 satır) duruyor. Langfuse aynı deseni
bağımsız olarak kurmuş — `usageDetails`/`costDetails` açık uçlu sözlük
(`observations.ts:83-85`), ama `OtelIngestionProcessor.ts:2846-2867` ve
`OtelIngestionProcessor.ts:2870-2881` sağlayıcıya özel ayrı if/else
blokları taşıyor.

Doğru formülasyon İ5'in kendi düzeltmesidir: **sağlayıcıya özel alan kalıcı
değil, geçici; kavram çekirdeğe terfi eder ama uzantı katmanı hiç
boşalmaz.** Terfi süreci olmayan bir bekleme odası, çöp kutusudur.

*Kanıtın zayıf yeri:* `registry.yaml:301,308,374` alıntıları tazeleme
deposundan geliyor ve §0'daki klon ayrımı sorunu bunlar için de geçerli.

---

## 8. Sözleşme ve şemanın göremediği kurallar

`contracts/span.schema.json` (`contract_version` 1.0). Şemayla ifade
edilemeyen alanlar-arası kurallar `arac/sema-dogrula.js` içinde **çapraz
kontrol** olarak kodlanmıştır — çünkü belgede yazan ama makinede
sınanmayan kural, AP3'ün tanımıdır:

| # | Kural | Nereden |
|---|---|---|
| 1 | `model`/`usage`/`cost` yalnızca `operation: "inference"` span'inde bulunabilir | D3 |
| 2 | `inference` span'i `model` **ve** `usage` **ve** `cost` taşımak zorundadır | D3 |
| 3 | `cost.usd` `null` ise `unknown_reason` zorunlu | D6 |
| 4 | `content` varsa `content_recording` `"acik"` olmalı | §9 |
| 5 | `operation: "run"` span'inde `parent_span_id` `null`; diğer her span'de dolu | D4 |
| 6 | `ended_at` `started_at`'ten önce olamaz | temel tutarlılık |
| 7 | `shadow: true` span `permission_check` kararını taşıyamaz | AP5 → kural 6 |
| 8 | `trace_id` ile `run_id` aynı koşuda ayrışamaz | §3 |

Var olan sözleşmelerle bağ (yeni alan istenmiyor):

| Sözleşme | Alan | Buradaki karşılığı |
|---|---|---|
| `task.schema.json` | `run.run_id` | `span.run_id`, `span.trace_id` |
| `task.schema.json` | `graph.steps[].id` | `span.step_id` |
| `task.schema.json` | `step_records[].cost_usd` | `inference` span'lerinin `cost.usd` toplamı; `null` toplanmaz, toplam `null` olur |
| `task.schema.json` | `step_records[].evaluation_result` | `evaluate.outcome` |
| `permission.schema.json` | `decision` | `permission_check.outcome` |
| `permission.schema.json` | `shadow` | `span.shadow` — aynı anlam, aynı yetki |
| `message.schema.json` | `kind: "critique"` | `critique` span'i |
| `agent.schema.json` | ajan kimliği | `invoke_agent.actor.id` |

Üçüncü satır bir tuzağı kapatıyor: `null` maliyetler toplanırken **sıfır
sayılmaz**; içlerinden biri `null` ise adımın toplamı da `null`'dur. Aksi
hâlde bilinmeyen para, harcanmamış para gibi görünür ve bütçe sayacı
sessizce yanılır — bu makinede bütçe duvarı beş görevi yarıda kesti.

---

## 9. İçerik kaydı ve OTel'e bağlanma

**İçerik varsayılan olarak kaydedilmez.** OTel'in deseni doğrudan alınıyor:
içerik taşıyan tüm alanlar `requirement_level: opt_in`
(`spans-deprecated.yaml:127,129,131,133`; araç tarafında
`spans-deprecated.yaml:637,639`), ve registry PII uyarısı taşıyor
(`registry-deprecated.yaml:1144,1212`). PII riskini spec seviyesinde çözen
basit ve doğru bir desendir.

Bizde `content` alanı yoksa yoktur; varsa `content_recording: "acik"`
kayıtta yazılıdır. Böylece "bu koşuda içerik toplandı mı" sorusu, koşuyu
çalıştıran yapılandırmayı bulmadan, kaydın kendisine bakarak cevaplanır.

**OTel adları koda gömülmez.** `otel_map` alanı çeviri tablosunu span'in
yanında taşır. Gerekçe İ5'in doğrudan yargısıdır: GenAI semconv'a
**sözleşme olarak bağlanılamaz** — `model/` altındaki 197 `stability:`
bildiriminin 197'si de `development`, tek bir `stable` yok; `changelog.d/`
altında yedi kırıcı parça var ve biri doğrudan yeniden adlandırma
(`gen_ai.usage.cache_creation.input_tokens` →
`gen_ai.usage.cache_write.input_tokens`, `changelog.d/440.breaking.md`).
`gen_ai.system` de deprecated olup `gen_ai.provider.name`'e taşınmış
(`registry-deprecated.yaml:65-160` kapalı enum listesi).

Eşleme tablosu — bizim adımız solda, OTel karşılığı sağda:

| Bizim | OTel | Kaynak |
|---|---|---|
| `operation: "invoke_agent"` | `invoke_agent {gen_ai.agent.name}` | `spans-deprecated.yaml:547-548` |
| `operation: "execute_tool"` | `execute_tool {gen_ai.tool.name}` | `spans-deprecated.yaml:610-612` |
| `operation: "inference"` | `gen_ai.inference.client` | `spans.yaml:171` |
| `usage.input_tokens` | `gen_ai.usage.input_tokens` | `registry-deprecated.yaml:577-646` |
| `usage.cache_read_input_tokens` | `gen_ai.usage.cache_read.input_tokens` | `registry-deprecated.yaml:594-621` |
| `usage.cache_write_input_tokens` | `gen_ai.usage.cache_write.input_tokens` | `changelog.d/440.breaking.md` |
| `model.provider` | `gen_ai.provider.name` | `registry-deprecated.yaml:65-160` |
| `cost.usd` | **karşılığı yok** | spec para taşımaz (§5.1) |

`model.provider` **serbest string**tir, kapalı enum değil. OTel'in kapalı
listesini takip etmek bizde gereksiz bakım yüküdür: sağlayıcı seti iç
kullanımda değişkendir ve listede olmayan bir sağlayıcı, kaydı yazılamayan
bir çağrı demektir. İ5 bunu bağımsız bir arıza olarak da gördü: RouteLLM'in
kapalı `MODEL_IDS` sözlüğünde olmayan model `KeyError` ile çöküyor
(`routers.py:235-236`).

Ayrıca `execute_tool` span'inin OTel tanımı MCP enstrümantasyonuna açıkça
atıf yapıyor (`spans-deprecated.yaml:612-614`) — Tool Registry'nin MCP
şemasını yeniden kullanma kararıyla (blueprint §3.3) aynı yöne bakıyor.

---

## 10. Kapanmayan yerler

Hiçbiri bu turda yapılmadı; yapılmış gibi de yazılmadı.

1. **Dışa aktarım katmanı yazılmadı.** `otel_map` çeviri tablosunu tanımlıyor
   ama span'i bir OTel toplayıcısına aktaran kod yok. Bugün iz, dosyaya
   yazılan JSON kaydıdır.
2. **Fiyat tablosu dosyası yok.** §5.2 prosedürü yazılı, `data/fiyat-tablosu.json`
   henüz yok. Bu belge onu bir sonraki maddenin işi olarak bırakıyor.
3. **90 günlük bayatlama eşiği ölçülmedi.** Sayı, "bir çeyrek" sezgisinden
   geliyor; hiçbir kaynak bunun için veri vermedi (hiçbiri prosedür
   belgelememişti). İlk üç ayda gözden geçirilmeli.
4. **`usage.extra` terfi kuralının altı aylık silme süresi de ölçülmedi.**
   Aynı sınıf zayıflık.
5. **Span hacmi ve saklama süresi kararı yok.** Bir koşu kaç span üretir,
   ne kadar tutulur — ölçüm olmadan yazılamaz. Blueprint §2.13 bu maliyeti
   zaten "eklediği maliyet" olarak kabul etmişti.
6. **Sayaç 2 (`mutant_yakalama_orani`) için benchmark seti yok.**
   04-DEGERLENDIRME §7.2 bunu zaten açık bırakmıştı; gözlem tarafı yalnızca
   sayacın nereden geleceğini söylüyor.
7. **İki OTel klonunun ayrımı makineyle doğrulanmadı** (§0). D3 ve D7'nin
   tazeleme alıntıları bu zayıflıkla işaretli.

---

## 11. Dürüstlük

Bu belge yeni kanıt üretmedi; kaynağı İ5 izinin beş belgesidir ve bu turda
hiçbir klona girilmedi, hiçbir `dosya:satır` yeniden doğrulanmadı.
Buradaki alıntıların güvenilirliği İ5 `DENETIM.md`'nin durumuna eşittir:
324 alıntının 213'ü doğrulanabildi, %85'i tuttu, **yanlış iddia
bulunmadı**, 32 adres hatası düzeltildi.

Kapatıldığı iddia edilen dört açık soru (İ5 OZET §6) gerçekten kapatıldı
mı: D4 span hiyerarşisini açık alana bağladı, D3 ajan/çağrı ayrımını
benimsedi, §5.2 fiyat tablosu prosedürünü yazdı, §7 terfi kuralını yazdı.
Beşinci soru — yönlendirme kararının hangi sinyale dayanacağı — bu belgenin
konusu değil, Model Router'ın işidir ve **açık kaldı**.

Bu belgede tanımlanan sekiz çapraz kontrolün sekizi de
`arac/sema-dogrula.js` içinde kodlanmış ve öz-testle sınanmıştır; §8'in
tablosu belgede kalan bir niyet beyanı değildir. Şemanın kendisinin
sınanmadığı tek yer, gerçek bir koşudan üretilmiş span kaydıdır — henüz
öyle bir koşu yok, örnekler elle yazıldı.
