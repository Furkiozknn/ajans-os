# En iyi fikirler ve desenler

*Faz 2 · 2026-09-08 · Kaynak: `docs/01-KARSILASTIRMA-MATRISI.md` (40 proje) +
altı iz özeti (`docs/arastirma/i1…i6/OZET.md`). Ölçüt:
`docs/adr/ADR-000-program-ve-ilkeler.md` **K2**.*

---

## 1. Yöntem — bir fikir buraya nasıl girdi

Bu belge yeni araştırma yapmaz; altı izin **kesişimini** çıkarır. Sıralama
ölçütü tektir ve protokol §4'ten gelir: *birden çok projede **bağımsız**
ortaya çıkan desen en güçlü sinyaldir.*

Bağımsızlık burada iki katmanda ölçüldü:

1. **Proje bağımsızlığı** — aynı deseni, birbirinden habersiz, farklı
   ekipler farklı dillerde üretmiş mi?
2. **İz bağımsızlığı** — desen yalnızca tek bir araştırma izinde mi
   çıktı, yoksa birbirine bakmayan izlerde (ör. bellek ve güvenilirlik)
   ayrı ayrı mı yüzeye vurdu?

İkinci katman ayırt edicidir. Tek izde altı proje aynı şeyi yapıyorsa bu
o alanın kültürü olabilir; **dört ayrı izde on iki proje aynı şeyi
yapıyorsa bu alanın kültürü değil, problemin şeklidir.** Sıralama buna
göre yapıldı.

Sonra her desene ADR-000 **K2** uygulandı — dört madde: (1) çözdüğü
problem, (2) önlediği hata, (3) eklediği maliyet, (4) kanıt (en az iki
olgun projede bağımsız **veya** bizzat yaşadığımız bir arıza). Dördünden
biri boşsa desen mimariye girmez, §4'teki **aday** listesinde bekler.

K2 uygulaması gerçekten eledi: aşağıda 13 desen geçti, **7 aday elendi**,
ve elenenlerin ikisi (izin sürüme bağlama, otomatik kabul kapısı) iz
özetlerinin doğrudan "alınmalı" diye önerdiği fikirlerdi. Ölçütün işi bu.

**Kanıt zinciri.** Buradaki her `dosya.py:satır` alıntısı ilgili iz
özetinden gelir; iz özetleri de klonlanmış depolardan. Bu belge kanıtın
üçüncü halkasıdır ve **yeni kanıt üretmez** — doğrulanmak istenen her
iddia, verilen iz dosyasından geriye izlenir.

---

## 2. Geçen desenler — özet tablo

| # | Desen | İz sayısı | Proje | K2 |
|---|---|---|---|---|
| D1 | İlerleme, adım sınırında kalıcılaştırılan kayıttır | **4** | 12 | geçti |
| D2 | Sağlayıcı sınırı incedir: seçim agnostik, taşıma özel | **3** | 15 | geçti |
| D3 | Yargı deterministik kaynaktan gelir; LLM eleştirir, karar vermez | **3** | 8 | geçti |
| D4 | İnsan kapısı, durum makinesinde birinci sınıf bir durumdur | **3** | 7 | geçti |
| D5 | Kaynak kayıt korunur; üzerine yazılmaz, dal açılır | **3** | 8 | geçti |
| D6 | Genişleme = bir dosya + bir kayıt satırı | **3** | 8 | geçti |
| D7 | Hata *türü* makine-okur bir alandır, hata *metninden* ayrıdır | 2 | 5 | geçti |
| D8 | Eleştiri, bir sonraki çağrının yapılandırılmış girdi alanıdır | 2 | 4 | geçti |
| D9 | Bağlam bütçesi bileşenlere bölünür; eşik %100'ün altındadır | 2 | 6 | geçti |
| D10 | Taşma hata değil, planlanmış faz geçişidir | 2 | 5 | geçti |
| D11 | Hata yolu güvenli tarafa düşer; "denetlenmedi" ≠ "temiz" | 2 | 4 | geçti |
| D12 | Varsayılan kapalı; sır ajana ulaşmaz, hedefe kapsamlanır | 1 | 3+1 | geçti |
| D13 | Retry'ın iki modu vardır: *düzelt* ve *temiz sayfa* | 2 | 3 | geçti |

"İz sayısı" = desenin kaç bağımsız araştırma izinde ayrı ayrı yüzeye
vurduğu. 3 ve üzeri **kalın**.

---

## 3. Desenler

### D1 — İlerleme, adım sınırında kalıcılaştırılan kayıttır

**En güçlü sinyal. Dört izde, on iki projede, dört farklı biçimde.**

| İz | Kanıt |
|---|---|
| İ1 | LangGraph `BaseCheckpointSaver` (`checkpoint/base/__init__.py:177`); OpenAI Agents SDK tam JSON-serileştirilebilir `RunState` (`run_state.py:1776-2256`); Mastra `stepResults`+`resumePath`; CrewAI `Crew.from_checkpoint` (`crew.py:432-480`); Dapr Agents `ctx.call_activity` sınırı (`durable.py:1479`) |
| İ4 | Üç zıt durum modeli, aynı amaç: tam snapshot (LangGraph `checkpoint/base/__init__.py:93-124`), event log + replay (Temporal `_workflow_instance.py:875-921`), adım-sonucu tablosu (DBOS `operation_outputs`, `_core.py:2551-2567`) |
| İ6 | OpenHands `EventLog` (`conversation/event_store.py:34`) + tail-replay (`state.py:344`); DGM `dgm_metadata.jsonl` append (`DGM_outer.py:326-331`); OpenEvolve `_save_checkpoint()` (`controller.py:422`); GEPA `GEPAState.save` (`core/state.py:405`) |
| İ2 | Letta bağlamdan tahliye edilen mesajı DB'de tutar (`letta_agent_v3.py:1218`) |

