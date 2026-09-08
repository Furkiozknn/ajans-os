# nvidia-nim-mcp

> Kullanıcının kendi deposu. Protokol §5 gereği kayırma yok: aynı rubrik,
> aynı sertlik. Bu iz için ilgi alanı **model yönlendirme ve fallback
> zinciri** (İ5: cost/latency optimization, model routing).

## Kimlik

| Alan | Değer |
|---|---|
| repo | `Furkiozknn/nvidia-nim-mcp` (yerel: `D:\Repolar\nvidia-nim-mcp`) |
| yıldız / watcher | doğrulanmadı (ağ sorgusu yapılmadı; kişisel depo, muhtemelen ~0) |
| son push | 2026-09-05 (`98b4c66`) |
| lisans | MIT (`LICENSE:1 "MIT License"`) |
| dil | Python, tek dosya: `nvidia_image.py` (745 satır) + 8 test dosyası |
| bağımlılık | `fastmcp`/`mcp`, `litellm>=1.97.0` (`pyproject.toml:12 "litellm>=1.97.0"`) |
| canlılık | **geçti** — son push 3 gün önce, arşivlenmemiş, OSI lisanslı |

## Çözdüğü problem

Ücretsiz katmanlı model sağlayıcılarının (NVIDIA NIM ve yanında
Groq/Mistral/Gemini/Cerebras) **güvenilmez** oluşuna karşı bir MCP sunucusu.
Ücretsiz katmanda modeller haber verilmeden emekliye ayrılıyor (HTTP 410),
oran sınırına giriyor veya ödeme istemeye başlıyor. Sunucu yedi MCP aracı
(görsel üretme, çeviri, LLM sorusu, görsel tanımlama, içerik güvenliği,
gömme vektörü, sağlayıcı sağlığı) sunuyor ve her birinin arkasına
**model → model → sağlayıcı → sağlayıcı** sıralı bir fallback zinciri
koyuyor. Acı noktası: "bir model öldü diye araç ölmesin".

## Mimari

Tek dosyada yatay katmanlar; dikey bir bileşen ağacı yok:

```
MCP araç yüzeyi (@mcp.tool)
  generate_image · translate_text · ask_llm · describe_image
  check_content_safety · create_embedding · check_provider_health
        │
        ▼
Zincir kurucular (saf fonksiyon, ağ yok)
  _build_chat_chain(nvidia_models)   → NVIDIA öneki + anahtarı olan ekstralar
  _build_provider_chain(providers)   → yalnızca anahtarı olan ekstralar
        │
        ▼
Zincir yürütücü
  _run_chat_chain(chain, ...)  → litellm.acompletion(primary, fallbacks=[...])
  _chat_with_fallback(...)     → ham httpx döngüsü (litellm'siz yol)
        │
        ▼
Sağlayıcılar: NVIDIA integrate.api / ai.api · Pollinations (anahtarsız)
              Groq · Mistral · Gemini · Cerebras · yerel sentence-transformers
```

İki paralel yürütme yolu olması önemli bir mimari gözlem: `_run_chat_chain`
(`nvidia_image.py:130`) fallback'i **litellm'e devrediyor**
(`nvidia_image.py:142 "fallbacks=fallbacks or None"`), ama `_chat_with_fallback`
(`nvidia_image.py:229`) aynı işi **elle** `httpx` döngüsüyle yapıyor. İkisi
farklı hata sınıflandırması ve farklı timeout kullanıyor.

## Klasör yapısı

```
nvidia-nim-mcp/
├── nvidia_image.py        tüm sunucu — araçlar, zincirler, sağlık probları (745 satır)
├── pyproject.toml         litellm + mcp; local-embeddings opsiyonel ekstra
├── tests/                 8 dosya, her fallback yolu için ayrı test
│   ├── test_fallback.py
│   ├── test_build_chat_chain.py
│   ├── test_check_provider_health.py
│   ├── test_api_key_guard.py
│   └── ...
├── assets/                banner.svg, fallback-chain.svg, tools-grid.svg
└── .github/workflows/ci.yml
```

Kayda değer: `docs/` **yok**, `ARCHITECTURE.md` **yok**. Mimari bilgisi
tamamen kod içi yorumlarda yaşıyor — ki bu yorumlar alışılmadık derecede
zengin (aşağıda "güçlü yönler").

## Ajan tasarımı

