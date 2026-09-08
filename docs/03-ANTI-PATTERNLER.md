# Anti-pattern'ler

*Faz 2 · 2026-09-08 · Kaynak: altı iz özeti (`docs/arastirma/i1…i6/OZET.md`) ve
40 proje dosyasının "Zayıf yönler" / "Alınmayacak" bölümleri. Ölçüt:
`docs/adr/ADR-000-program-ve-ilkeler.md` **K2**, protokol
`docs/00-ARASTIRMA-PROTOKOLU.md` §4/4.*

Bu belge `docs/02-EN-IYI-FIKIRLER.md`'nin negatifidir. Orada "birden çok
projede bağımsız olarak ortaya çıkan iyi fikir" arandı; burada **birden çok
projede aynı arızayı doğurmuş seçim** aranıyor.

---

## 1. Yöntem — bir seçim buraya nasıl girdi

**Anti-pattern bir seçimdir, olgunluk eksikliği değil.** Bu ayraç eleme
yaparken sürekli kullanıldı. Bir projenin retry'ında backoff olmaması
kötüdür, ama bu bir *tasarım kararı* değil, henüz oraya gelinmemiş olmasıdır
— aynı eksiklik üç projede tekrarlasa bile buraya girmez (§4). Buna karşılık
"insan onayını bir bayrağa bağlamak" bilinçli bir karardır: birileri oturup
`--yes-always`'i yazmıştır.

**Sıralama ölçütü iz bağımsızlığıdır.** 02'deki ile aynı: aynı hatayı tek
izdeki beş proje yapıyorsa bu o alanın kör noktası olabilir; beş ayrı izde
dokuz proje yapıyorsa bu alanın kör noktası değil, **problemin çekim
merkezidir**. Tablo buna göre sıralı.

**Giriş şartı** (biri yeter):

1. **2 veya daha çok bağımsız izde** aynı seçim ve aynı arıza; **veya**
2. tek izde ama **en az üç bağımsız projede** — bu durumda AP'nin başlığında
   tek-iz olduğu açıkça yazılır ve Faz 3'te tek kaynağa dayandığı akılda
   tutulur.

Her AP dört başlıkla yazılır: **belirti** (dışarıdan ne görünür), **kök
neden** (hangi karar bunu üretti), **kanıt** (hangi izde hangi projede nasıl
göründü), **bizde nasıl kaçınılır** (hangi bileşen, hangi kural). Beşinci bir
satır olarak **kaçınmanın maliyeti** yazılır: her kaçınma da bir tasarım
yüküdür, bedava değildir. K2'nin "eklediği maliyet" maddesinin buradaki
karşılığı budur.

**Kanıt zinciri.** Buradaki her `dosya:satır` alıntısı ilgili iz özetinden
veya proje dosyasından gelir; bu belge **yeni kanıt üretmez**. Belgedeki 35
farklı `dosya:satır` atıfının ve 17 sembol/sayı alıntısının tamamı
`grep -rF` ile iz belgelerinde arandı, **52'sinin 52'si de bulundu** (§7).

---

## 2. Özet tablo

| # | Anti-pattern | İz | Kaynak | Aynası |
|---|---|---|---|---|
| **AP1** | İnsan kapısı bir yapılandırma değeridir; tek bayrakla sıfırlanır | **5** | 9 | D4 |
| **AP2** | Aynı kararın ikinci uygulaması: sonuç hangi yoldan geçtiğine bağlı | **4** | 4 | D2 |
| **AP3** | Beyan edilen garantinin kodda karşılığı yok | **4** | 5 | protokol §1 |
| **AP4** | Sağlayıcı bağımsızlığı ana yolda doğrulanır, yan yolda kırılır | **3** | 8 | D2 |
| **AP5** | Sinyal ile karar arasındaki bağ ters kurulur | **3** | 6 | D3, D11 |
| **AP6** | Etiket yetki sanılır; izolasyonun varsayılanı "hepsi" | 2 | 5 | D12 |
| **AP7** | Çekirdek tek dosyada birikir | 2 | 6 | D6 |
| **AP8** | "Geri alma" sanılan şey yalnızca durumu geri sarmadır | 1 | 5 | D5, D13 |
| **AP9** | Bellek yolunda gizlilik kararı hiç verilmez | 1 | 7/7 | — |
| **AP10** | Model/fiyat kataloğu statik, güncelleme yolu belgesiz | 1 | 3 | — |
| **AP11** | Retry döngüsünde bağlam sınırsız büyür | 1 | 2* | D9, D10 |

"İz" = seçimin kaç bağımsız araştırma izinde ayrı ayrı yüzeye vurduğu; 3 ve
üzeri **kalın**. AP11 giriş şartını sağlamıyor (*tek iz, iki proje) ama
D9/D10'un doğrudan aynası olduğu ve maliyeti ölçülebilir olduğu için
listede tutuldu — bu istisna §7'de açıkça işaretli.

---

## 3. Anti-pattern'ler

### AP1 — İnsan kapısı bir yapılandırma değeridir; tek bayrakla sıfırlanır

**Beş izde, dokuz kaynakta. Bu izlerin en yaygın hatası.**

**Belirti.** Çerçevede bir "onay bekle" ilkeli vardır ve belgede öne çıkarılır.
Ama (a) hangi işlemin onay gerektireceği uygulama geliştiricisine bırakılır,
(b) en riskli işlem varsayılan olarak kapının dışındadır, (c) kapı varsa da
tek bir bayrak/politika nesnesiyle tamamen kaldırılabilir. Üçü bir arada
"onay mekanizmamız var" cümlesini doğru ama işlevsiz yapar.

**Kök neden.** Onay bir **mekanizma** olarak tasarlanmış, bir **sınır** olarak
değil. Mekanizma esnek olmak zorundadır, sınır olmamalıdır; ikisi aynı yere
konunca esneklik sınırı yer.