**Neden işe yarıyor.** Üç zıt uygulama (snapshot / event log / adım-sonucu
tablosu) tek bir soruyu cevaplamak için var: *"bu adım bu çalıştırmada
zaten bitti mi?"* Cevap kalıcı bir yerde yazılıysa süreç ölümü ilerlemeyi
yok etmiyor. Biçimler ayrışıyor, **ilke ayrışmıyor** — ve ayrışan biçimler
arasında seçim ölçütü de İ4'te net: durum büyük ve geçmişe atlanacaksa
snapshot; tam denetim izi birincilse event log; yalnızca "tekrar
çalıştırma" isteniyorsa adım-sonucu tablosu yeter ve en ucuzudur
(`_core.py:2551-2567` tek upsert + tek SELECT).

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Uzun bir gece koşusu ortasında süreç ölürse (bütçe, çökme, elektrik) yapılan iş yok olur. Somut: `gorevler/` kuyruğundaki bir görev 40 dakikada dört ajan çağrısı yapar; üçüncüde kesilirse ilk ikisi yeniden ödenir. |
| Önlediği hata | *Yeniden başlatma amnezisi*: tamamlanmış yan etkilerin tekrarı ve tamamlanmış token maliyetinin ikinci kez ödenmesi. |
| Eklediği maliyet | Her adım sınırında bir yazma (I/O + gecikme). Durumun serileştirilebilir olması zorunluluğu — canlı nesne tutan tasarımları yasaklar. Adım-sonucu tablosu seçilirse gövdenin yeniden çağrılabilir olması gerekir (§4/A4'teki determinizm yükümlülüğü). |
| Kanıt | 12 olgun proje, 4 bağımsız iz. Ayrıca kendi arızamız: `BILINEN-TUZAKLAR.md` #7 — bütçe duvarına toslayan beş görev yarıda kesildi. |

**Bizde nereye oturur.** *Task Manager* + *Recovery Manager*. İ4 Ö1'in
somut kararı doğrudan alınabilir: kayıt birimi **adım-sonucu tablosu**
(birincil anahtar = çalıştırma_id + adım_id), çünkü asıl durumumuz
(görev grafı, ajan çıktıları) zaten kalıcı dosyalarda yaşıyor. Ama
LangGraph'ın `put()` / `put_writes()` ayrımı korunur: superstep sonu
durumu ile görev bazlı ilerleme **ayrı** yazılır (`_runner.py:608-611`).

---

### D2 — Sağlayıcı sınırı incedir: seçim agnostik, taşıma sağlayıcıya özel

| İz | Kanıt |
|---|---|
| İ1 | LangGraph çekirdeğinde (`pregel/main.py`, `_loop.py`, `_algo.py`) sıfır sağlayıcı bağımlılığı; Strands `Model(abc.ABC)` (`models/model.py:181`) + 11 opsiyonel implementasyon; CrewAI `BaseLLM`; OpenAI SDK `MultiProvider` (`multi_provider.py:62`) |
| İ2 | Yedi projenin yedisinde de vektör/graf/KV adapter ailesi ve fabrika (LightRAG 14, cognee 6+3, mem0 ~20 uygulama) |
| İ5 | LiteLLM'in dört seçim stratejisi (`simple_shuffle.py`, `lowest_latency.py`, `lowest_cost.py`, `lowest_tpm_rpm_v2.py`) %100 provider-agnostik; 13.981 satırlık `router.py`'de sağlayıcıya özel dal 1-2 blok (`router.py:10323` Azure fiyat-anahtarı) |

**Neden işe yarıyor — ve İ5'in getirdiği inceltme.** İ1 ve İ2 sınırın
*varlığını* kanıtlıyor; İ5 sınırın **nereye çizileceğini** kanıtlıyor.
Sağlayıcıya özel katman hiç boşalmıyor — kavramlar zamanla çekirdeğe
terfi ediyor (OTel'de cache token'ları Anthropic'e özelken registry'ye
taşındı, `registry.yaml:301,308,374`) ama her yeni sağlayıcı yeni bir
kavram getiriyor, `model/openai/registry.yaml` ve
`model/aws-bedrock/registry.yaml` hâlâ duruyor. Doğru sınır şu: **seçim**
mantığı (hangi model/deployment) agnostik kalabilir ve kalmalı;
**taşıma/isimlendirme** (`api_base`, fiyat-anahtarı) sağlayıcıya özel
kalmaya mahkûmdur. Bunu gizlemeye çalışmak asıl ihlaldir — RouteLLM
çağrı katmanında `litellm.completion` kullanıp bağımsızlık iddia ederken
**karar** katmanına modül seviyesinde sabit bir istemci gömmüş
(`similarity_weighted/utils.py:11`).

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Sağlayıcı kilidi. Somut: bu makinede LiteLLM proxy iskeleti kuruldu ve anahtar bekliyor; sağlayıcı değişimi çekirdeği bozmamalı. |
| Önlediği hata | Bir sağlayıcının kotası/fiyatı/kesintisi tüm sistemi durdurması; ve sessiz sürüklenme — "bağımsızız" denip karar katmanında tek satıcıya bağlanma. |
| Eklediği maliyet | Bir soyutlama katmanı ve onun bakımı; sağlayıcıya özel yeteneklerin (yerel araç çağırma biçimleri) en küçük ortak paydaya inme riski. Ayrıca açık uçlu bir uzantı sözlüğü tutma yükü. |
| Kanıt | 15 proje, 3 bağımsız iz. Karşıt örnek de var ve öğretici (RouteLLM). |

**Bizde nereye oturur.** *Model Router* — ADR-000 K4'ün doğrulama ölçütü.
Sözleşme en az üç alan taşır (İ5 Ö2): (a) sağlayıcıya özel **taşıma
ayarı**, (b) **yetenek beyanı** (`text`/`vision`/`embedding`), (c) açık
uçlu **usage/cost sözlüğü** — ama bu sözlük *kalıcı çöp kutusu* değil,
**çekirdeğe terfi bekleyen alanlar için bekleme odası** olarak
tanımlanır. Ve İ1 Ö5'in testi zorunlu: bağımsızlık model + bellek/oturum
+ gözlem üçünde birden sınanır, çünkü OpenAI Agents SDK'nın model
katmanı gerçekten takılabilirken varsayılan tracing doğrudan
`api.openai.com/v1/traces/ingest`'e gidiyor (`tracing/processors.py:45`).

---

### D3 — Yargı deterministik kaynaktan gelir; LLM eleştirir, karar vermez

| İz | Kanıt |
|---|---|
| İ4 | Reflexion: geçti/kaldı kararını birim testleri veriyor (`programming_runs/reflexion.py:43`), LLM'e sorulan tek şey "neden başarısız oldun" (`py_generate.py:151`). Instructor: karar Pydantic `ValidationError`'ı. dspy: `Refine` bir `reward_fn` + sayısal eşik alıyor, LLM yalnızca `OfferFeedback` üretiyor |
| İ6 | DGM: `is_compiled_self_improve()` (`utils/evo_utils.py:96-126`) + ayrı eşik fonksiyonu `get_full_eval_threshold` (`DGM_outer.py:192-215`); OpenEvolve `_is_better` (`database.py:292`); GEPA `new_sum > old_sum` (`strategies/acceptance.py:49`) |
| İ2 | Yazma kararını LLM verir ama doğrulama kod tarafındadır: şema doğrulaması, deterministik id ile idempotency (cognee `id_for()`, mem0 md5), LLM'e kısa yerel id verip halüsinasyonu kesme (`main.py:933-938`) |

**Neden işe yarıyor.** Sekiz proje, üç iz, tek refleks: **LLM'i kendi
çıktısının yargıcı yapmamak.** LLM *eleştirmen*dir (Critic), *değerlendirici*
(Evaluator) değil. Karşıt kanıt da net ve aynı yöne bakıyor: TextGrad
kabul/ret mekanizması bile kurmamış, üretilen metni doğrudan
`parameter.set_value(new_value)` ile uyguluyor (`optimizer.py:186`) —
ve TextGrad 410 gün donmuş, güvenilirlik puanı 1.

İ6 ayrıca deseni bir adım inceltiyor: kapı **iki ayrı testtir** ve tek
bir "başarılı" bayrağına indirgenmez — "geçerli mi" (derlendi/şema tuttu)
ile "yeterince iyi mi" (eşiği aştı) ayrı fonksiyonlarda tutulur.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | LLM-as-judge tuzağı: modelin kendi çıktısını onaylaması. Somut: gece çalışan bir görev kendini "bitti" işaretler, doğrulama yapılmamıştır. |
| Önlediği hata | *Sahte yeşil* — geçmemiş işin geçmiş sayılması, ve ölçülemeyen kalite sürüklenmesi. |
| Eklediği maliyet | Her değerlendirilebilir çıktı için deterministik bir doğrulayıcı yazma yükü (şema, test, çıkış kodu, eşik). Doğrulayıcısı olmayan çıktı türü için desen uygulanamaz — o durumda "değerlendirilmedi" yazmak gerekir. |
| Kanıt | 8 proje, 3 bağımsız iz. Kendi arızamız: `BILINEN-TUZAKLAR.md` #7 — görev "bitti" işaretini koyup doğrulamayı yapamadan kesildi. |

**Bizde nereye oturur.** *Evaluator* ve *Critic* **iki ayrı bileşen**
olur (`docs/mimari/04-DEGERLENDIRME.md`). Evaluator deterministik
kaynaklardan beslenir ve geçme kararını tek başına verir; Critic bir
LLM'dir ve **oyu geçme kararına girmez**, yalnızca "neden başarısız oldu,
sonraki denemede ne yapılmalı" yazar. Kapı, İ6'nın inceltmesiyle iki
fonksiyondur: `gecerli_mi()` ve `esigi_asti_mi()`.

---

### D4 — İnsan kapısı, durum makinesinde birinci sınıf bir durumdur

| İz | Kanıt |
|---|---|
| İ1 | LangGraph `interrupt()` / `GraphInterrupt` (`types.py:851`, `errors.py:102`); Mastra suspend/resume; Dapr Agents `wait_for_external_event` + timer yarışı (`durable.py:1196-1288`) |
| İ3 | A2A `TASK_STATE_AUTH_REQUIRED` ayrı bir enum değeri ve "interrupted state" olarak belgelenmiş (`a2a.proto:206-207`), `INPUT_REQUIRED`'dan **ayrı**; LlamaFirewall `ALLOW`/`BLOCK`/`HUMAN_IN_THE_LOOP_REQUIRED` üç değerli enum (`llamafirewall_data_types.py:22-25`) |
| İ6 | OpenHands pluggable `ConfirmationPolicy`; Aider `confirm_ask` varsayılan açık |

**Neden işe yarıyor.** İki ayrı içgörünün birleşimi. Birincisi (İ1):
onay **bloke eden bir girdi çağrısı değildir** — durum kalıcılaştırılır,
süreç ölebilir, akış dış bir olayla canlanır. Gece çalışan bir sistem
için bu belirleyici: onay bekleyen bir akış süreci saatlerce canlı
tutamaz. İkincisi (İ3): "bilgi eksik" ile **"yetki eksik" farklı
durumlardır**; A2A bunları bilinçle ayırmış. CrewAI'nin terminal tabanlı
`human_input` döngüsü (`core/providers/human_input.py`) bu desenin ilkel
hâli — ve tam olarak headless koşuda çalışmayan hâli.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Geri alınamaz/dışarı açılan bir işlem onay bekliyor ama insan uykuda. Somut: `raporlar/ONAY-BEKLEYENLER.md` akışımızın tam kendisi. |
| Önlediği hata | İki yönlü: (a) onaysız dış eylem, (b) onay beklerken sürecin canlı tutulması ve bütçe/zaman yakması. |
| Eklediği maliyet | Her onay noktası bir kalıcılaştırma + bir uyanma yolu demek. Akış gecikmesi insan hızına iner. Durum makinesi büyür (en az iki yeni durum: `GIRDI_BEKLIYOR`, `ONAY_BEKLIYOR`). |
| Kanıt | 7 proje, 3 bağımsız iz — biri protokol katmanında (A2A), biri guardrail kütüphanesinde, beşi çalışma zamanında. Ayrıca ADR-000 K6 zaten bu kararı taşıyor. |

**Bizde nereye oturur.** *Task Manager* durum makinesi + *Permission
Manager*. Somut kararlar: `ONAY_BEKLIYOR` **kesintili** bir durumdur ve
`GIRDI_BEKLIYOR`'dan ayrıdır (`a2a.proto:206-207`); onay isteği zincir
boyunca **yukarı delege edilebilir** (`specification.md:1945-1947`) —
alt-ajan insana ulaşamadığı için üst-ajan kendi görevini de onay bekler
duruma geçirip isteği taşır; ve kapı, İ6 AP1'in tersi olarak, tek bir
config bayrağıyla kapatılamaz (Aider `--yes-always`, OpenHands
`NeverConfirm`).

⚠ **Bilinen kusur, tasarlanacak.** LangGraph'ta onay sonrası düğüm
**baştan** çalışıyor (`types.py:864`), yani onay öncesi yapılmış yan
etkiler tekrarlanabiliyor. Kapının yan etki sınırıyla ilişkisi bizde
açıkça çözülmeli — D1 ile birlikte.

---

### D5 — Kaynak kayıt korunur; üzerine yazılmaz, dal açılır

| İz | Kanıt |
|---|---|
| İ2 | Yedi projenin yedisi ham veri ile türetilmiş belleği ayırıyor ve arada **kaynak referansı** var (`source_id`, `attributed_to`, `reference_id`). Letta: kesilen bağlam özetlenir, ham mesaj DB'de kalır (`letta_agent_v3.py:1218`). graphiti: çelişen kenar silinmez, `invalid_at`/`expired_at` set edilir (`edge_operations.py:538-573`) |
| İ4 | LangGraph zaman yolculuğunda eski checkpoint'i **silmiyor**, yeni bir dal açıyor (`_loop.py:960-971`, `{"source": "fork"}`; `CheckpointMetadata.parents`, `base/__init__.py:57-61`) |
| İ6 | Append-only kalıcılık: OpenHands olay başına ayrı dosya, DGM `jsonl` append, GEPA state |

**Neden işe yarıyor.** Üç izde aynı refleks: **yıkıcı yazma yasak.**
Karşıt kanıt bu deseni pozitif kanıttan daha güçlü savunuyor — LightRAG
özetleme sırasında orijinal açıklamaları LLM özetiyle *değiştiriyor* ve
özet yanlışsa graf tarafında geri dönüş yok (İ2 AP6). Aynı yerde ikinci
bir karşıt: mem0 v2'nin append-only'si bu desenin **yanlış** uygulaması —
"Ali vegan" ve "Ali et yiyor" yan yana saklanıyor ve hangisinin geçerli
olduğu okuma anında çözülmüyor (`prompts.py:472`). Yani doğru ilke
"her şeyi sakla" değil: **kaynak korunur + hangi kaydın hangisini
geçersiz kıldığı yazılır + okuma anında geçerli olan seçilir.**

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Türetilmiş bir kayıt (özet, çıkarım, düzeltme) yanlışsa geri dönülecek bir yer olmaması. Somut: bir gece koşusunun bellek yazımı hatalıysa sabah düzeltilebilmeli. |
| Önlediği hata | *Geri döndürülemez sıkıştırma* ve *sessiz bilgi kaybı*; ayrıca "bu bilgi belleğe nasıl girdi" sorusunun cevapsız kalması. |
| Eklediği maliyet | Depolama büyür ve hiç küçülmez. Okuma yolu karmaşıklaşır: her sorgu "geçerli olanı seç" filtresini geçmek zorunda. Gerçek silme (uyum/PII) ayrı ve bilinçli bir mekanizma gerektirir — çünkü varsayılan artık silmemek. |
| Kanıt | 8 proje, 3 bağımsız iz; ayrıca iki öğretici karşıt örnek (LightRAG AP6, mem0 A1). |

**Bizde nereye oturur.** *Memory Manager* + *Recovery Manager*.
graphiti'nin bi-temporal modeli alınır (`valid_at`/`invalid_at` olay
zamanı, `created_at`/`expired_at` sistem zamanı, `edges.py:271-282`) —
en azından her kayıtta "hangi kaydı geçersiz kılıyor" alanı zorunlu.
Uyarı: graphiti'de bile varsayılan `search()` filtre uygulamıyor;
**bizde varsayılan güvenli taraf** (yalnızca geçerli) olur, geniş sorgu
açıkça istenir. Recovery tarafında LangGraph'ın fork deseni rollback'in
yerine geçen birincil desendir: eskiyi silme, yeni dal aç — hem
denetlenebilir, hem "birden fazla alternatifi paralel dene" senaryosunu
bedava veriyor.