**Ajan kavramı yok.** Bu bir MCP sunucusu, ajan çerçevesi değil. Yine de
İ5 açısından ilginç olan şey var: her araç, kendi model tercihini bir
**modül düzeyi sabit liste** olarak beyan ediyor —
`TRANSLATE_MODELS` (`:74`), `LLM_MODELS` (`:80`), `VISION_MODELS` (`:156`),
`EMBED_MODEL` (`:174`), `SAFETY_MODEL` (`:175`). Bu, ADR-000 K3'ün istediği
"makine-okur sözleşme"nin **en ilkel hâli**: liste kod içinde, şema yok,
dışarıdan okunamaz, sürümlenmez. Bir aracın hangi modelleri kullandığını
öğrenmek için Python modülünü import etmek gerekiyor.

`dependencies.models` benzeri bir alan olsaydı bu listeler sözleşmeden
gelirdi. Bugün gelmiyor — bu, bizim için "yapmayın" değil "bir sonraki
adım şu" örneği.

## Orkestrasyon / iş akışı modeli

Orkestrasyon yok; **sıralı fallback** var. Model:

1. Zincir **çalışma anında** kuruluyor, derleme anında değil: `_build_chat_chain`
   (`nvidia_image.py:116-128`) her çağrıda `os.environ.get(provider["env"])`
   bakıyor ve anahtarı olmayan sağlayıcıyı **sessizce atlıyor**.
   README'nin vaadi ("paste a key in and it joins the fallback chain on the
   next call, no code changes needed", `nvidia_image.py:91-92`) kodda
   gerçekten karşılanıyor.
2. Sıra **sabit ve elle belirlenmiş**, ölçüme dayalı değil: yorum sırayı
   "2026-08-22'de gerçek bir çağrıyla çalıştığı doğrulanan" düzen olarak
   açıklıyor (`nvidia_image.py:97-99`). Yani sıralama bir kereye mahsus bir
   insan gözlemidir, canlı sağlık/maliyet sinyali değil.
3. Paralellik yalnızca **sağlık kontrolünde** var: `check_provider_health`
   (`nvidia_image.py:669`) tüm probları `asyncio.gather` ile aynı anda atıyor
   (`nvidia_image.py:697-704`), `asyncio.Semaphore(HEALTH_PROBE_CONCURRENCY)`
   ile 6'yla sınırlayarak (`nvidia_image.py:689`).

**Yönlendirme kararı hiçbir yerde maliyet veya gecikmeye bakmıyor.** Bu, İ5
izinin ana sorusu açısından net bir bulgu: bu depo "model routing" değil,
"model failover" yapıyor. İkisi karıştırılmamalı.

## Durum ve bellek

Kalıcı durum yok. Üretilen çıktılar `OUTPUT_DIR` altına dosya olarak yazılıyor
(`nvidia_image.py:27`), örn. gömme vektörü JSON'a
(`nvidia_image.py:660-665`). Checkpoint, oturum, konuşma geçmişi yok — her
araç çağrısı bağımsız.

Tek "durum" benzeri şey: yerel gömme modelinin tembel singleton'ı
(`nvidia_image.py:182-189`), `threading.Lock` ile korunuyor
(`nvidia_image.py:189 "_local_embed_lock = threading.Lock()"`). Yorum neden
`asyncio.Lock` değil de `threading.Lock` seçildiğini açıklıyor: model
`asyncio.to_thread` ile gerçek OS thread'lerinde çalıştığı için asyncio
kilidi thread havuzunu kesmez. Bu, düşünülmüş bir eşzamanlılık kararı.

## Hata yönetimi

Bu deponun en olgun tarafı. Beş ayrı katman:

| Katman | Kod | Davranış |
|---|---|---|
| Model içi fallback | `:229-247` | httpx döngüsü; timeout, ≠200, bozuk JSON → sıradaki model |
| Sağlayıcılar arası fallback | `:139-148` | litellm `fallbacks=` ile zincir |
| Yetenek düşürme | `:596-613` | özel güvenlik modeli ölürse genel sohbet modeline sınıflandırma prompt'u |
| Yerel son çare | `:192-208` | gömme için sentence-transformers, ağsız |
| Anahtarsız katman | `:52`, `:325` | görsel üretimde Pollinations, API anahtarı gerektirmez |

Üç şey özellikle iyi:

- **Düşürülmüş cevap etiketleniyor.** İçerik güvenliği fallback'i cevabın
  sonuna `"(best-effort fallback verdict from {model}, not the dedicated
  NVIDIA safety model)"` ekliyor (`nvidia_image.py:612`). Çağıran, aldığı
  yargının kalibrasyonu düşük bir modelden geldiğini **biliyor**. İ3'ün
  "kontrol edilmedi ≠ temiz" ilkesinin doğal kardeşi.
- **Hiçbir yardımcı fırlatmıyor.** `_local_embedding` (`:192`),
  `_chat_via_provider_chain` (`:223`), `_run_chat_chain` (`:130`) hepsi
  başarısızlıkta `None` döndürüyor, istisna değil. Çağıran temiz bir hata
  metni üretebiliyor.
- **Ölü model kaldırma disiplini belgeli.** `LLM_MODELS` üstündeki yorum
  (`nvidia_image.py:81-85`) iki modelin neden çıkarıldığını yazıyor:
  "HTTP 410, reached its end of life" — kalıcı emeklilik, geçici oran
  sınırı değil; ve litellm ile doğrulandıktan sonra çıkarıldı. Bir kararın
  gerekçesini kodun yanına yazmanın örnek uygulaması.

Eksik olan: **retry yok** (aynı modele ikinci deneme hiç yapılmıyor —
geçici 429/503 kalıcı hata gibi işleniyor), **circuit breaker yok** (aynı
oturumda arka arkaya beş çağrı, ölü olduğu bilinen modeli beş kez deniyor),
**bütçe/maliyet sayacı yok**, **iz/telemetri yok**.

## Genişletilebilirlik

Yeni bir ücretsiz sağlayıcı eklemek: `EXTRA_PROVIDERS` listesine bir satır
(`nvidia_image.py:96-114`) — tek dosya, tek satır. Vision-yetenekli sağlayıcı
için ikinci bir liste (`VISION_PROVIDERS`, `:168`). Bu gerçekten ucuz.

Ama iki yapısal sınır var:

- Yeni bir **araç** eklemek 745 satırlık tek dosyaya dokunmak demek; araç,
  zincir ve prob mantığı aynı modülde.
- Sağlayıcı listesi **koda gömülü**. Yapılandırma dosyası veya ortam
  değişkeniyle sıralamayı değiştirmek mümkün değil; kullanıcı sırayı
  beğenmezse depoyu düzenlemeli.

## Maliyet ve gecikme sayaçları

**Yok.** Ne token sayısı, ne süre, ne USD hiçbir yerde kaydedilmiyor.
Yalnızca `LLM_TIMEOUT = 120.0` (`nvidia_image.py:72`) ve
`HEALTH_PROBE_TIMEOUT = 8.0` (`nvidia_image.py:249`) gibi üst sınırlar var.
`litellm.acompletion` yanıtı token kullanımını içerir ama kod yalnızca
`response.choices[0].message.content` ve `response.model` alıyor
(`nvidia_image.py:148`); `usage` alanı okunmadan atılıyor.

İ5 açısından bu bir **negatif kanıt** ve önemli: fallback zinciri ekonomiyi
düşünmeden kurulabilir ve pratikte öyle kuruluyor. Zincirdeki sıra ücretsiz
katmanların *varlığına* göre; hangi modelin ne kadar tuttuğuna göre değil.
Sistem "ücretsizler tükenene kadar dene" mantığında çalışıyor, ki ücretli
sağlayıcı eklendiğinde bu mantık sessizce yanlış hâle gelir.

## Güçlü yönler (kanıtlı)

1. **Sessiz atlama kuralı tek bir yerde ve tutarlı.** Hem
   `_build_chat_chain` (`:116-128`) hem `_build_provider_chain` (`:210-221`)
   "anahtarı yoksa zincire koyma" kuralını uyguluyor; `_run_chat_chain`
   (`:130`) yürütmeyi tek noktada topluyor. Docstring bunu açıkça gerekçe
   olarak yazıyor: "so the actual execution/error-handling logic exists in
   exactly one place" (`nvidia_image.py:133-134`).
2. **Sağlık kontrolü birinci sınıf bir araç.** `check_provider_health`
   (`:669`) tek token'lık canlılık probu atıyor, gerçek içerik üretmiyor;
   `EXTRA_PROVIDERS` ve `VISION_PROVIDERS` arasında paylaşılan modeli
   dedupe ediyor ki aynı oran sınırına iki kez vurulmasın
   (`nvidia_image.py:691-695`). Çıktı araç bazında gruplanıyor
   (`:711-722`) — hangi aracın hangi modeli kullandığı görünür oluyor.