| İz | Kanıt |
|---|---|
| İ1 | LangGraph `interrupt()` genel amaçlı bir duraklatma ilkeli; "güvenli/riskli ayrımı tamamen uygulama geliştiricisinin `interrupt()`'ı doğru yere koymasına bağlı, çerçeve seviyesinde zorunlu kılınmıyor" (`langgraph/types.py:851`) |
| İ2 | Letta'da `RequiresApprovalToolRule` var, "ama bellek yazma araçlarına varsayılan olarak bağlı değil; yani en hassas işlem (kendi belleğini değiştirme) varsayılan yapılandırmada insan onayından geçmiyor" |
| İ3 | MCP spesifikasyonunda insan kapısı **SHOULD**, MUST değil (`server/tools.mdx:33-34`) — ekosistemin fiilî standardı en riskli işlemde bile onayı zorunlu kılmıyor. A2A'da `AUTH_REQUIRED` bir yetki değil yalnızca bir sinyal |
| İ4 | Yedi projeden **yalnızca birinde** insan kapısı birinci sınıf (LangGraph). "Güvenilirlik literatürünün tamamı 'makine kendini toparlasın' üzerine kurulu; 'insan devreye girsin' neredeyse hiç yok" |
| İ6 | Aider `--yes-always` (`aider/args.py:760-765`) ve OpenHands `NeverConfirm` (`security/confirmation_policy.py:35-41`) aynı deseni **bağımsız olarak** tekrarlıyor: varsayılan kapı kullanıcı tercihiyle sıfıra indirilebiliyor. OpenHands'te güvenlik analizörü zorla açık (`agent.py:437`) ama garanti edilen şey onay değil, yalnızca risk **etiketlemesi** |

En sert biçimi İ6'da: SWE-agent'ın `open_pr` hook'u (`open_pr.py:24-`)
etkinleştirildiğinde gerçek bir GitHub dalını push edip PR açıyor, kodda
hiçbir onay veya dry-run sorgusu yok — `_dry_run` parametresi tanımlı ama
çağrı yerinde kullanılmıyor. Aynı ailede TextGrad
`parameter.set_value(new_value)` (`optimizer.py:186`) üretilen metni hiçbir
skor karşılaştırması yapmadan kalıcılaştırıyor.

**Bizde nasıl kaçınılır.** *Permission Manager* + *Task Manager*. Üç kural:

1. Onay bir **durum**tur, bir çağrı değil: görev durum makinesinde
   `ONAY_BEKLIYOR` kesintili bir durum olarak yaşar (D4). Bayrakla
   atlanabilen şey bir fonksiyon çağrısıdır; bir durum atlanamaz, ondan
   çıkılır.
2. Kapının **hangi işlemde** açılacağını uygulama değil sözleşme söyler:
   riskli işlem kümesi `contracts/permission.schema.json` içinde tanımlıdır,
   çağrı yerinde değil.
3. `CLAUDE.md`'deki sabit sınırlar (kimlik bilgisi, kalıcı silme, para
   transferi, dışarı açılan işlemler) **config'ten okunmaz**. Yapılandırma
   kapıyı daraltabilir, genişletemez. `--yes-always`'in bizdeki karşılığı
   yazılamaz olmalı; en fazla `ONAY-BEKLEYENLER.md`'ye yazıp durur.

**Kaçınmanın maliyeti.** Otonom koşu, onay gerektiren bir adıma geldiğinde
**bitmez, bekler** — gece görevlerinin bir kısmı sabah insan dokunuşuyla
tamamlanır. Bu, ADR-000 K6'nın bilinen ve kabul edilmiş bedeli. Ayrıca
"riskli işlem" kümesini sözleşmede tutmak, yeni bir aracın riskini
tanımlamadan ekleyememek demektir.

---

### AP2 — Aynı kararın ikinci uygulaması: sonuç hangi yoldan geçtiğine bağlı

**Dört izde, dört projede.**

**Belirti.** Aynı iş mantığı (fallback zinciri, tarama kararı, boru hattı)
kod tabanında iki kez yazılmıştır. İki yol başlangıçta eşdeğerdir, sonra
sessizce ayrışır: aynı girdi hangi yoldan geçtiğine göre farklı sonuç, farklı
timeout, farklı hata sınıflandırması üretir. Test bunu yakalamaz, çünkü her
yol kendi testine sahiptir.

**Kök neden.** Ortak çekirdek çıkarılmadan ikinci ihtiyaç karşılanmış:
sync'in yanına async, litellm'in yanına ham HTTP. Kopya, ilk gün en ucuz
seçenektir; ayrışma maliyeti aylar sonra ödenir.

| İz | Kanıt |
|---|---|
| İ2 | mem0: "aynı 8 fazlı boru hattı `main.py`'de iki kez (satır 879 ve 2533)" |
| İ3 | LlamaFirewall: `scan()` tüm tarayıcıları çalıştırıp en yüksek skoru seçiyor (`llamafirewall.py:141-160`), `scan_async()` ilk BLOCK/HUMAN'da kısa devre yapıyor (`llamafirewall.py:169-182`) — **aynı girdi için iki yoldan farklı güvenlik kararı** |
| İ4 | Reflexion: "dört ayrı kopya, ortak çekirdek yok" |
| İ5 | nvidia-nim-mcp: `_run_chat_chain` (`:130`, litellm) ve `_chat_with_fallback` (`:229`, ham httpx) aynı problemi iki farklı hata sınıflandırmasıyla çözüyor; timeout'lar bile farklı — biri 18.0s, diğeri `LLM_TIMEOUT = 120.0` (`:72`) |

İ3'teki biçim en tehlikelisi: ayrışan şey bir performans değeri değil, bir
**güvenlik kararı**. "Engellendi mi?" sorusunun cevabı çağrının sync mi async
mi olduğuna bağlı.

**Bizde nasıl kaçınılır.** *Model Router* ve *Permission Manager* için tek
yol kuralı: birleştirme/karar algoritması **bir** yerde yaşar; sync/async
yalnızca çağrı biçimi farkıdır, karar farkı değil. "Bu çağrı hangi yoldan
gitti?" sorusu mimaride hiç sorulmamalı. Somut kontrol: bir karar
fonksiyonunun ikinci bir uygulaması gerekiyorsa, önce ortak çekirdek
çıkarılır; çıkarılamıyorsa ikinci uygulama yazılmaz.

**Kaçınmanın maliyeti.** Ortak çekirdek, iki çağrı biçimini de kaldıracak
kadar soyut olmak zorundadır; bu, en dar yol için gereğinden karmaşık bir
imza demektir. Ayrıca senkron bir yolu asenkron çekirdeğin üstüne oturtmak
gereksiz bir event-loop yükü getirebilir.

---

### AP3 — Beyan edilen garantinin kodda karşılığı yok