⚠ **Sınır.** Bu desen "sil"i yasaklamaz, **varsayılanı** değiştirir.
mem0'ın hatası tekrarlanmaz: sildiği anının metnini `history.old_memory`
içinde bırakması (`main.py:2113-2122`) ve `expiration_date`'in yalnızca
görünürlük filtresi olması (`main.py:442`) uyum açısından "TTL var"
demeyi imkânsız kılıyor. Denetim kaydı **içerik değil, içerik hash'i +
kaynak referansı** tutar.

---

### D6 — Genişleme = bir dosya + bir kayıt satırı

| İz | Kanıt |
|---|---|
| İ6 | OpenHands: subagent eklemek tek Markdown dosyası + `register_agent_if_absent` (`tools/preset/default.py:141-166`), Python'a dokunulmuyor. SWE-agent: `tools/<isim>/config.yaml` + `bin/<script>` + `config/default.yaml:41-44`'te tek satır (`tools/bundle.py:14-17`). Aider: `Coder` alt sınıfı + format sabiti |
| İ1 | Matris liderleri (LangGraph, OpenAI Agents SDK, Strands, GEPA) tek ortak noktada buluşuyor: uzatma noktası **tip/protokol** ile tanımlı, alt sınıflama ile değil |
| İ2 | Yedi projenin yedisinde adapter fabrikası; depolama arkası çoklu, çekirdek algoritma tekil |