3. **Eşzamanlılık sınırı gerekçeli.** `HEALTH_PROBE_CONCURRENCY = 6`
   (`:256`) ve üstündeki yorum, kapsız `asyncio.gather`'ın kendi kendine
   yaratacağı oran-sınırı patlamasını **gelecek bir risk olarak** tanımlıyor
   ve şimdiden kapatıyor. Bu, "sorun çıkınca bakarız" değil.
4. **Yorum kalitesi olağandışı.** Kaldırılan modelin HTTP 410 kanıtı
   (`:81-85`), Gemini'nin neden zincirde bırakıldığı (`:105-110`),
   Cerebras'ın artık ücretsiz olmadığı (`:108-111`), OpenAI'ın neden
   listede olmadığı (`:94-95`). Karar gerekçeleri kodun yanında — bu,
   "README pazarlamadır" kuralının tersine, koddan gerçek bilgi
   çıkarılabilen nadir bir depo.
5. **Test kapsaması fallback yollarına odaklı.** `tests/` altında
   `test_fallback.py`, `test_check_content_safety_fallback.py`,
   `test_create_embedding_fallback.py`, `test_describe_image_fallback.py`,
   `test_build_chat_chain.py` — yani en kırılgan yol test edilen yol.

## Zayıf yönler (kanıtlı)

1. **İki ayrı fallback uygulaması.** `_run_chat_chain` (`:130`, litellm) ve
   `_chat_with_fallback` (`:229`, ham httpx) aynı problemi iki farklı hata
   sınıflandırmasıyla çözüyor. `check_content_safety` ikisini **arka arkaya**
   kullanıyor (`:588` ham yol, `:610` litellm yolu). Timeout'lar bile farklı:
   biri 18.0s (`:236`), diğeri `LLM_TIMEOUT = 120.0` (`:72`). Aynı çağrının
   ne kadar sürebileceği, hangi kod yolundan geçtiğine bağlı.
2. **Ekonomi körlüğü.** Yukarıda ayrıntılandırıldı: token/maliyet/gecikme
   hiç ölçülmüyor, `response.usage` okunmadan atılıyor (`:148`).
3. **Gözlemlenebilirlik yalnızca `logger.warning`.** Zincirin tamamı
   başarısız olduğunda tek bir satır loglanıyor
   (`nvidia_image.py:145 "all providers in chain failed"`) — **hangi
   sağlayıcının neden düştüğü kaybediliyor**, çünkü litellm zinciri tek bir
   istisnaya sarıyor. Yapılandırılmış iz yok, span yok, korelasyon kimliği
   yok. Fallback'in ne sıklıkla tetiklendiği üretimde ölçülemez.
4. **Yönlendirme statik.** Sağlık probu bir araç olarak var, ama sonucu
   zinciri **etkilemiyor**. `check_provider_health` ölü model bildirir,
   sonraki `ask_llm` çağrısı yine o ölü modeli ilk sırada dener. Bilgi
   üretiliyor ama karara bağlanmıyor.
5. **Sağlayıcı listesi kodda.** Yapılandırmayla değiştirilemez (bkz.
   Genişletilebilirlik).
6. **Belge yok.** `docs/` ve `ARCHITECTURE.md` yok; mimari yalnızca kod
   yorumlarında. Yorumlar iyi ama bir dış okuyucu için 745 satır okumak
   gerekiyor.

## Puan (1–5)

| Ölçüt | Puan | Gerekçe |
|---|---|---|
| olgunluk | 3 | Çalışıyor, CI ve 8 test dosyası var, ama tek kullanıcılı kişisel araç; üretim yükü altında kanıt yok. |
| mimari netlik | 2 | 745 satırlık tek dosya, iki paralel fallback uygulaması, mimari belgesi yok. |
| genişletilebilirlik | 3 | Yeni sağlayıcı tek satır; yeni araç aynı dev dosyaya dokunmak, yapılandırma dışarı alınamıyor. |
| güvenilirlik ilkelleri | 4 | Beş katmanlı fallback, düşürülmüş cevabın etiketlenmesi, hiçbir yardımcının fırlatmaması. Eksik: retry ve circuit breaker. |
| gözlemlenebilirlik | 1 | Yalnızca `logger.warning`; token/maliyet/gecikme/iz yok, zincir hatası tek satıra çöküyor. |
| güvenlik duruşu | 3 | API anahtarı ortamdan, depoda değil; `describe_image` uzantı ve boyut beyaz listesi uyguluyor (`:65-66`), Pollinations indirmesi 20 MB ile sınırlı (`:57`). Ama içerik güvenliği fallback'i "en az yetki" değil "en iyi çaba" — bilinçli ve etiketli. |