**Dört izde, beş projede.**

**Belirti.** Belge, README veya paket meta verisi bir garanti ilan eder;
kod o garantinin daha zayıf bir sürümünü sağlar. Okuyan koda bakmadığı için
yanlış güvenir ve o güven üzerine tasarım yapar.

**Kök neden.** Garanti kelimesi pazarlama katmanında seçiliyor, mühendislik
katmanında doğrulanmıyor. Yarım kalan bir özelliğin iskeleti de silinmiyor —
kodda görünen alan, var olmayan bir yeteneği ima ediyor.

| İz | Kanıt |
|---|---|
| İ1 | Mastra: `ee/` alt ağacı OSI onaylı olmayan ticari lisansla korunuyor, ama npm `package.json`'da `"license": "Apache-2.0"` yazıyor — beyan bu ayrımı yansıtmıyor |
| İ3 | LlamaFirewall: repo kökü Llama Topluluk Lisansı (OSI değil), `LlamaFirewall/` alt paketi MIT, model ağırlığı ayrı bir lisans — üç hukuki rejim tek `pip install` komutunun arkasında |
| İ4 | DBOS: README'de "exactly-once" (`README.md:139,151,163`); kod sıradan `@DBOS.step` için **at-least-once** sağlıyor (`_core.py:2551-2567`) |
| İ4 | Portkey: devre kesici alanları (`isOpen`, `cbConfig`, `handleCircuitBreakerResponse`) kodda **okunuyor** (`handlerUtils.ts:646-659`) ama repo genelinde hiçbir yerde tanımlanmıyor veya set edilmiyor — çalışmayan bir devre kesicinin iskeleti |
| İ5 | RouteLLM: README'nin "%85 maliyet azaltma" iddiası (`README.md:14`) kod içinde doğrulanamadı |

Aynı ailenin dördüncü biçimi mem0'da: `DEFAULT_UPDATE_MEMORY_PROMPT` ve
`FACT_RETRIEVAL_PROMPT` artık çağrılmıyor, ama README ve blog anlatısı hâlâ
o eski ADD/UPDATE/DELETE modelini anlatıyor. Belge kodun geçmişini anlatıyor.

**Bizde nasıl kaçınılır.** Üç kural:

1. **Garanti ifadesi kod seviyesinde kanıtlanabilir olmalı.** "Adım en az bir
   kez çalışır, sonucu tam bir kez kaydedilir" cümlesi "exactly-once"tan
   uzundur ve doğrudur. Uzun olanı yazacağız.
2. **Yarım özellik bırakılmaz.** Bir özellik ya tam uygulanır ya hiç
   iskeleti bırakılmaz; okunan ama hiç yazılmayan bir alan, olmayan bir
   yetenekten daha kötüdür — çünkü var sanılır.
3. Bu, protokol §1'in "README'ye güvenme" kuralının kendimize dönük hâli:
   `docs/mimari/` altındaki her garanti cümlesi, onu sağlayan dosyaya bağlı
   olacak.

**Kaçınmanın maliyeti.** Belgeler daha uzun ve daha az iddialı olur;
"exactly-once" gibi tek kelimelik satış cümleleri kullanılamaz. Ayrıca her
garanti değişikliğinde belgenin de değişmesi gerekir — bakım yükü.

---

### AP4 — Sağlayıcı bağımsızlığı ana yolda doğrulanır, yan yolda kırılır

**Üç izde, sekiz projede.**

**Belirti.** "Sağlayıcıdan bağımsızız" iddiası ana çağrı yolunda doğrudur —
model takılabilir, LiteLLM oturur. Ama iddia yan sistemlerde sessizce
kırılır: varsayılan tracing uç noktası, guardrail'in çağırdığı model,
embedding üreten istemci, fiyat anahtarı çözümlemesi. Kullanıcı hiçbir ek
yapılandırma yapmazsa veri veya bağımlılık tek bir sağlayıcıya gider.

**Kök neden.** Bağımsızlık bir katmanda test edilmiş, yan sistemlerde
unutulmuş. Sınırın **nereden geçtiği** hiç yazılmamış: "seçim" ile
"taşıma/isimlendirme" ayrılmadığı için her yeni sağlayıcı yeni bir sızıntı
noktası açıyor.

| İz | Kanıt |
|---|---|
| İ1 | OpenAI Agents SDK: varsayılan tracing backend'i doğrudan OpenAI'a gidiyor — `BackendSpanExporter._OPENAI_TRACING_INGEST_ENDPOINT` (`tracing/processors.py:45`); hiçbir ek yapılandırma yapılmazsa **iz verileri** OpenAI'a gönderilmeye çalışılıyor |
| İ3 | LlamaFirewall: `CustomCheckScanner` varsayılanı `api_base_url="https://api.together.xyz/v1"` (`custom_check_scanner.py:33-37`) — AlignmentCheck ve PIICheck için Together AI hesabı gerekiyor |
| İ5 | RouteLLM (**en ağır biçim**): `mf` ve `sw_ranking` router'ları embedding için modül seviyesinde sabit `OPENAI_CLIENT = OpenAI()` (`similarity_weighted/utils.py:11`) — bağımlılık seçilebilir bir taşıma ayarı değil, **koddan sökülemeyen sabit bir istemci**; üstelik bu, kararın ta kendisi |
| İ5 | Yumuşak sızıntılar: Langfuse OpenAI ve Vercel AI SDK için ayrı if/else blokları (`OtelIngestionProcessor.ts:2846-2881`); LiteLLM router'ın seçim stratejileri agnostik ama Azure fiyat-anahtarı için özel dal taşıyor (`router.py:10323`); nvidia-nim-mcp NVIDIA modelleri için `api_base` sarmalaması ve ikinci bir `VISION_PROVIDERS` listesi (`nvidia_image.py:168-172`) |

İ5'in ayrımı burada belirleyici: **taşıma katmanı sağlayıcıya özel kalmaya
mahkûmdur** (her sağlayıcı yeni bir kavram getirir, uzantı katmanı hiç
boşalmaz), ama **seçim mantığı %100 agnostik tutulabilir**. Yumuşak
sızıntılar taşıma katmanındadır ve kabul edilebilir; RouteLLM'inki karar
katmanındadır ve K4'ü gerçekten ihlal eder.