**Neden işe yarıyor.** Genişletilebilirlik matriste ortalaması yüksek
(3,71) ve liderleri belli olan tek eksen — çünkü çözülmüş bir problem.
Karşıt kanıt yine güçlü: İ1'in en yaygın anti-pattern'i (A1, beş projede)
"tanrı nesnesi" — Mastra `agent.ts` 10.026 satır, Dapr `durable.py` 4.353
satır, CrewAI `crew.py` 2.490 satır (araç enjeksiyonu + checkpoint +
bellek + yürütme aynı sınıfta). Genişleme noktası dar tanımlanmazsa
çekirdek şişiyor ve bileşen izole test edilemiyor.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Yeni bir ajan/araç eklemek için çekirdeğe dokunmak zorunda kalmak. Somut: `turkce-ajanlar`'a ajan eklerken `arac/web-uret.js`, `arac/banner-uret.js`, `kur.ps1` türetilmiş dosyalarının hepsi yenilenmek zorunda — kayıt tek yerdeyse bu üretim otomatik. |
| Önlediği hata | *Çekirdek çürümesi*: her yeni özelliğin merkezi dosyayı büyütmesi ve bileşenin tek başına test edilemez hâle gelmesi. |
| Eklediği maliyet | Kayıt defteri (registry) bileşeni ve onun tutarlılık doğrulaması. Uzatma noktası bir kez yanlış tanımlanırsa sonradan değiştirmek tüm eklentileri kırar. |
| Kanıt | 8 proje, 3 bağımsız iz; ayrıca 5 projede karşıtının (tanrı nesnesi) kanıtlı zararı. |

**Bizde nereye oturur.** *Agent Registry* + *Tool Registry*. K8'in
doğrudan uygulanışı: kaynak sözleşme (`contracts/agent.schema.json`)
tek dosya, ev sahibi biçimleri (Claude Code `.md` frontmatter vb.) ondan
**türetilir**. Ama İ1 A2'nin uyarısı: Dapr Agents'ta `OrchestrationStrategy`
ABC beş zorunlu metotla tanımlı (`strategy.py:33`), en gelişmiş strateji
mantığının çoğunu sözleşme dışına taşımış ve bunu kendi docstring'i
itiraf ediyor (`agent_strategy.py:22-23`). **Sözleşmenin varlığı uyum
demek değil; uyum test edilmeli.**

---

### D7 — Hata *türü* makine-okur bir alandır, hata *metninden* ayrıdır

| İz | Kanıt |
|---|---|
| İ4 | Üç farklı taşıyıcı, aynı fikir: statik liste (LangGraph `default_retry_on()`, `_internal/_retry.py:1-29` — `ValueError`/`TypeError`/`SyntaxError` retry edilmiyor, ağ hataları ediliyor); istisna alanı (Temporal `ApplicationError.non_retryable`, `exceptions.py:132,159-166`); config (Portkey `onStatusCodes`, `handlerUtils.ts:663-693`) |
| İ5 | model-comparison-harness `error_type` ayrı alan (`runner.py:22-26`); LiteLLM `_is_cooldown_required` (`cooldown_handlers.py:205-251`) 429/401'i anında cooldown'a alıyor, diğer 4xx'i almıyor, 5xx'i oran bazlı değerlendiriyor |

**Neden işe yarıyor.** Beş proje, iki iz, tek soru: *"denemekle düzelir
mi?"* Kör retry programlama hatasını N kez tekrarlar ve rate-limit'i
kötüleştirir. Ayrımın nerede tutulacağı ayrışıyor ve İ4'ün gerekçeli
seçimi net: **hata nesnesinde** — statik liste kütüphane sınırlarında
eskir, config kullanıcıya yük bindirir.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Retry'ın hangi hatada anlamlı olduğunu bilmemek. Somut: bir ajan çağrısı 429 aldıysa beklemek gerekir; `SyntaxError` aldıysa beklemek işe yaramaz, üç kat maliyet çıkarır. |
| Önlediği hata | *Kör retry* — programlama hatasının N kez tekrarı ve rate-limit'in kötüleştirilmesi. |
| Eklediği maliyet | Her hata üreten bileşen sınıflandırma yapmak zorunda; sınıflandırılmayan hata için bir varsayılan (güvenli taraf: retry etme) kararı gerekir. |
| Kanıt | 5 proje, 2 bağımsız iz. |

**Bizde nereye oturur.** ADR-000 **K5**'in `failure_modes` sözleşmesi:
hata türü **serbest metin `message`'dan ayrı, makine-okur bir alan**
olarak tanımlanır (İ5 Ö5). Taşıyıcı Temporal'ın yolu — bayrak hata
nesnesinde. *Recovery Manager* ve *Model Router* (cooldown) aynı alandan
okur.

---

### D8 — Eleştiri, bir sonraki çağrının yapılandırılmış girdi alanıdır

| İz | Kanıt |
|---|---|
| İ4 | dspy: eleştiri `hint_` adında yeni bir **girdi alanı** olarak sinyatüre ekleniyor. instructor: `reask_handler(kwargs, response, exception)` `ValidationError` metnini tool-call'a bağlı mesaj olarak enjekte ediyor. Reflexion: `format_reflections()` sabit başlıkla birleştiriyor (`hotpotqa_runs/agents.py:114`, başlık `prompts.py:113`) |
| İ6 | Aider: malformed edit `ValueError` yakalanıp ham hata metni `self.reflected_message` olarak modele geri veriliyor (`base_coder.py:2305-2316`), üst sınır `max_reflections=3` (`base_coder.py:100-101,939-940`) |

**Neden işe yarıyor.** D3'ün tamamlayıcısı: yargı deterministik
kaynaktan geldikten sonra, o yargının **modele nasıl ulaşacağı** ayrı bir
tasarım kararı. Dört proje aynı cevabı vermiş: log'a yazma, prompt'a
alan olarak ekle. Reflexion prompt'u nasıl yazılacağını da gösteriyor —
eleştiri *geçmişin analizi* olarak değil, *geleceğin talimatı* olarak
biçimlendiriliyor: "you will need this as a hint when you try again
later" (`py_generate.py:12`, `:151`). Aider'ın katkısı üst sınır:
`max_reflections=3` sonsuz döngü riskini koda gömüyor.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Doğrulayıcının bulduğu hatanın modele ulaşmaması veya serbest metin olarak ulaşıp göz ardı edilmesi. |
| Önlediği hata | *Aynı hatanın tekrarı* — düzeltme sinyali taşınmadığı için retry'ın kör retry'a dönüşmesi. |
| Eklediği maliyet | Girdi şeması her düzeltme turunda büyür → token maliyeti. Üst sınır konmazsa sonsuz döngü. İ4 §4.3'ün anti-pattern'i tam burada: Reflexion `self.reflections += [...]` (`agents.py:113`) hiç budamıyor, maliyet deneme sayısıyla doğrusal büyüyor — üstelik tam da işlerin kötü gittiği anda. |
| Kanıt | 4 proje, 2 bağımsız iz. |

**Bizde nereye oturur.** *Critic* çıktısının biçimi. Serbest metin
değil, `contracts/message.schema.json` içinde tanımlı bir alan; bir
sonraki ajan çağrısının girdi sözleşmesine eklenir. Üst sınır
sözleşmede zorunlu (Aider'ın `max_reflections`'ı), biriken eleştiri D9
bütçe dağıtımına tabi.

---

### D9 — Bağlam bütçesi bileşenlere bölünür; eşik %100'ün altındadır

| İz | Kanıt |
|---|---|
| İ2 | graphrag: `max_context_tokens=8000` + `community_prop`/`local_prop`/`text_unit_prop` alt bütçeleri (`mixed_context.py:175-208`). LightRAG: `max_total_tokens` − (sistem promptu + graf + sorgu + 200 tampon) (`operate.py:5864`). LlamaIndex: `token_limit` × `chat_history_token_ratio` (0.7) (`memory.py:205-216`). Letta: `SUMMARIZATION_TRIGGER_MULTIPLIER = 0.9` ve yaklaşık sayaçta `APPROX_TOKEN_SAFETY_MARGIN = 1.3` |
| İ4 | Karşıt kanıt: ajan/LLM katmanı projelerinde bütçe **yok** — Reflexion ve instructor'da mesaj listesi denemeler arası sınırsız büyüyor, token bütçesi veya pencere yönetimi bulunamadı (§4.3) |