## ADR-000 K4 kanıtı

K4: *"Sistem hiçbir LLM sağlayıcısına doğrudan bağlanmaz. Tek bir Model
Router sınırı vardır; tüm çağrılar oradan geçer."*

**Karar: K4'ü güçlendiriyor — ama bir uyarıyla, ve uyarı asıl değerli olan.**

Güçlendiren kanıt: bu depo K4'ün öngördüğü sınırı **kısmen** kurmuş ve
karşılığını almış. `litellm` tek bir çağrı biçimi
(`litellm.acompletion(model=..., api_key=..., fallbacks=[...])`) altında beş
sağlayıcıyı topluyor (`nvidia_image.py:139-147`); yeni sağlayıcı eklemek
gerçekten tek satır (`:96-114`). Sağlayıcının biri (glm-5.2, deepseek-v4-flash)
kalıcı olarak emekli olduğunda (`:81-85`) araçların hiçbiri bozulmadı — liste
düzenlendi, kod aynı kaldı. Sağlayıcı kilidinin maliyeti burada somut olarak
**ödenmemiş**.

**Uyarı — K4'ü çürütmüyor ama sınırın ince kalamayacağını gösteriyor:**
Ortak sınır iki yerde delinmiş, ikisi de kaçınılmaz görünüyor:

1. **NVIDIA'nın `api_base`'i özel muamele istiyor.** `_build_chat_chain`
   NVIDIA modellerini `openai/` öneki + elle verilen `api_base` ile sarmak
   zorunda (`nvidia_image.py:118-121`), ekstra sağlayıcılar ise yalnızca
   `{model, api_key}` (`:124`). Yani "hepsi aynı arayüzden geçer" tam
   değil — bir sağlayıcı için ek alan gerekiyor. Bizim Model Router'ımızın
   sözleşmesi bu tür **sağlayıcıya özel taşıma ayarına yer bırakmalı**;
   yoksa router'ın kendisi if/else'e döner.
2. **Yetenek eşleşmesi ortak sınırda ifade edilemiyor.** Vision için ayrı
   bir liste tutulmak zorunda kalınmış: `VISION_PROVIDERS`
   (`nvidia_image.py:168-172`) ve üstündeki yorum nedenini yazıyor —
   "not every model there is vision-capable (Groq's gpt-oss-120b and
   Mistral's mistral-small are text-only)" (`:160-161`). Yani tek bir
   "sağlayıcı listesi" soyutlaması **yeteneğe göre bölünmek zorunda kaldı**.
   Bu, K4 için doğrudan bir tasarım girdisi: Model Router'ın seçimi
   `(yetenek, maliyet, sağlık)` üçlüsü üzerinden yapması gerekir, düz bir
   sağlayıcı listesi üzerinden değil. Sözleşmedeki `dependencies.models`
   alanı yetenek beyanı taşımalı.

Kaybedilen sağlayıcı özelliği aranmalıydı; **bulunan tek somut kayıp** şu:
`litellm` zinciri başarısız olduğunda hangi sağlayıcının neden düştüğü tek
bir istisnaya çöküyor (`nvidia_image.py:144-146`). Yani ortak sınır, **hata
ayrıntısını** homojenleştirerek kaybediyor. Bu, K4'ü çürütecek ağırlıkta
değil (kabul edilebilir bir kayıp) ama Model Router tasarımında açıkça
karşılanmalı: router, denenen her sağlayıcının sonucunu **ayrı ayrı**
kaydetmeli, sarmalayıp atmamalı.

## Alınacak fikir

- **Düşürülmüş cevabın etiketlenmesi** (`nvidia_image.py:612`) — fallback'ten
  gelen çıktı, çağırana "bu, ilk tercih değildi ve kalibrasyonu düşük" diye
  söylüyor. Bizde: her ajan/araç çıktısı, hangi modelden ve zincirin kaçıncı
  halkasından geldiğini taşımalı; Evaluator bu bilgiyi eşik belirlerken
  kullanabilmeli. İ4'teki "yargı deterministik kaynaktan gelir" desenini
  tamamlar.