**Bizde nasıl kaçınılır.** *Model Router* sınırı ADR-000 K4'e göre **ince**
tutulur ve sınır şurada çizilir: hangi modelin seçileceği kararı sağlayıcı
adı bilmeden verilir; `api_base`, fiyat anahtarı, başlık biçimi taşıma
katmanında yaşar. Üç somut denetim:

1. Karar veren kodda hiçbir sağlayıcı adı geçmez (`grep -i openai src/router`
   boş dönmeli).
2. Bağımsızlık üç eksende birden sınanır: model çağrısı, **gözlem/iz
   gönderimi**, denetleyici/guardrail çağrısı. "LiteLLM takılabiliyor" tek
   başına bağımsızlık kanıtı değildir.
3. Varsayılan yapılandırma hiçbir dış uç noktaya veri göndermez —
   gözlemlenebilirlik varsayılanı yereldir.

**Kaçınmanın maliyeti.** Sağlayıcıya özel yetenekler (yalnızca bir modelde
olan yapılandırılmış çıktı kipi, sağlayıcının kendi iz görselleştirmesi) ya
kullanılamaz ya taşıma katmanına ek bir kavram olarak yazılır. Bu, en iyi
sağlayıcının en iyi özelliğinden vazgeçmek anlamına gelebilir.

---

### AP5 — Sinyal ile karar arasındaki bağ ters kurulur

**Üç izde, altı projede. İki yönü var ve ikisi de aynı boşluktan doğuyor:
bir ölçümün ne kadar güvenilir olduğu ile ona ne kadar yetki verildiği
hiçbir yerde birlikte yazılmamış.**

**Yön A — ölçülmüş sinyal karara bağlanmıyor.** Bileşen risk/sağlık/maliyet
bilgisini hesaplar, kaydeder, sonra karar onu görmez.

| İz | Kanıt |
|---|---|
| İ5 | nvidia-nim-mcp: `check_provider_health` ölü model bildiriyor, sonraki `ask_llm` çağrısı yine o ölü modeli ilk sırada deniyor — "bilgi üretiliyor ama karara bağlanmıyor" |
| İ5 | nvidia-nim-mcp: `litellm.acompletion` yanıtı `usage` alanı taşıyor ama kod yalnızca `content`/`model` okuyor (`nvidia_image.py:148`) — token sayısı bedavaya elde iken atılıyor |
| İ5 | model-comparison-harness: yargıç çağrısının kendi maliyeti hiç ölçülmüyor, oysa `--rubric` her satırda ek bir LLM çağrısı demek |
| İ6 | OpenHands: güvenlik analizörü zorla açık ama garanti edilen şey risk **etiketlemesi**; onay adımı `NeverConfirm` ile kapatılabiliyor — etiket üretiliyor, kapıyı açmıyor |

İ5'in kendi cümlesi ölçütü veriyor: *bilgi üretip kullanmamak, bilgi
üretmemekten daha kötüdür — maliyeti var, faydası yok.*

**Yön B — ölçülmemiş sinyal karara bağlanıyor.** Bileşen kendi kendine
deneysel/kararsız olduğunu söyler, yine de bir kapıya girdi olur.

| İz | Kanıt |
|---|---|
| İ3 | LlamaFirewall: AlignmentCheck ve PIICheck `[EXPERIMENTAL]` etiketli (`custom_check_scanner.py:28`), README ise "production-ready" diyor |
| İ3 | mcp-vet: regex kataloğunun (`patterns.py`, 560 satır) yanlış pozitif/negatif oranı **hiç ölçülmemiş**; tek kanıt kendi fixture'ları |
| İ3 | mcp-scan: çıktı sözleşmesi açıkça kararsız (`README.md:15-23`, "experimental and may change") — CI kapısı kurmak için güvenilemez |

**Bizde nasıl kaçınılır.** İki yönlü tek kural: **her sinyalin bir yetki
seviyesi vardır ve bu seviye sinyalin yanında yazılıdır.**

- Üretilen her sağlık/maliyet sinyalinin bir tüketicisi olmalı; tüketicisi
  yoksa sinyal üretilmez. Sağlık sinyali *Model Router*'ın sağlıklı dağıtım
  filtresine, maliyet sinyali *Cost Manager*'a doğrudan bağlanır.
- Ölçülmemiş bir detektör önce **gölge modda** çalışır: kaydeder, karar
  vermez. Yanlış pozitif/negatif oranı ölçülene kadar terfi etmez.
- Bu ikisi D3 ve D11 ile aynı gövdeden: yargı deterministik kaynaktan gelir,
  ve "denetlenmedi" ≠ "temiz". Gölge moddaki bir detektörün sessizliği de
  "temiz" sayılmaz.

**Kaçınmanın maliyeti.** Gölge mod, bir detektörün faydasını ölçüm dönemi
boyunca **ertelemek** demektir: gerçek bir saldırıyı yakalayacak kural,
ölçülmediği için o gün engellemez. Ayrıca her sinyale tüketici zorunluluğu,
"ileride lazım olur" diye ölçüm eklemeyi yasaklar.

---

### AP6 — Etiket yetki sanılır; izolasyonun varsayılanı "hepsi"

**İki izde, beş projede.**

**Belirti.** Sistemde bir kapsam alanı vardır — `user_id`, `group_id`,
workspace, API anahtarı — ve veri bu alanla etiketlenir. Ama alan yetki
denetiminde **zorlanmaz**: istek gövdesindeki kimlik doğrulanmış kimlikle
karşılaştırılmaz, ya da alan boş bırakıldığında filtre "hepsi" anlamına
gelir.

**Kök neden.** Etiketin varlığı izolasyon sanılıyor. Etiket bir *veri*dir;
izolasyon bir *denetim*dir. Denetim yazılmadığında etiket yalnızca bir
sıralama anahtarıdır.

| İz | Kanıt |
|---|---|
| İ2 | mem0: REST katmanında doğrulanmış kimlik ile gövdedeki `user_id` karşılaştırılmıyor (`server/main.py:368-375`) |
| İ2 | Graphiti: `group_ids=None` varsayılanı hem aramada hem `clear_data()`'da izolasyonu **sessizce devre dışı bırakıyor** — tek bir unutulmuş parametre tüm kiracıların verisini sızdırabilir ya da **tümünü silebilir** |
| İ2 | LightRAG: varsayılan kurulum kimliksiz yazmaya açık (`api/auth.py:57-63`, guest modu + varsayılan JWT gizli anahtarı) |
| İ3 | E2B: tek düz `X-API-KEY` başlığı (`api/__init__.py:266`) — organizasyon/rol/kapsam ayrımı olmadan tek anahtar tüm yetkiyi taşıyor |
| İ3 | MCP: araç açıklaması ve annotation güvenilmez, ama istemcinin "güvenilir sunucu" kararını nasıl vereceğine dair mekanizma yok — güven tanımsız |