**Neden işe yarıyor.** Bağlamı ciddiye alan dört proje aynı çözümü
bağımsız buldu: toplam bütçeyi bileşenlere böl, her bileşeni kendi payı
içinde kırp. Aynı ekosistemde iki olgunluk seviyesi görünüyor: cognee ve
mem0 yalnızca **adet** sınırı (`top_k`) kullanıyor ve ikisinde de token
sayan tek satır yok. İkinci parça eşiktir: hiçbiri "pencere dolduğunda"
değil, **"dolmadan önce"** davranıyor.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bağlam penceresinin sessizce taşması veya sessizce kalite kaybetmesi. Somut: bu makinede bir görev dosyası + tuzak listesi + iz özetleri aynı prompt'a giriyor; hangisinin kırpılacağı önceden yazılı olmalı. |
| Önlediği hata | *Sessiz bağlam taşması* (İ2 AP1: cognee `resolve_edges_to_text.py:61-97` kırpma yapmıyor; mem0 proxy dönen bütün anıları mesaja yapıştırıyor, `proxy/main.py:176-186`) ve *sessiz kalite düşüşü*. |
| Eklediği maliyet | Token sayımı her çağrıda yapılır. Yaklaşık sayaç kullanılırsa güvenlik payı gerekir (Letta %30) ve pay boşa harcanan penceredir. Kesin sayım her sağlayıcı için ayrı tokenizer bağımlılığı demek — K4 ile gerilimli. |
| Kanıt | 4 olgun proje aynı formülü bağımsız buldu (İ2), 2 proje yokluğunun zararını gösterdi (İ4). |

**Bizde nereye oturur.** *Context Manager*'ın **çekirdeği**, `top_k`
değil. LightRAG'in formülü doğrudan alınır:
`kalan = toplam − (sistem sözleşmesi + görev durumu + bilgi + sorgu + tampon)`.
İki inceltme zorunlu: (a) bütçe **gerçekten render edilecek şablonla**
ölçülür (`operate.py:5802-5813`) — tahmini şablonla ölçmek sessizce
yanlış hesaplar; (b) taşmada **kısılma sırası önceden yazılır**: sistem
sözleşmesi > görev durumu > bilgi katmanı > geçmiş.

---

### D10 — Taşma hata değil, planlanmış faz geçişidir

| İz | Kanıt |
|---|---|
| İ2 | Letta: `ContextWindowExceededError` yakalanır, kesim noktası bulunur, kesilen kısım **daha ucuz** bir özetleyici modelle özetlenir, ham mesajlar DB'de kalır (`letta_agent_v3.py:1218`). LlamaIndex: eşiği aşınca `token_flush_size` kadar tahliye. LightRAG: açıklama şişince map-reduce özetleme (`operate.py:373-470`). graphrag: bütçeye sığmayan community'ler ayrı batch'lere bölünüp map-reduce ile sorgulanır |
| İ6 | Aynı refleks kod ajanlarında: hata sınıfı sessiz çökme değil, **otomatik ve güvenli çıkış** — SWE-agent `handle_error_with_autosubmission` (`agents.py:1076-1216`) bütçe aşımını, ardışık timeout'u ve sınıflandırılmamış `except Exception`'ı bile ayrı yakalayıp elindeki son yamayla teslim ediyor; OpenEvolve hata veren adayı en kötü skorla işaretliyor (`evaluator.py:265`) |