- **Zincirin çalışma anında kurulması, yapılandırma anında değil**
  (`:116-128`) — anahtarı olmayan sağlayıcı sessizce atlanıyor, kod
  değişmeden zincir büyüyüp küçülüyor. Bizde: Model Router'ın aday havuzu
  her çağrıda "şu an gerçekten erişilebilir olanlar"dan kurulmalı; statik
  bir konfigürasyon listesi değil.
- **Sağlık probu ayrı ve ucuz bir birinci sınıf işlem** (`:669`) — tek
  token'lık canlılık kontrolü, gerçek istekten ayrı, eşzamanlılık kapaklı
  (`:689`), paylaşılan model dedupe edilmiş (`:691-695`). Bizde: Model
  Router'ın sağlık sinyali böyle toplanmalı ve **bu deponun yapmadığı şey
  yapılmalı** — sonuç zincir sırasına geri beslenmeli.
- **Karar gerekçesinin kodun yanına yazılması** (`:81-85`, `:105-111`) —
  "bu model neden listeden çıktı" sorusunun cevabı kodun içinde ve kanıtlı
  (HTTP 410). Bizde: Model Router'ın model listesi bir veri dosyası olacak;
  her giriş/çıkışın gerekçe ve tarih alanı olsun, ADR'ye gitmeden.
- **Yeteneğe göre ayrı zincir zorunluluğu** (`:160-172`) — negatif
  deneyimden gelen fikir: tek düz sağlayıcı listesi yetmiyor. Bizde
  sözleşmedeki `dependencies.models` yetenek etiketiyle (`text`, `vision`,
  `embedding`, `safety`) beyan edilmeli, router yeteneğe göre havuz seçmeli.

## Alınmayacak

- **İki paralel fallback uygulaması** (`:130` litellm ve `:229` ham httpx) —
  aynı problemin iki çözümü, farklı timeout ve farklı hata sınıflandırmasıyla.
  Bizde tek bir Model Router yolu olacak; "bu çağrı hangi yoldan gitti"
  sorusu hiç sorulmamalı. K4'ün "tek sınır" ifadesi tam olarak bunu yasaklıyor.
- **Zincir hatasının tek istisnaya sarılması** (`:144-146`) — hangi
  sağlayıcının neden düştüğü kaybediliyor. Bizde her deneme ayrı bir olay
  olarak iz'e yazılacak (İ5'in tüm amacı bu).
- **Sağlayıcı sırasının koda gömülmesi** (`:96-114`) — sıralama bir
  politika kararıdır, kod değil. Bizde politika veri olacak; kod politikayı
  okur.
- **Sağlık bilgisinin karara bağlanmaması** — bilgi üretip kullanmamak,
  bilgi üretmemekten daha kötü: maliyeti var, faydası yok.
- **`response.usage`'ın atılması** (`:148`) — sağlayıcı token sayısını
  bedavaya veriyor; okumamak, sonradan geri alınamayacak bir veri kaybı.

## Dürüstlük

- **İncelenmeyenler:** `tests/` klasörünün içeriğini dosya adlarından ötesine
  okumadım; test kalitesi hakkındaki yargım (kapsamanın fallback yollarına
  odaklı olması) yalnızca dosya adlarına dayanıyor. `generate_image` ve
  `describe_image` araçlarının gövdesini (`:399-460`, `:513-568`) satır
  satır okumadım; bu iki araç hakkındaki ifadelerim docstring'lere ve
  sabit tanımlarına dayanıyor.
- **Doğrulanmayan sayılar:** yıldız, watcher, indirme sayısı — ağ sorgusu
  yapılmadı. Depo kişisel ve GitHub'da yeni; bu sayılar zaten kanıt
  değeri taşımaz (protokol §1 "yıldız sayısı kanıt değildir").
- **Kayırma kontrolü:** bu kullanıcının kendi deposu. Gözlemlenebilirliğe 1,
  mimari netliğe 2 verdim; İ5 izinin ana konusunda (maliyet/gecikme
  optimizasyonu) deponun **hiçbir şey yapmadığını** açıkça yazdım. Aynı
  rubrikte `portkey-gateway` (İ4) gözlemlenebilirlikte belirgin şekilde
  yukarıda. Kayırma yok.
- Bu depo İ5'e **model yönlendirme** adayı olarak alındı ama bulgu şu:
  yaptığı şey yönlendirme değil, **failover**. Bu ayrımı iz özetine
  taşımak gerekiyor.