Graphiti'nin biçimi en öğreticisi: aynı varsayılan hem **okumada sızıntı**
hem **silmede felaket** üretiyor. `None` = "hepsi" seçimi, tek bir unutulmuş
argümanı yıkıcı bir işleme çeviriyor.

**Bizde nasıl kaçınılır.** *Permission Manager* + *Memory Manager*:

1. Bellek okuma/yazma yetkisi **etiketten değil** Permission Manager'dan
   geçer. Etiket sorguyu daraltır, yetkiyi vermez.
2. İzolasyon parametresi **beyaz liste**dir ve zorunludur: kapsam
   belirtilmemişse sonuç *boş küme*dir, "hepsi" değil. Yıkıcı işlemlerde
   (`sil`, `temizle`) kapsamın verilmemesi hatadır, varsayılan değil.
3. Bu, D12'nin ("varsayılan kapalı") bellek katmanındaki karşılığıdır.

**Kaçınmanın maliyeti.** Her çağrıda kapsam taşımak imzaları şişirir ve
"tek kullanıcılı yerel kurulum" senaryosunu gereksiz tören haline getirir.
Karşılığında çok kiracılı hâle geçiş, sonradan bir güvenlik projesi olmaz.

---

### AP7 — Çekirdek tek dosyada birikir

**İki izde, altı projede.**

**Belirti.** Yürütme motoru, checkpoint, bellek, araç enjeksiyonu, insan
onayı, koşul çözümleme — hepsi tek dosyada, çoğu zaman tek sınıfta birikir.
Sonuç: bileşen tek başına test edilemez, `__init__` imzası yirmi parametreyi
geçer, çekirdek davranışı değiştirmek riskli hâle gelir.

**Kök neden.** Modül sınırını çizmek ilk gün en pahalı, en az acil iştir;
ertelenir. Erteleme birikimlidir — sınır ne kadar geç çizilirse o kadar
pahalı olur ve bir eşikten sonra hiç çizilmez.

| İz | Kanıt |
|---|---|
| İ1 | Strands: `agent.py` tek dosyada 100.169 bayt; `__init__` imzası tek başına **27 parametre** (`agent.py:213-240`) |
| İ1 | Mastra: `agent/agent.ts` tek dosyada 10.026 satır — "aşırı merkezi, tek sorumluluk ilkesinden uzak bir god object" |
| İ1 | CrewAI: `flow/runtime/__init__.py` tek dosyada 4015 satır — yürütme motoru, koşul çözümleme, persistans, human-feedback, racing-listener hepsi aynı modülde |
| İ1 | Dapr Agents `durable.py` 4353 satır; LangGraph `pregel/main.py` 3500+ satır |
| İ2 | LightRAG: `operate.py` / `pipeline.py` / `lightrag.py` üçü toplam **21.760 satır**; "çekirdek davranışı değiştirmek riskli" |

Dikkat çekici olan, listenin izlerin **en olgun** projelerinden oluşması. Bu
bir acemilik hatası değil; başarının yan ürünü. Kaçınmak için erken karar
gerekir, sonradan iyi niyet yetmez.

**Bizde nasıl kaçınılır.** ADR-000 K2'nin "tek başına test edilebilir" şartı
bu izlerin en yaygın hatasına karşı alınmış somut önlemdir ve Faz 4'te
ölçülebilir hale getirilir:

1. Her çekirdek bileşen kendi modülünde, kendi arayüzüyle; diğer bileşenlere
   yalnızca arayüz üzerinden bağlanır.
2. Bir bileşenin testi diğer bileşenleri **başlatmadan** koşabilmelidir. Bu,
   modül sınırının tek geçerli kanıtıdır.
3. Yapıcı imzası uzuyorsa bileşen bölünmüştür — parametre sayısı bir
   sınır ihlali sinyali olarak okunur (Strands'in 27'si).

**Kaçınmanın maliyeti.** Küçük bir sistemde altı modül, tek dosyadan daha
fazla dolaşım (indirection) ve daha yavaş ilk geliştirme demektir. Her
arayüz bir sözleşmedir ve sözleşme değiştirmek dosya içi refactor'dan
pahalıdır.

---

### AP8 — "Geri alma" sanılan şey yalnızca durumu geri sarmadır

**Tek izde (İ4) ama beş projede — ve bu izin en net bulgusu.**

**Belirti.** Sistem "rollback" der. Gerçekte yaptığı, kalıcı bir kayıttan
okuyup yeniden başlamaktır. Dünyada yapılmış yan etki — gönderilmiş e-posta,
açılmış PR, yazılmış dosya, ödenmiş token — yerinde durur. Kelimeye güvenip
tasarım yapan, olmayan bir garantinin üstüne bina kurar.

**Kök neden.** Telafi (compensation) mantığı alana özgüdür; genel bir motor
onu güvenle otomatikleştiremez. Olgun projeler bunu **bilerek** yapmıyor —
yani buradaki anti-pattern projelerin seçimi değil, o projelerin
kelimesini ödünç alan mimarilerin varsayımı.

| İz | Kanıt |
|---|---|
| İ4 | LangGraph zaman yolculuğunda eski checkpoint **silinmiyor**, yeni dal açılıyor (`_loop.py:960-971`, `{"source": "fork"}`). Yan etki telafisi yok: depoda `grep -rn compensat` **sıfır** sonuç |
| İ4 | Temporal: telafi motorun değil geliştiricinin işi; saga deseni SDK'da yok — klonda sıfır saga/compensation kodu veya örneği |
| İ4 | DBOS: workflow seviyesinde compensation/saga birincil sınıf desteği yok; `grep` yalnızca log mesajları ve docstring'ler döndürdü |
| İ4 | Portkey: stateless, geri alacak durum bile yok |
| İ4 | Reflexion: geri alınacak bir şey yok, çünkü dış dünyaya hiç dokunmuyor — tek yan etkisi sandbox'ta test çalıştırmak |