**Neden işe yarıyor.** Dört bellek projesi ve iki kod ajanı, farklı
kaynak sınırları için (token / bütçe / zaman) aynı ilkeyi bulmuş:
**sınıra çarpmak beklenen bir olaydır ve planlanmış bir davranışı
tetikler.** SWE-agent'ın bütçe aşımında elindeki son yamayı otomatik
teslim etmesi, bizim `BILINEN-TUZAKLAR.md` #7'de tarif ettiğimiz arızanın
tam çözümüdür.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bir kaynak sınırına (token, bütçe, süre) çarpıldığında yapılmış işin kaybolması. Somut: 6 USD bütçe dolduğunda süreç anında ölüyor ve yazılmamış her şey gidiyor. |
| Önlediği hata | *Sıfır çıktılı kesilme* — İ5 turlarında yaşandı: dört paralel alt ajan bütçenin %90'ını yaktı, özet yazılamadı. |
| Eklediği maliyet | Her sınır için bir tahliye/teslim yolu yazmak ve onu test etmek. Özetleme kayıplıdır; ucuz model kullanılırsa kalite düşer. |
| Kanıt | 5 proje, 2 bağımsız iz. Ve kendi arızamız (`BILINEN-TUZAKLAR.md` #7, #15). |

**Bizde nereye oturur.** *Context Manager* (token taşması) ve *Cost
Manager* (bütçe taşması) aynı ilkeyi paylaşır. Letta'nın modeli alınır:
eşik aşılınca kesim noktası bul, kesileni **daha ucuz bir modelle**
özetle, özeti bağlama koy, **ham kaydı sakla** (D5). LightRAG'in yaptığı
gibi orijinali atma. Bütçe tarafında SWE-agent'ın autosubmission'ı
doğrudan uygulanır: bütçe eşiği aşıldığında elindeki kısmi çıktı yazılır
ve durum "yarım kaldı" olarak işaretlenir — "bitti" olarak değil.

---

### D11 — Hata yolu güvenli tarafa düşer; "denetlenmedi" ≠ "temiz"

| İz | Kanıt |
|---|---|
| İ3 | LlamaFirewall: denetleyici çağrısı başarısız olursa sonuç `ALLOW` değil `HUMAN_IN_THE_LOOP` (`alignmentcheck_scanner.py:125-131`). mcp-vet: `Severity.NOT_FLAGGED` bilerek `SAFE` diye adlandırılmamış — "never concludes that something is safe, only that a given check did not fire" (`models.py:34-40`); çalıştırılamama ayrı çıkış kodu (`risk.py:35` `EXIT_ERROR = 4`) |
| İ5 | Karşıt/pozitif çift: nvidia-nim-mcp `check_provider_health` (`:669`) sonucu zincir sırasını **etkilemiyor** — sağlık sinyali üretilip atılıyor; LiteLLM'de tam tersi, cooldown sinyali doğrudan sağlıklı-dağıtım filtresine besleniyor (`cooldown_handlers.py:520`, `router.py:146-150`) |

**Neden işe yarıyor.** İki iz, dört kaynak, tek refleks: **bir sinyalin
yokluğu olumlu sinyal değildir.** İ3'te bu güvenlik kararında, İ5'te
yönlendirme kararında ortaya çıkıyor — aynı hata sınıfının iki yüzü.
İ3'ün AP6'sı bunu en keskin ifade ediyor: "denetlenmemiş boyutu sessizce
onaylanmış saymak, izin katmanının en sinsi kaçağıdır".

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bir kontrolün çalışmaması ile kontrolün temiz sonuç vermesinin aynı görünmesi. Somut: gece koşusunda bir doğrulama adımı hata verirse görev "doğrulandı" sayılmamalı. |
| Önlediği hata | *Sessiz izin* — kontrol edilmemiş bir işlemin onaylanmış gibi geçmesi. |
| Eklediği maliyet | Üçüncü bir değer ("bilinmiyor") her karar noktasına girer; iki değerli mantıkla yazılmış her çağıran kod bunu ele almak zorunda. İnsan kapısına düşen çağrı sayısı artar → gece otonomisi azalır. |
| Kanıt | 4 kaynak, 2 bağımsız iz; biri güvenlik, biri ekonomi/yönlendirme — desenin alana özgü olmadığının kanıtı. |

**Bizde nereye oturur.** *Permission Manager* ve *Model Router*.
`permission.schema.json` şu ayrımı taşır: "kontrol edilmedi" ile
"kontrol edildi, temiz" **ayrı değerlerdir** (`models.py:34-40`); karar
üç değerlidir (`ALLOW`/`BLOCK`/`HUMAN_REQUIRED`,
`llamafirewall_data_types.py:22-25`); ve şiddet ile güvenilirlik **ayrı
eksenlerdir**, tek bir "risk skoru" alanı **olmaz** (`mcp_vet/models.py:9-16`;
genel karar alanların en kötüsü, ortalaması değil — `risk.py:3-7`).
Router tarafında sağlık sinyali üretilip atılmaz, filtreye beslenir.

---

### D12 — Varsayılan kapalı; sır ajana ulaşmaz, hedefe kapsamlanır

| İz | Kanıt |
|---|---|
| İ3 | microsandbox: ağ erişimi sandbox oluşturma çağrısının **imzasında** (`allowed_hosts`/`allowed_ports`, `README.md:211-214`), ayrı bir config dosyasında değil; her sır tek bir hedefe bağlı (`README.md:216-219`). A2A: in-band kimlik bilgisi zincirdeki her ajana açılır, bu yüzden kimlik bilgisi "isteği başlatan ajana bağlanmalı ki yalnızca o kullanabilsin" (`specification.md:1961-1962`); SSRF için reddedilecek IP aralıkları tek tek sayılmış (`:3122-3125`). MCP: `roots` mekanizması aynı fikrin dosya sistemi karşılığı |
| İ2 | Karşıt kanıt: **scope'u yetki sınırı sanmak** — mem0 REST katmanında doğrulanmış kimlik ile gövdedeki `user_id` karşılaştırılmıyor (`server/main.py:368-375`); LightRAG varsayılan kurulumda guest moduna düşüp varsayılan JWT gizli anahtarını kullanıyor (`api/auth.py:57-63`). **Etiket ≠ yetki.** |

**Neden işe yarıyor.** Hipervizör katmanı (microsandbox) ile protokol
katmanı (A2A) birbirine bakmadan aynı ilkeye varmış: ajan **sırra değil
yeteneğe** sahip olur. Ajan "şu hedefe şu isteği yap" yeteneğini alır;
anahtarı izin kapısı enjekte eder ve anahtar tek bir hedefe kapsamlanır.
Bu, sabit sınırımızı ("ajan kimlik bilgisi girmez") bir adım ileri
taşıyor: ajan onu **görmez** bile.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bir ajanın, kendisine verilmiş geniş bir kimlik bilgisiyle amaçlanmayan bir hedefe erişmesi. Somut: bu makinede `gh` CLI tam yetkili ve bir PAT dolaşımda; ajanın onu görmesi ile "şu depoya şu isteği yap" yeteneğini alması aynı şey değil. |
| Önlediği hata | *Yetki sızması* — iyi niyetli ajanın geniş yetkiyle yanlış şeyi hızlıca yapması (ADR-000 K6 gerekçesi) ve kimlik bilgisinin ajan zincirinde yayılması. |
| Eklediği maliyet | Sır enjeksiyon mekanizması yazmak gerekir; tek makinede (KVM yok, Windows) hipervizör yolu kapalı olduğu için proxy süreç veya ayrı kullanıcı hesabı tasarlanmalı. Her izin kapsamlı istendiği için sözleşmeler uzar. |
| Kanıt | 3 olgun kaynak bağımsız (A2A olgunluk 5, MCP 5, microsandbox 3) + 2 projede yokluğunun kanıtlı zararı (İ2 AP3). |

**Bizde nereye oturur.** *Permission Manager*. Varsayılan izin salt
okuma; yazma/çalıştırma/ağ sözleşmede açıkça ve **kapsamlı** istenir
(hangi yol, hangi alan adı) — ADR-000 K6 zaten böyle yazılmış, bu desen
onu kanıtla besliyor.

⚠ **Tek izde çıktı.** Diğer 12 desenden farklı olarak bu desen yalnızca
İ3'te yüzeye vurdu; İ2'nin katkısı karşıt kanıt. İz bağımsızlığı zayıf
ama proje bağımsızlığı güçlü (biri protokol, biri hipervizör, biri
protokol — üç ayrı katman). K2 kanıt maddesi "en az iki olgun projede
bağımsız" diyor; bu sağlanıyor.

⚠ **Doğrulanmamış kanıt.** microsandbox'ın "sırlar VM'e hiç girmez"
iddiası yalnızca `README.md:38`'den okundu; protokol §1 "README
pazarlamadır" kuralı gereği **doğrulanmamış** sayılıyor (İ3 §8). Bu
iddia mimarinin varsayımı olacaksa önce kodda doğrulanmalı.

---

### D13 — Retry'ın iki modu vardır: *düzelt* ve *temiz sayfa*

| İz | Kanıt |
|---|---|
| İ4 | Reflexion: iç döngü bağlamı taşıyarak düzeltiyor (`reflexion.py:57-90`), dış döngü `pass_at_k` ile sıfırdan yazıyor (`:33-91`) — **ikisi ayrı parametre**. Temporal: aktivite retry'ı (ucuz, durumu koru) ile workflow retry'ı (pahalı, baştan) bilinçli olarak farklı (`client/_client.py:574-584`) |
| İ6 | Aider'ın `max_reflections=3`'ü *düzelt* modunun üst sınırı; sınır aşılınca akış sonlanıyor, sonsuz düzeltmeye girmiyor (`base_coder.py:100-101,939-940`) |

**Neden işe yarıyor.** Yansımalı/bağlamlı retry **yerel minimuma
saplanabilir**: model kendi hatalı çerçevesini taşıyarak tekrar tekrar
aynı yanlışı yapar. Çıkış bir deneme daha değil, **sıfırlanmış** bir
denemedir. İki bağımsız proje (biri araştırma prototipi, biri üretim
altyapısı) bunu ayrı parametre olarak modellemiş.

**K2:**

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Düzeltme döngüsünün aynı hatayı üç kez tekrarlayıp bütçe yakması. |
| Önlediği hata | *Yerel minimum kilitlenmesi* ve buna bağlı doğrusal maliyet artışı. |
| Eklediği maliyet | İki ayrı sayaç ve iki ayrı politika alanı; "temiz sayfa" modu tüm bağlamı attığı için daha pahalıdır ve ne zaman tetikleneceği ayarlanmalıdır. |
| Kanıt | 3 proje, 2 bağımsız iz. Kanıt eşiği diğer desenlerden düşük — sınırda geçti. |

**Bizde nereye oturur.** *Recovery Manager*. D7 ile birlikte: hata türü
hangi modun kullanılacağını belirler. Ek olarak İ4 §3.4'ün ölçümü
uygulanır — **backoff + jitter varsayılan açık**. Ajan/LLM katmanı
projelerinin hiçbirinde backoff yok (instructor'da `wait_*` hiç import
edilmemiş), altyapı katmanındakilerin hepsinde var (LangGraph
`types.py:418-437`: `initial_interval=0.5`, `backoff_factor=2.0`,
`max_interval=128.0`, `jitter=True`). Bu bir olgunluk farkı, tasarım
tercihi değil.

---

## 4. K2'den geçemeyenler — aday listesi

Bu fikirler mimariye **girmez**. Her biri için hangi K2 maddesinin boş
olduğu ve **ne olursa geçeceği** yazılıdır. Faz 3'te kanıt gelirse
yeniden değerlendirilir.

### A1 — İzin, bileşenin sürümüne/içerik özetine bağlanır

*İ3 D3.* mcp-vet `diff.py:3-8`: "The most dangerous MCP update is not the
one that arrives malicious. It is the one that was fine at v1.2.0, got
read and approved, and quietly grew shell execution at v1.3.0." Snyk
Agent Scan aynı sonuca farklı yoldan varmış: tek seferlik tarama yerine
kalıcı çalışma zamanı hook'u (`guard.py:1`, `hooks/snyk-agent-guard.{sh,ps1}`).

| K2 | Durum |
|---|---|
| Problem | ✅ Onay verildikten sonra bileşenin değişmesi. |
| Önlediği hata | ✅ *Onay sonrası sürüklenme*. |
| Maliyet | ⚠ Sürüm mü içerik özeti mi belirsiz; mcp-vet git ref karşılaştırmasının kaçırdığı vakayı kendisi kabul ediyor (`diff.py:15-21`). |
| **Kanıt** | ❌ **İki bağımsız araç var ama biri (mcp-vet) kullanıcının kendi deposu: 0 yıldız, olgunluk 2, sıfır dış kullanım.** Matris yorumu bunu açıkça kurala bağlamış: kullanıcının kendi depoları "tasarım örneği olarak alınabilir, kanıt olarak alınamaz". Geriye tek olgun kaynak kalıyor. |

**Neden buraya düştü.** İ3 özeti bu maddeyi K6'ya eklenecek bir karar
olarak öneriyordu. K2'nin kanıt maddesi dürüstçe uygulandığında "iki
olgun proje" eşiği sağlanmıyor. **Ne olursa geçer:** üçüncü bir olgun
kaynak (ör. bir paket yöneticisinin imza/pin modeli, veya OPA'nın
politika sürümleme yaklaşımı) veya bizzat yaşadığımız bir arıza.

### A2 — Otomatik kabul kapısı (metrik eşiğiyle kendini onaylama)

*İ6 Desen A.* DGM `get_full_eval_threshold`, OpenEvolve `_is_better`,
GEPA `acceptance.py:49`.

| K2 | Durum |
|---|---|
| Problem | ✅ İnsan darboğazı olmadan iyileştirme kabulü. |
| Önlediği hata | ⚠ Kısmen: geriye gidişi engelliyor, ama İ6 AP2'ye göre kapı yalnızca "çalıştı mı / skor arttı mı" ölçüyor, **güvenlik veya yan etki denetlemiyor** (DGM `utils/evo_utils.py:96-126`, yazarın kendi itirafı `README.md:88`). |
| Maliyet | ⚠ Eşiği kimin belirleyeceği İ6'da cevaplanmamış açık soru. |
| **Kanıt** | ❌ **Üçü de olgun değil:** DGM tarihî referans (13 ay donmuş), OpenEvolve 0.x, GEPA 0.1.4 pre-1.0. İ6'nın K7 sonucu net: kendi kodunu insan kapısız değiştirip üretimde güvenle çalışan **tek bir örnek yok**. |

**Ne olursa geçer:** üretimde kanıtlanmış bir örnek. Bugüne kadar
aksi yönde kanıt birikti — endüstrinin en olgun aracı (Aider, olgunluk
5/5) bile kapıyı varsayılan açık tutuyor ve kaldırmayı açık bir bayrağa
(`--yes-always`) bağlıyor.

### A3 — Bilgi katmanı olarak graf

*İ2 A3.* graphiti/cognee/LightRAG/graphrag graf kuruyor.

| K2 | Durum |
|---|---|
| **Problem** | ❌ **"Somut, örnekli" bir problem yazılamıyor.** İ2 S1 bunu açıkça soruyor: "graf olmadan çözülemeyen somut bir kullanım senaryomuz var mı?" — bugün yok. |
| Önlediği hata | ⚠ İlişki sorularının cevapsız kalması; ama bizim ölçeğimizde böyle bir soru henüz yok. |
| Maliyet | ✅ Ölçülü ve yüksek: yazma başına birden çok LLM çağrısı. **mem0 v2'de grafı OSS'ten çıkardı** — bu maliyetin gerçek olduğunun kanıtı. |
| Kanıt | ✅ 4 olgun proje. |

**Ne olursa geçer:** grafsız çözülemeyen somut bir senaryo yazıldığında.
Dört projede var olması tek başına yetmiyor — K2 "her şeyi ekle" yasağının
tam olarak engellemek istediği şey bu.

### A4 — Deterministik replay ile dayanıklılık

*İ1 §3, İ4 §3.1.* Dapr Agents (`strategy.py:20`), Temporal
(`_workflow_instance.py:875-921`).

| K2 | Durum |
|---|---|
| Problem | ✅ Süreç ölümüne dayanıklı uzun akışlar. |
| Önlediği hata | ✅ Yarım kalmış akışın kaybı. |
| **Maliyet** | ❌ **Kabul edilemez:** (a) altyapı bağımlılığı (Dapr sidecar + state store) tek makine için ağır; (b) kullanıcı koduna **determinizm yükümlülüğü** bindiriyor — ve bir LLM ajanı doğası gereği deterministik değildir. |
| Kanıt | ✅ 2 olgun proje. |

**Ne olursa geçer:** geçmez — D1'in adım-sonucu tablosu aynı problemi
kabul edilebilir maliyetle çözüyor. İ4'ün uyarlaması alınır: "LLM
çağrısını bir adıma hapset, adımın kendisi deterministik olmasın".

### A5 — Devre kesici (circuit breaker)

*İ4 §4.1, İ5.* Portkey'de alanlar **okunuyor** (`handlerUtils.ts:646-659`,
`:792-799`) ama repo genelinde hiçbir yerde tanımlanmıyor veya set
edilmiyor — çalışan bir devre kesici yok, yalnızca kanca var.

| K2 | Durum |
|---|---|
| Problem | ⚠ Sürekli hata veren sağlayıcıyı geçici devre dışı bırakmak. |
| Önlediği hata | ⚠ Kör retry'ın maliyeti — ama D7 (hata sınıflandırması) bunun çoğunu zaten karşılıyor. |
| Maliyet | ⚠ Ayrı bir durum makinesi (kapalı/açık/yarı-açık) ve ayarlanacak eşikler. |
| **Kanıt** | ❌ **Tek gerçek uygulama** (LiteLLM cooldown, `cooldown_handlers.py:205-251`) — ve o da devre kesici değil, cooldown. Portkey'inki yarım. İki bağımsız olgun uygulama yok. |

**Ne olursa geçer:** İ4 §6 S5 bunu İ5'e havale etmişti; İ5 cooldown'ı
buldu ama ikinci bir örnek bulamadı. Retry + fallback yetmediğini
gösteren kendi ölçümümüz gelirse geçer.

### A6 — Sandbox ile araç izolasyonu

*İ3 A4.* E2B bulut hizmetinin istemcisi, izolasyon kodu depoda **yok**;
microsandbox KVM tabanlı microVM kullanıyor.

| K2 | Durum |
|---|---|
| Problem | ✅ Güvenilmeyen kodun ana makineye erişmesi. |
| Önlediği hata | ✅ Ana makinede kontrolsüz çalıştırma. |
| **Maliyet** | ❌ **Bugün uygulanamaz:** bu makinede KVM yok ve Windows — microsandbox kullanılamaz; E2B ise bulut, kod dışarı çıkar ve K4 + gizlilik ile çelişir. |
| Kanıt | ✅ 2 olgun proje. |

**Ne olursa geçer:** Windows'ta çalışan, kod dışarı çıkarmayan bir
izolasyon katmanı bulunduğunda. O zamana kadar sınır, sandbox değil
*Permission Manager* (D12) — ve bu bilinçli bir zayıflık olarak
kaydedilir.

### A7 — İstek zorluğu tahminine dayalı model yönlendirme

*İ5 §3.* RouteLLM (`routers.py:32-45`).

| K2 | Durum |
|---|---|
| Problem | ✅ Kolay istekleri ucuz modele yönlendirmek. |
| Önlediği hata | ⚠ Gereksiz maliyet — ama README'nin "%85 maliyet azaltma" iddiası (`README.md:14`) kod içinde **doğrulanamadı**. |
| Maliyet | ❌ Eğitilmiş bir sınıflandırıcı + checkpoint + bakım yükü. |
| **Kanıt** | ❌ Tek proje, ve **tarihî referans** (son push 2024-08-10). Ayrıca K4'ü karar katmanında ihlal ediyor (`similarity_weighted/utils.py:11`). |

**Ne olursa geçer:** canlı ve sağlayıcı-bağımsız bir ikinci örnek
çıkarsa. `semantic-router` (İ5 §7, klonlu ama açılmadı) bu boşluğu
kapatabilecek adaydır.

---

## 5. Ekosistemde yok, ama K2'yi kendi arızamızla geçen