**Bizde nasıl kaçınılır.** "Rollback" kelimesi mimariye **girmez**. Yerine
iki ayrı kavram, iki ayrı bileşen sorumluluğu:

1. **Durumu geri sarma** — checkpoint'ten okuyup yeniden başlama. Ucuz,
   güvenli, *Recovery Manager*'ın işi. D1 ve D5 zaten bunu tarif ediyor:
   kaynak kayıt korunur, üzerine yazılmaz, dal açılır.
2. **Telafi** — genel motor olarak **yapılmayacak**. Geri alınamaz her eylem
   için ya idempotency anahtarı ya da elle yazılmış açık bir telafi adımı
   zorunlu olur; ikisi de yoksa eylem AP1'in insan kapısına düşer.

Bu ayrım, otonom koşularımızda doğrudan karşılık buluyor: `git commit`
geri sarılabilir, `git push` telafi ister — ve `CLAUDE.md` zaten push'u
insan kapısına koyuyor.

**Kaçınmanın maliyeti.** Geri alınamaz eylem kümesi büyüdükçe otonom
çalışabilen iş küçülür. Ayrıca her dış eylem için idempotency anahtarı
tasarlamak, en basit araç entegrasyonuna bile ek bir alan ekler.

---

### AP9 — Bellek yolunda gizlilik kararı hiç verilmez

**Tek izde (İ2) ama incelenen yedi projenin yedisinde. Kanıtı en geniş,
kaynağı en dar madde.**

**Belirti.** Konuşmalar, belgeler ve çıkarılmış varlıklar kalıcı belleğe
yazılır; hiçbir aşamada kişisel veri açısından taranmaz, maskelenmez,
saklama süresi tanımlanmaz. En fazla secret/credential redaksiyonu vardır —
o da farklı bir sorunu çözer.

**Kök neden.** Konu ekosistem genelinde kapsam dışı bırakılmış. Bu bir
*seçim* değil bir *ihmal*; ama yediye yedi tekrar ettiği için tasarım
varsayılanı hâline gelmiş: bellek katmanı yazarken gizlilik sorusu hiç
sorulmuyor.

| Proje | Kanıt |
|---|---|
| Letta | "Bellek içeriği için sıfır güvenlik önlemi: PII maskeleme yok, şifreleme yok, retention/TTL yok" |
| mem0 | "PII için hiçbir şey yok", üstelik prompt **aktif olarak** kişisel bilgi toplamaya yönlendiriyor (`prompts.py:15`) |
| Graphiti | Hiçbir maskeleme/şifreleme/TTL yok; tek önlem log disiplinine dair bir yorum satırı (`attribute_utils.py:177`) |
| LightRAG | "PII için sıfır mekanizma" — üstelik çıkarım promptu kişi varlıklarını hedefliyor |
| GraphRAG | "PII/ACL/retention hiç yok" |
| Cognee | İçerik seviyesinde tarama/maskeleme/retention yok, yalnızca secret redaksiyonu |
| LlamaIndex | Core'da PII maskeleme LLM string-split + `json.loads`'a dayanıyor, try/except yok, format sapmasında **çöküyor** (`pii.py:69-73`) |

mem0 ve LightRAG'ın biçimi ayrıca dikkat çekici: sistem yalnızca kişisel
veriyi korumamakla kalmıyor, prompt seviyesinde onu **toplamaya**
yönlendiriyor.

**Bizde nasıl kaçınılır.** Kopyalanacak bir örnek yok; tasarım sıfırdan
yapılacak (İ2 S3). Faz 3'e taşınan bağlayıcı karar: *Memory Manager* ile
*Permission Manager* arasında **ayrı bir karar noktası** olur — belleğe
yazma bir izin işlemidir. Katman başına saklama süresi (task / session /
project / global) `docs/mimari/03-BELLEK.md`'de tanımlanır ve süresi
tanımsız katman yazılamaz.

**Kaçınmanın maliyeti.** Yazma yolunda ek bir denetim adımı: gecikme, ve
tarama LLM ile yapılırsa token. Yanlış pozitif maskeleme belleği
işe yaramaz hâle getirebilir — bu yüzden AP5'in gölge mod kuralı burada da
geçerli.

---

### AP10 — Model/fiyat kataloğu statik, güncelleme yolu belgesiz

**Tek izde (İ5), üç projede.**

**Belirti.** Model listesi veya fiyat tablosu koda ya da tek bir JSON
dosyasına gömülüdür. Listede olmayan bir girdi çalışma anında çöker;
tablonun ne zaman, nasıl, hangi kaynaktan güncellendiği hiçbir yerde yazmaz.
Fiyatlar sessizce eskir ve maliyet raporları yanlışlanır.

**Kök neden.** Katalog bir *veri* olduğu hâlde *kod* gibi ele alınmış;
tazeliği kimsenin sorumluluğunda değil.

| İz | Kanıt |
|---|---|
| İ5 | RouteLLM: kapalı `MODEL_IDS` sözlüğü (`model.py:6-71`, 64 giriş), listede olmayan model `KeyError` ile çöküyor (`routers.py:235-236`) |
| İ5 | nvidia-nim-mcp: `LLM_MODELS` koda gömülü, yapılandırma dosyasından değiştirilemiyor (`nvidia_image.py:81-85`) |
| İ5 | LiteLLM: `model_prices_and_context_window.json`'ın nasıl/ne zaman güncellendiği **doğrulanamadı** |

**Bizde nasıl kaçınılır.** *Cost Manager* ve *Model Router*: fiyat/model
kataloğu yapılandırma verisidir, koda gömülmez. Katalogda **güncelleme
prosedürü belgelenir** — elle mi, hangi sıklıkla, hangi kaynaktan — ve
tablonun kendisi bir "son güncelleme" alanı taşır. Bilinmeyen model
`KeyError` ile çökmez: bilinmeyen maliyet `null` olarak raporlanır ve
"ölçülemedi" ile "sıfır" ayrı kalır (bu ayrım, `BILINEN-TUZAKLAR.md` #21'in
aynısı — `parseInt("incelenmedi")` → NaN).

**Kaçınmanın maliyeti.** Elle güncellenen bir tablo, güncellenmediğinde
sessizce yanlış kalır; belgelenmiş prosedür de tek başına tazelik garantisi
vermez. Otomatik güncelleme ise dış bir kaynağa bağımlılık demektir.