K2'nin kanıt maddesinin ikinci dalı: *"veya bizim bizzat yaşadığımız bir
arızayı çözüyor."* Aşağıdaki fikrin ekosistemde **sıfır** örneği var —
ve tam da bu yüzden kaydediliyor.

### K1 — "Başladı" checkpoint'i

*İ4 §3.2.* LangGraph, Temporal ve DBOS'un üçünde de yalnızca "bitti,
sonucu şu" kaydı var. **Hiçbiri "bu adım başlamıştı, yarım kaldı"
ayrımını yapamıyor** — çökme sonrası "hiç başlamadı" ile "başladı,
bitmedi" aynı görünüyor.

| K2 | Durum |
|---|---|
| Problem | ✅ Kesilen bir adımın yan etki bırakıp bırakmadığının bilinmemesi. Somut: bütçe duvarı bir ajan çağrısının ortasında vurursa, o çağrının dosya yazıp yazmadığı kayıtta yok. |
| Önlediği hata | ✅ *Yan etkinin sessiz tekrarı* — yeniden başlatmada yarım kalmış bir işlemin ikinci kez yapılması. |
| Maliyet | ✅ Ölçülü: her adımda **iki** yazma yerine bir. Ajanlarımız pahalı (LLM tokenı) ve yan etkili (dosya yazma) olduğu için oran lehimize. |
| Kanıt | ✅ İkinci dal: `BILINEN-TUZAKLAR.md` #7 (bütçe duvarı, beş görev), #13 (yarış durumu — düzeltme görevi çalıştığında sorun zaten kapanmıştı) ve #20 (kapanışta `git add -A` eş zamanlı oturumun yarım işini süpürdü). Üçü de "başladı mı, bitti mi" ayrımının yokluğundan doğdu. |

**Bizde nereye oturur.** *Task Manager*. İ4 §6 S1 bunu açık soru olarak
bırakmıştı; K2 uygulandığında **geçiyor**, çünkü ekosistem kanıtı
olmasa da yaşanmış arıza kanıtı üç ayrı tuzak maddesinde kayıtlı. Faz 3
kararı: maliyet (her adımda iki yazma) kabul edilecek mi.

---

## 6. Desenlerin birbirine bağlanması

Onüç desen bağımsız değil; dördü bir zincir kuruyor ve bu zincir
Blueprint'in omurgasıdır:

```
  D1 ilerleme kaydı ──► D4 insan kapısı (askıya al + olayı bekle)
        │                      │
        │                      └──► durum: ONAY_BEKLIYOR (kesintili)
        │
        ├──► D3 Evaluator (deterministik yargı)
        │         │
        │         └──► D8 Critic çıktısı = sonraki çağrının girdi alanı
        │                     │
        │                     └──► D13 mod seçimi: düzelt / temiz sayfa
        │                                │
        │                                └──► D7 hata türü hangi modu seçer
        │
        └──► D5 kaynak kayıt korunur (fork, üzerine yazma yok)
                  │
                  └──► D10 taşma = faz geçişi ──► D9 bütçe dağıtımı
```

Üç desen bu zincirin dışında, kesişen sınır bileşenleri:
**D2** (Model Router), **D11 + D12** (Permission Manager), **D6**
(Registry'ler).

Bir çelişki de kayda geçer. Matris §Çelişkiler'in en net bulgusu
**genişletilebilirlik ↔ güvenlik** ödünleşimiydi: LangGraph 5/2,
Mastra 4/2, graphrag 5/2 — en çok uzatma noktası veren çatı en geniş
saldırı yüzeyini de veriyor. D6 (genişleme kolaylığı) ile D12 (varsayılan
kapalı) bizde bu ödünleşimin iki ucunda duruyor; Faz 3'te uzatma
noktalarının izin sözleşmesinden **muaf olmadığı** açıkça kararlaştırılmalı.

---

## 7. Faz 3'e taşınan açık sorular

Desenlerden doğrudan türeyen, mimari sentezde karara bağlanacaklar:

1. **D1** — kayıt birimi adım-sonucu tablosu mu, event log mu? İ4 Ö1
   tabloyu öneriyor; İ6'nın dört projesi event log kullanıyor. Ölçek
   farkı (tek makine) tabloyu destekliyor, ama denetim izi ihtiyacı
   event log'u.
2. **D1 + §5/K1** — "başladı" checkpoint'inin maliyeti (her adımda iki
   yazma) kabul edilecek mi?
3. **D4** — onay sonrası yan etki tekrarı nasıl önlenecek? LangGraph'ın
   kusuru (`types.py:864`) bizde tekrarlanmamalı.
4. **D3 + D12** — Evaluator'ın deterministik kaynağı olmayan çıktı
   türleri (ör. bir analiz belgesinin kalitesi) nasıl değerlendirilecek?
   "Değerlendirilmedi" yazmak D11 gereği zorunlu; ama o zaman kapı ne
   yapacak?
5. **D6 ↔ D12** — uzatma noktaları izin sözleşmesinden muaf mı?
   (Matrisin genişletilebilirlik/güvenlik çelişkisi.)
6. **D9** — yaklaşık token sayımı mı, sağlayıcı başına kesin tokenizer
   mı? İkincisi K4 ile gerilimli; Letta'nın %30 payı örnek.
7. **A1** — izin sürüme bağlansın mı? Aday listesinde bekliyor ama İ3
   K6'ya eklenmesini öneriyor. Çelişkiyi Faz 3 çözer.

---

## 8. Dürüstlük

- Bu belge **yeni kanıt üretmedi.** Kaynağı altı `OZET.md` ve matris;
  hiçbir klona girilmedi, hiçbir dosya:satır bu turda yeniden
  doğrulanmadı. Buradaki alıntıların güvenilirliği, altındaki iz
  özetlerinin denetim durumuna eşittir — ve **altı izin altısında da
  elle yazılmış `DENETIM.md` var, altısının kararı da "sentezde
  kullanılabilir"**. (Bu, yazarken beklenenden iyi çıktı: İ4–İ6
  özetlerinin kendi metni denetimi "ayrı koşuda yazılacak" diyor, ama o
  koşular sonradan çalışmış ve dosyalar yerinde. Protokol §4 gereği bu
  belge yazılmadan **önce** kontrol edildi, özetlerin metnine
  güvenilmedi.) Uydurma iddia sayısı bakılan izlerde sıfır; İ6'da
  aracın şüpheli dediği 10 alıntının onu da elle doğrulanmış.
- **İz sayıları eşit ağırlıklı sayıldı**, oysa izler eşit derinlikte
  değil: İ5 ve İ6 özetleri kendi dürüstlük notlarında yalnızca analiz
  dosyalarına dayandıklarını, klona hiç girmediklerini yazıyor. Bu,
  D2 (İ5 payı) ve D6 (İ6 payı) için kanıt zincirinin bir halka daha
  uzun olduğu anlamına gelir.
- **Kayırma kontrolü.** Kullanıcının üç deposu bu belgede geçiyor:
  `ai-workflow-engine` yalnızca **karşıt** kanıt olarak (İ1 A5, güvenilirlik
  ilkelleri yok), `nvidia-nim-mcp` yalnızca **karşıt** kanıt olarak
  (D11, sağlık sinyalini üretip atıyor), `mcp-vet` bir aday fikrin
  kanıtı olarak — ve tam da olgunluk yetersizliği yüzünden o fikir
  **aday listesine düştü** (A1). Kayırma yönünde bir sapma bulunamadı.
- **Eleme oranı bilinçli olarak raporlanıyor:** 20 aday desenden 13'ü
  geçti, 7'si elendi (%35). Elenenlerin ikisi iz özetlerinin doğrudan
  "alınmalı" dediği fikirlerdi (A1, A2). K2 çalışıyor demek için bu
  gerekliydi; oran daha düşük çıksaydı ölçütün gevşek uygulandığından
  şüphelenmek gerekirdi.
- **Kapsam dışı.** Anti-pattern'ler bu belgenin konusu değil; yol
  haritasının bir sonraki maddesi (`docs/03-ANTI-PATTERNLER.md`) onları
  ayrıca ele alacak. Burada yalnızca bir desenin **karşıt kanıtı**
  olarak geçtiler.