---

### AP11 — Retry döngüsünde bağlam sınırsız büyür

**Tek izde (İ4), iki projede — giriş şartını sağlamıyor (§7), D9/D10'un
doğrudan aynası olduğu için listede.**

**Belirti.** Yansıma/eleştiri/mesaj listesi her denemede büyür; budama,
özetleme veya token bütçesi yoktur. Retry döngüsünün maliyeti deneme sayısıyla
doğrusaldan hızlı artar ve bağlam penceresi dolduğunda döngü, çözmeye
çalıştığı hatadan bağımsız bir hatayla ölür.

**Kök neden.** Yansıma belleği "birikimli olması iyidir" diye tasarlanmış;
sınır konusu bellek katmanının değil döngünün sorumluluğunda sayılmış, ve
ikisi arasında kalmış.

| İz | Kanıt |
|---|---|
| İ4 | Reflexion: `self.reflections += [...]` (`agents.py:113`) — hiç budama, özetleme veya sınır yok |
| İ4 | Instructor: mesaj listesi denemeler arasında aynı şekilde büyüyor |

**Bizde nasıl kaçınılır.** Yansıma belleği sayı **veya** token ile sınırlanır,
eskisi özetlenir; sınır *Context Manager*'ın bileşen bütçesinde tanımlıdır
(D9), taşma bir hata değil planlanmış bir faz geçişidir (D10). Karar İ2'nin
bellek katmanı kararına bağlanır — yansıma "task" katmanında yaşar ve görevle
birlikte biter.

**Kaçınmanın maliyeti.** Özetleme, geri döndürülemez bir bilgi kaybıdır
(İ2/LightRAG'ın `_handle_entity_relation_summary` örneği §4'te). Bu yüzden
özetleme yapılırken ham kayıt korunur — D5 ile birlikte uygulanmalı, tek
başına değil.

---

## 4. Aday olup elenenler

Bunlar gerçek zayıflıklar, ama §1'in ölçütünü geçemediler. Her biri için
**ne olursa geçer** yazıldı.

| Aday | Kanıt | Neden elendi | Ne olursa geçer |
|---|---|---|---|
| Backoff/jitter'sız retry | İ4: instructor, dspy, reflexion (3 proje) | Kaynağın kendi nitelendirmesi: "bir olgunluk farkı, tasarım tercihi değil". §1'in seçim/olgunluk ayracına takıldı | Bir projede backoff'suz retry'ın **bilinçli** savunulduğu gösterilirse |
| Eski/legacy kodun aktif kodun yanında yaşaması | İ1 Strands, İ2 Letta (`letta_agent.py` / `v2` / `v3`) | Üç kanıttan biri ([çıkarım] işaretli) zayıf eşleşmeydi, biri (mem0) AP3'e ait. Geriye tek sağlam proje kaldı | İkinci bir izde, geriye dönük uyumluluk için ikinci kod yolunun bilerek bırakıldığı bir örnek |
| Görünürlük filtresini gerçek silme sanmak | İ2 mem0: `expiration_date` yalnızca görünürlük filtresi, `show_expired=True` ile geri geliyor | Tek proje, tek iz | İkinci bir projede aynı yanılsama |
| Geri döndürülemez özetleme | İ2 LightRAG: `_handle_entity_relation_summary` orijinal açıklamaları LLM özetiyle değiştiriyor | Tek proje. Yine de AP11'in maliyet satırında ve D5'te karşılığı var | İkinci bir projede kaynağın korunmadan üzerine yazılması |
| Determinizm yükümlülüğünün sessizce kullanıcıya bindirilmesi | İ4 DBOS recovery gövdeyi baştan çağırıyor, ihlali yalnızca adım *adı* değişirse yakalıyor | Tek başarısız örnek: Temporal aynı varsayımı yapıyor ama açıkça söylüyor (`NondeterminismError`) — yani sorun varsayım değil, **sessizlik** | İkinci bir projede aynı sessizlik |
| Adım-altı ilerleme mekanizmasının olmaması | İ4 DBOS: checkpoint granülerliği tam olarak adım sınırı (`_core.py:2551-2567`) | Tek proje; LangGraph ve Temporal bunu çözmüş — ekosistem hatası değil | — |
| "Değerlendirilemedi" ile "kötü"nün aynı hücreye düşmesi | İ5 model-comparison-harness: bozuk JSON ve çalışma anı hatası ikisi de `passed=False, score=0.0`, üçüncü bir `unknown` yok | Tek proje, tek iz. Ama D7 (hata türü makine-okur alandır) ve AP10'un `null` kuralı zaten kapsıyor | — |
| Projenin kendi olgunluğunu düşüren etiketleri (Pre-Alpha/alpha) | İ1: Dapr Agents `pyproject.toml:44` "Pre-Alpha", Mastra `@mastra/core@1.65.0-alpha.7` | Proje olgunluğuyla ilgili, bir tasarım seçimi değil | — |

---

## 5. Ayna ilişkisi — her AP hangi deseni gerektiriyor

`docs/02-EN-IYI-FIKIRLER.md` ile bu belge aynı kanıt kümesinin iki yüzü.
Eşleşme, geçen desenlerin **niçin** geçtiğini de açıklıyor:

| AP | Ayna desen | İlişki |
|---|---|---|
| AP1 | D4 — insan kapısı durum makinesinde birinci sınıf durumdur | AP1'in tam çaresi: durum bayrakla atlanamaz |
| AP2 | D2 — sağlayıcı sınırı incedir | Tek karar yolu ilkesi |
| AP3 | protokol §1 — README'ye güvenme | Kuralın kendimize dönük hâli |
| AP4 | D2 | Sınırın nereden geçtiğinin yazılı olması |
| AP5 | D3 (yargı deterministik kaynaktan) + D11 ("denetlenmedi" ≠ "temiz") | Sinyal-yetki bağının iki ucu |
| AP6 | D12 — varsayılan kapalı | Bellek katmanındaki karşılığı |
| AP7 | D6 — genişleme = bir dosya + bir kayıt satırı | Modül sınırının erken çizilmesi |
| AP8 | D5 (kaynak korunur, dal açılır) + D13 (retry'ın iki modu) | "Geri sarma" ile "telafi"nin ayrılması |
| AP9 | — | Ekosistemde aynası yok; D listesinde de karşılığı yok. Bu bir **boşluk**, Faz 3'te sıfırdan tasarlanacak |
| AP10 | — | D listesinde karşılığı yok; `BILINEN-TUZAKLAR.md` #21'in (NaN/null) genellemesi |
| AP11 | D9 (bağlam bütçesi) + D10 (taşma faz geçişidir) | Sınırın kimin sorumluluğunda olduğunun yazılması |

AP9 ve AP10'un ayna deseni olmaması anlamlıdır: bunlar ekosistemin çözdüğü
değil, **atladığı** problemler. 02'nin "boşluklar" başlığıyla aynı yere
bakıyorlar.

---

## 6. Faz 3'e taşınan bağlayıcı kurallar

Bu on bir maddeden mimariye doğrudan giren, ADR'lerde karara bağlanması
gereken kurallar:

1. **Sabit sınırlar config'ten okunmaz** (AP1). `--yes-always` karşılığı
   yazılamaz olmalı. → Security Architecture / `permission.schema.json`.
2. **Onay bir durumdur** (AP1). `ONAY_BEKLIYOR` görev durum makinesinde
   kesintili bir durum. → Orchestration Architecture / `task.schema.json`.
3. **Karar algoritması tek yerde** (AP2). Bir karar fonksiyonunun ikinci
   uygulaması yazılmaz; sync/async yalnızca çağrı biçimi farkıdır.
4. **Garanti cümlesi kodun sağladığından fazlasını söylemez** (AP3). Her
   garanti, onu sağlayan dosyaya bağlı yazılır.
5. **Bağımsızlık üç eksende sınanır** (AP4): model çağrısı, iz gönderimi,
   denetleyici çağrısı. Karar veren kodda sağlayıcı adı geçmez.
6. **Her sinyalin bir tüketicisi ve bir yetki seviyesi vardır** (AP5).
   Ölçülmemiş detektör gölge modda başlar.
7. **Kapsam belirtilmemişse sonuç boş kümedir** (AP6), "hepsi" değil.
   Yıkıcı işlemde kapsamsızlık hatadır.
8. **Bileşenin testi diğer bileşenleri başlatmadan koşar** (AP7). Modül
   sınırının tek geçerli kanıtı budur.
9. **"Rollback" kelimesi mimariye girmez** (AP8). Yerine "durumu geri sarma"
   ve "telafi"; telafisi olmayan geri alınamaz eylem insan kapısına düşer.
10. **Belleğe yazmak bir izin işlemidir** (AP9). Saklama süresi tanımsız
    bellek katmanı yazılamaz.
11. **Katalog veridir, koda gömülmez** (AP10); bilinmeyen maliyet `null`,
    sıfır değil.
12. **Yansıma belleği sınırlıdır** (AP11) ve özetlerken ham kayıt korunur.

---

## 7. Dürüstlük

**Kanıt doğrulaması.** Bu belgedeki 35 farklı `dosya:satır` atıfı (düzenli
ifadeyle çıkarıldı) ve 17 sembol/sayı alıntısı (`NeverConfirm`,
`_handle_entity_relation_summary`, "100.169 bayt", "4015 satır" gibi) altı iz
klasöründe `grep -rF` ile tek tek arandı; **52 kontrolün 52'si de bulundu,
sıfır uydurma**. Doğrulama iz belgelerine karşı yapıldı, klonlara karşı değil —
alıntıların klondaki gerçek satırlarla eşleşmesi ilgili izin `DENETIM.md`
adımının sorumluluğudur ve altı iz için ayrı ayrı yapılmıştır. Bu belge
kanıt zincirinin **üçüncü halkasıdır** ve yeni kanıt üretmez.

**Tek izde kalanlar.** AP8, AP9, AP10 ve AP11 tek araştırma izinden geliyor.
AP8 (5 proje), AP9 (7/7 proje) ve AP10 (3 proje) §1'in ikinci giriş şartını
sağlıyor; **AP11 sağlamıyor** (2 proje) ve bilerek istisna yapıldı — D9/D10
ile doğrudan aynı olduğu için. Faz 3'te bu dördü, çoklu-iz maddelerinden
daha az ağırlıkla ele alınmalı.

**Örtüşmeler.** LlamaFirewall üç ayrı AP'nin (AP2 sync/async, AP3 lisans,
AP4 varsayılan sağlayıcı) ve AP5'in kanıt listesinde geçiyor;
nvidia-nim-mcp dört AP'de. Aynı projenin birden çok yerde görünmesi iz
sayısını şişirmedi — iz sayısı **projeye göre değil ize göre** sayıldı, ve
LlamaFirewall'ın "EXPERIMENTAL vs production-ready" kanıtı bilinçli olarak
yalnızca AP5'te kullanıldı (AP3'te tekrar sayılmadı).

**Zayıf eşleşmeler.** AP1'in İ3 satırındaki A2A `AUTH_REQUIRED` kanıtı, ham
çıkarımda "[çıkarım]" ile işaretlenmişti: söylediği şey "onay kapısı
opsiyonel" değil, "onay sinyali tek başına yetki değil". Aynı aileden ama
birebir aynı önerme değil; AP1'in beş izinden biri bu nedenle diğer dörtten
zayıftır. AP1 dört sağlam iz olmadan da geçerdi.

**Ne aranmadı.** Kaynak taraması iz özetlerinin "Anti-pattern'ler",
"Ayrışan yaklaşımlar" bölümleriyle proje dosyalarının "Zayıf yönler" ve
"Alınmayacak" bölümleriyle sınırlıydı. Proje dosyalarının gövdesi (mimari,
klasör yapısı, hata yönetimi bölümleri) bu tur için okunmadı; oralarda
adı konmamış anti-pattern kalmış olabilir. İncelenmeyen 40 projenin
tamamı değil, yalnızca bu iki bölümü boş olmayanlar kanıt üretti.

**Kayırma.** Kullanıcının kendi depoları bu belgede **iki AP'de kanıt
olarak** geçiyor: `nvidia-nim-mcp` (AP2 ikinci fallback uygulaması, AP4
sağlayıcıya özel dallanma, AP5 kullanılmayan sağlık ve token sinyali, AP10
gömülü model listesi) ve `model-comparison-harness` (AP5 ölçülmeyen yargıç
maliyeti). Kayırma yapılmadı; aynı sertlikle yazıldı.
