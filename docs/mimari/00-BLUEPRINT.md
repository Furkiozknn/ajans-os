# 00 — Mimari blueprint

**Tarih:** 2026-09-08 · **Faz:** 3 (mimari sentez) · **Girdi:** Faz 2 çıktıları
(`docs/01-KARSILASTIRMA-MATRISI.md`, `docs/02-EN-IYI-FIKIRLER.md`,
`docs/03-ANTI-PATTERNLER.md`) ve altı iz özeti.

Bu belge tek bir soruya cevap verir: **ajans-os hangi bileşenlerden oluşur ve
neden tam olarak bunlardan?** Cevabın ölçütü ADR-000 K2'dir — dört madde
(çözdüğü problem / önlediği hata / eklediği maliyet / kanıt) yazılamayan
bileşen mimariye girmez, "aday" listesinde bekler.

Yol haritası 18 aday bileşen sayıyordu. Dördü de yazılabilen **13 tanesi
girdi, 5 tanesi girmedi** (§4). Girmeyenler silinmedi; her biri için hangi K2
maddesinin boş olduğu ve **ne olursa girer** yazıldı.

Kararlar: [ADR-001](../adr/ADR-001-bilesen-kumesi.md) …
[ADR-005](../adr/ADR-005-izin-siniri.md).

---

## 1. Tek cümlelik mimari

> Bir görev dosyası **Task Manager**'da kalıcı bir kayda dönüşür;
> **Orchestrator** onu adım adım yürütür; her adımda **Context Manager**
> prompt'u bütçeler, **Permission Manager** araç çağrısına karar verir,
> **Model Router** LLM'e gider, **Evaluator** deterministik olarak geçti/kaldı
> der, kaldıysa **Critic** yapılandırılmış bir düzeltme yazar ve **Recovery
> Manager** modu seçer; her adım sınırında ilerleme yazılır ve **Observability**
> izi kaydeder.

Bu cümlede geçmeyen hiçbir çekirdek bileşen yoktur. Geçmeyen her şey (planlayıcı,
yönlendirici servis, bilgi grafı, guardrail motoru, öğrenme katmanı) §4'tedir.

---

## 2. Bileşenler — K2 dört maddesi

Kısaltmalar: kanıt sütunundaki `Dn` = `docs/02-EN-IYI-FIKIRLER.md` deseni,
`APn` = `docs/03-ANTI-PATTERNLER.md` maddesi, `İn` = araştırma izi.

### 2.1 Orchestrator

Adım döngüsünün sahibi. Görev grafındaki bir sonraki adımı seçer, ajanı
çalıştırır, sonucu Task Manager'a yazdırır. Diğer bileşenleri **o** çağırır;
bileşenler birbirini çağırmaz (ADR-002).

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bir hedefin birden çok ajan çağrısına bölünmesi, sıralanması ve yarıda kesilebilmesi. Somut: bir gece görevi 40 dakikada dört ajan çağrısı yapar; sıra, paralellik ve kesilme noktası bir yerden yönetilmelidir. |
| Önlediği hata | *Dağıtık akış kontrolü* — akışın kimin elinde olduğunun belirsizleşmesi; paralel adımların aynı alana yazması (İ1 §3, LangGraph kanal birleştirici vs. ai-workflow-engine'de mekanizmanın yokluğu). |
| Eklediği maliyet | Bir yürütme modeli seçme zorunluluğu (graf/BSP vs. rol tabanlı, İ1 §6 S1) ve durumun serileştirilebilir olması şartı — canlı nesne tutan tasarımları yasaklar. |
| Kanıt | İ1'de incelenen 7 projenin 7'sinde de var; beşi olgunluk ≥4 (LangGraph 5, CrewAI 5, OpenAI Agents SDK 5, Strands 4, Mastra 3). |

### 2.2 Task Manager

Görevin ve adımlarının kalıcı kaydı; durum makinesinin sahibi. Durumlar en az:
`PLANLANDI → CALISIYOR → (GIRDI_BEKLIYOR | ONAY_BEKLIYOR) → BITTI | BASARISIZ`.

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Süreç ortada ölünce (bütçe duvarı, çökme, elektrik) yapılan işin yok olması; ve "bu adım hiç başlamadı mı, başlayıp yarım mı kaldı" sorusunun cevapsızlığı. |
| Önlediği hata | *Yeniden başlatma amnezisi* (D1) ve *yan etkinin sessiz tekrarı* (02 §5/K1) — tamamlanmış token maliyetinin ikinci kez ödenmesi, yarım kalmış dosya yazmasının ikinci kez yapılması. |
| Eklediği maliyet | Adım sınırı başına iki yazma ("başladı" + "bitti"), I/O ve gecikme; durum makinesi en az iki bekleme durumuyla büyür (`GIRDI_BEKLIYOR`, `ONAY_BEKLIYOR`). |
| Kanıt | D1: 12 olgun proje, 4 bağımsız iz. D4: 7 proje, 3 iz. "Başladı" kaydı için ikinci dal: `BILINEN-TUZAKLAR.md` #7, #13, #20 — üçü de bu ayrımın yokluğundan doğdu. |

### 2.3 Agent Registry

Ajan sözleşmelerinin (`contracts/agent.schema.json`) tek kaynağı; ev sahibi
biçimleri (Claude Code `.md` frontmatter vb.) buradan **türetilir** (K8).

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Yeni ajan eklemek için çekirdeğe dokunmak zorunda kalmak. Somut: `turkce-ajanlar`'a ajan eklerken `arac/web-uret.js`, `arac/banner-uret.js`, `kur.ps1` türetilmiş dosyalarının hepsi elle yenileniyor. |
| Önlediği hata | *Çekirdek çürümesi* (AP7): her yeni ajanın merkezi bir dosyayı büyütmesi ve bileşenin tek başına test edilemez hâle gelmesi. |
| Eklediği maliyet | Bir kayıt defteri bileşeni ve tutarlılık doğrulaması; uzatma noktası bir kez yanlış tanımlanırsa sonradan değiştirmek tüm ajanları kırar. |
| Kanıt | D6: 8 proje, 3 bağımsız iz; ayrıca 5 projede karşıtının (tanrı nesnesi, AP7) kanıtlı zararı. |

### 2.4 Tool Registry

Araç tanımlarının kaynağı. Araç sözleşmesi **yeniden icat edilmez**: MCP'nin
JSON Schema'sı olduğu gibi kullanılır (İ1 D6 — yedi projenin yedisinde de araç
sözleşmesi zaten katı ve şemalı).

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bir ajanın hangi araçları çağırabildiğinin ve her aracın girdi biçiminin makine-okur olması; araç ekleme/çıkarmanın ajan tanımını bozmaması. |
| Önlediği hata | Şemasız araç çağrısı → argüman hatasının ancak çalışma anında görülmesi; ve izin kararının araç adı gibi kırılgan bir anahtara bağlanması. |
| Eklediği maliyet | Kayıt defteri + doğrulama; MCP sunucu tanımlarının senkron tutulması. Yeni sözleşme dosyası **gerekmiyor** (MCP şeması kullanılıyor) — maliyet bu yüzden Agent Registry'den düşük. |
| Kanıt | İ1 D6: 7/7 projede araç sözleşmesi şemalı (Strands `ToolSpec` `types/tools.py:30`, `tools/registry.py:576`; Mastra `StandardSchemaWithJSON`). MCP spesifikasyonu olgunluk 5. |

### 2.5 Permission Manager

Tek geçit: ajan aracı doğrudan çağıramaz, karar buradan çıkar (K6).
Karar **üç değerlidir**: `ALLOW` / `BLOCK` / `HUMAN_REQUIRED`.

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bir ajanın kendisine verilmiş geniş bir kimlik bilgisiyle amaçlanmayan bir hedefe erişmesi. Somut: bu makinede `gh` CLI tam yetkili ve bir PAT dolaşımda; ajanın onu *görmesi* ile "şu depoya şu isteği yap" *yeteneğini* alması aynı şey değil. |
| Önlediği hata | *Yetki sızması* (D12) ve *sessiz izin* (D11) — kontrol edilmemiş bir işlemin onaylanmış gibi geçmesi. "Kontrol edilmedi" ile "kontrol edildi, temiz" ayrı değerlerdir. |
| Eklediği maliyet | Sır enjeksiyon mekanizması (bu makinede KVM yok/Windows olduğu için hipervizör yolu kapalı → proxy süreç veya ayrı kullanıcı hesabı); üçüncü bir "bilinmiyor" değeri her karar noktasına girer; insan kapısına düşen çağrı sayısı artar → gece otonomisi azalır. |
| Kanıt | D12: 3 olgun bağımsız kaynak (A2A olgunluk 5, MCP 5, microsandbox 3) + 2 projede yokluğunun zararı. D11: 4 kaynak, 2 iz. AP1: 5 izde 9 kaynak — kapının bir yapılandırma değeri olmasının zararı. |

### 2.6 Memory Manager

Katmanlı bellek; kaynak kayıt korunur, üzerine yazılmaz (D5). Belleğe yazmak
bir **izin işlemidir** (AP9 → kural 10).

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Türetilmiş bir kaydın (özet, çıkarım, düzeltme) yanlış olması durumunda geri dönülecek yer olmaması. Somut: bir gece koşusunun bellek yazımı hatalıysa sabah düzeltilebilmeli. |
| Önlediği hata | *Geri döndürülemez sıkıştırma* ve *sessiz bilgi kaybı* (D5); ayrıca AP9 — bellek yolunda gizlilik kararının hiç verilmemesi (İ2'de 7/7 proje). |
| Eklediği maliyet | Depolama büyür ve küçülmez; her okuma "geçerli olanı seç" filtresinden geçer; gerçek silme (PII/uyum) ayrı ve bilinçli bir mekanizma gerektirir, çünkü varsayılan artık silmemek. |
| Kanıt | D5: 8 proje, 3 bağımsız iz (graphiti bi-temporal `edges.py:271-282` dahil) + iki öğretici karşıt örnek. AP9: 7/7 proje — ekosistemin **atladığı** problem, bizde sıfırdan tasarlanır. |

### 2.7 Context Manager

Prompt bütçesinin sahibi. Formül (LightRAG'den, doğrudan alınır):
`kalan = toplam − (sistem sözleşmesi + görev durumu + bilgi + sorgu + tampon)`.
Eşik %100'ün altındadır ve kısılma sırası **önceden yazılır**.

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bağlam penceresinin sessizce taşması veya sessizce kalite kaybetmesi. Somut: bir görev dosyası + tuzak listesi + iz özetleri aynı prompt'a giriyor; hangisinin kırpılacağı önceden yazılı olmalı. |
| Önlediği hata | *Sessiz bağlam taşması* (İ2 AP1: cognee `resolve_edges_to_text.py:61-97` kırpma yapmıyor; mem0 proxy dönen bütün anıları yapıştırıyor `proxy/main.py:176-186`) ve *sessiz kalite düşüşü*. Ayrıca AP11: retry döngüsünde bağlamın sınırsız büyümesi. |
| Eklediği maliyet | Her çağrıda token sayımı; yaklaşık sayaçta güvenlik payı gerekir (Letta %30) ve pay boşa harcanan penceredir; kesin sayım sağlayıcı başına tokenizer demek — K4 ile gerilimli. |
| Kanıt | D9: 4 olgun proje aynı formülü bağımsız buldu (İ2), 2 proje yokluğunun zararını gösterdi (İ4). D10: 5 proje, 2 iz + kendi arızamız (#7, #15). |

### 2.8 Evaluator

Geçme kararını **tek başına** verir ve yalnızca deterministik kaynaklardan
beslenir (çıkış kodu, şema doğrulaması, test, eşik). İki fonksiyon:
`gecerli_mi()` ve `esigi_asti_mi()` (ADR-004).

| Madde | Cevap |
|---|---|
| Çözdüğü problem | LLM-as-judge tuzağı: modelin kendi çıktısını onaylaması. Somut: gece çalışan bir görev kendini "bitti" işaretler, doğrulama yapılmamıştır. |
| Önlediği hata | *Sahte yeşil* — geçmemiş işin geçmiş sayılması ve ölçülemeyen kalite sürüklenmesi (D3); AP5 — sinyal ile karar arasındaki bağın ters kurulması. |
| Eklediği maliyet | Her değerlendirilebilir çıktı türü için deterministik bir doğrulayıcı yazma yükü. Doğrulayıcısı olmayan çıktı için "değerlendirilmedi" yazmak zorunludur (D11) — bu da insan kapısına düşen iş demektir. |
| Kanıt | D3: 8 proje, 3 bağımsız iz. Kendi arızamız: `BILINEN-TUZAKLAR.md` #7 — görev "bitti" işaretini koyup doğrulamayı yapamadan kesildi. |

### 2.9 Critic

Bir LLM'dir ve **oyu geçme kararına girmez**. Yalnızca "neden başarısız oldu,
sonraki denemede ne yapılmalı" yazar; çıktısı serbest metin değil,
`contracts/message.schema.json` içinde tanımlı bir alandır.

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Doğrulayıcının bulduğu hatanın modele hiç ulaşmaması veya serbest metin olarak ulaşıp göz ardı edilmesi. |
| Önlediği hata | *Aynı hatanın tekrarı* — düzeltme sinyali taşınmadığı için retry'ın kör retry'a dönüşmesi (D8). |
| Eklediği maliyet | Her başarısızlıkta ek bir LLM çağrısı; girdi şeması her düzeltme turunda büyür → token maliyeti. Üst sınır **sözleşmede zorunlu** (Reflexion `agents.py:113` hiç budamıyor, maliyet deneme sayısıyla doğrusal büyüyor — AP11). |
| Kanıt | D8: 4 proje, 2 bağımsız iz. D3 ile aynı kanıt kümesinin diğer yüzü: yargı deterministik kaynaktan, eleştiri LLM'den. |

### 2.10 Recovery Manager

Hata türüne bakıp modu seçer: *düzelt* (bağlamı koru, eleştiriyi ekle) veya
*temiz sayfa* (bağlamı at, baştan). Backoff + jitter varsayılan açık.
"Rollback" kelimesi kullanılmaz (AP8 → kural 9): yerine *durumu geri sarma* ve
*telafi*; telafisi olmayan geri alınamaz eylem insan kapısına düşer.

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Retry'ın hangi hatada anlamlı olduğunu bilmemek ve düzeltme döngüsünün aynı hatayı üç kez tekrarlayıp bütçe yakması. Somut: 429 aldıysa beklemek gerekir, `SyntaxError` aldıysa beklemek üç kat maliyet çıkarır. |
| Önlediği hata | *Kör retry* (D7) ve *yerel minimum kilitlenmesi* (D13). |
| Eklediği maliyet | Her hata üreten bileşen sınıflandırma yapmak zorunda; sınıflandırılmayan hata için güvenli taraf varsayılanı (retry etme) gerekir. İki ayrı sayaç ve iki politika alanı; "temiz sayfa" modu tüm bağlamı attığı için daha pahalıdır. |
| Kanıt | D7: 5 proje, 2 iz (Temporal'ın bayrağı hata nesnesinde; litellm `_is_cooldown_required` `cooldown_handlers.py:205-251`). D13: 3 proje, 2 iz — kanıt eşiği en düşük olan desen, sınırda geçti. D1: 12 proje (geri sarma tarafı). |

### 2.11 Model Router

Tek model sınırı (K4). Sınır **seçim** ile **taşıma** arasından geçer: seçim
mantığı %100 sağlayıcı-agnostik, taşıma/isimlendirme katmanı sağlayıcıya özel.
Sözleşme en az üç alan taşır: taşıma ayarı, yetenek beyanı, açık uçlu
usage/cost sözlüğü (kalıcı çöp kutusu değil, çekirdeğe terfi bekleme odası).

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Sağlayıcı kilidi. Somut: bu makinede LiteLLM proxy iskeleti kuruldu ve anahtar bekliyor; sağlayıcı değişimi çekirdeği bozmamalı. |
| Önlediği hata | Bir sağlayıcının kotası/fiyatı/kesintisi tüm sistemi durdurması; ve *sessiz sürüklenme* — "bağımsızız" deyip karar katmanında tek satıcıya bağlanma (AP4: 3 izde 8 proje). |
| Eklediği maliyet | Bir soyutlama katmanı ve bakımı; sağlayıcıya özel yeteneklerin en küçük ortak paydaya inme riski; açık uçlu uzantı sözlüğünü tutma yükü. |
| Kanıt | D2: 15 proje, 3 bağımsız iz (LangGraph çekirdeğinde sıfır sağlayıcı bağımlılığı; Strands `models/model.py:181`; litellm'in dört seçim stratejisi tamamen agnostik). Öğretici karşıt örnek: RouteLLM karar katmanına sabit istemci gömüyor. |

### 2.12 Cost Manager

Bütçenin sahibi. Eşik aşılınca **planlı faz geçişi**: elindeki kısmi çıktıyı
yaz, sonra dur (SWE-agent autosubmission). Fiyat tablosu **veridir, koda
gömülmez**; bilinmeyen maliyet `null`, sıfır değil (AP10 → kural 11) ve
tablonun güncelleme prosedürü belgede yazılıdır.

| Madde | Cevap |
|---|---|
| Çözdüğü problem | Bir kaynak sınırına (bütçe, süre) çarpıldığında yapılmış işin kaybolması. Somut: 6 USD bütçe dolduğunda süreç anında ölüyor ve yazılmamış her şey gidiyor. |
| Önlediği hata | *Sıfır çıktılı kesilme* (D10) — yaşandı: dört paralel alt ajan bütçenin %90'ını yaktı, özet yazılamadı. Ve AP10 — statik/güncellenmeyen fiyat kataloğunun sessizce yanlış maliyet raporlaması. |
| Eklediği maliyet | Her sınır için bir tahliye yolu yazmak ve test etmek; özetleme kayıplıdır; fiyat tablosunun elle bakımı (iki olgun projenin de atladığı adım — Langfuse `schema.prisma:784-839`, LiteLLM `model_prices_and_context_window.json`). |
| Kanıt | D10: 5 proje, 2 iz + kendi arızamız (#7, #15, #18). AP10: 3 proje. İ5 Ö3: hiçbir standart (OTel dahil) USD taşımıyor, iki bağımsız proje kendi tablosunu kurmuş. |

### 2.13 Observability

İz (trace) modeli, OTel GenAI semantic conventions uyumlu. K7'nin
(izler → değerlendirme → öneri) girdi ucu. Ölçülmemiş detektör **gölge modda**
başlar (AP5 → kural 6).

| Madde | Cevap |
|---|---|
| Çözdüğü problem | "Bu koşuda ne oldu, para nereye gitti, hangi adım kaç saniye sürdü" sorusunun koşu bittikten sonra cevaplanamaması. Somut: `loglar/` bugün ham metin; hangi ajan çağrısının kaça mal olduğu çıkarılamıyor. |
| Önlediği hata | *Ölçülemeyen sürüklenme* — K7'nin öneri üretimi kanıtsız kalır; ve maliyet/gecikme kararlarının hisle verilmesi. |
| Eklediği maliyet | Her adımda span üretimi ve saklama; alan adlarının OTel'in kırıcı değişikliklerini takip etme yükü (ör. "ajan span'i model bilmez" inceltmesi, `changelog.d/469.breaking.md`). |
| Kanıt | 2 olgun bağımsız kaynak: OTel GenAI semconv (canlı, standart) ve Langfuse (olgunluk 4, gözlemlenebilirlik 4 — matriste bu sütunun lideri). Ayrıca ADR-000 K7 bu girdiyi zaten zorunlu kılıyor. |

---

## 3. İletişim ve veri akışı

### 3.1 Bileşen diyagramı

Ok yönü **çağrı** yönüdür. Orchestrator dışında hiçbir bileşen başka bir
bileşeni çağırmaz (ADR-002); Observability tek yönlü **dinleyicidir**.

```
                       gorevler/bekleyen/*.md
                                │
                                ▼
                        ┌───────────────┐
                        │ Task Manager  │◄──── durum makinesi + adım kaydı
                        └───────┬───────┘
                                │ sonraki adım
                                ▼
   ┌────────────────┐   ┌───────────────┐   ┌──────────────────┐
   │ Agent Registry │──►│               │◄──│ Context Manager  │◄─┐
   └────────────────┘   │               │   └──────────────────┘  │
   ┌────────────────┐   │  Orchestrator │   ┌──────────────────┐  │
   │ Tool Registry  │──►│               │──►│ Permission Mgr.  │  │
   └────────────────┘   │   (adım       │   └────────┬─────────┘  │
                        │    döngüsü)   │            │ HUMAN_REQ. │
   ┌────────────────┐   │               │            ▼            │
   │  Model Router  │◄──│               │   raporlar/ONAY-BEKLEYENLER.md
   └───────┬────────┘   │               │            │            │
           │ usage      │               │◄───────────┘ (onay olayı)
           ▼            │               │                         │
   ┌────────────────┐   │               │   ┌──────────────────┐  │
   │  Cost Manager  │──►│               │──►│    Evaluator     │  │
   └────────────────┘   │               │   └────────┬─────────┘  │
        eşik/dur        │               │            │ kaldı      │
                        │               │            ▼            │
                        │               │   ┌──────────────────┐  │
                        │               │◄──│      Critic      │  │
                        │               │   └──────────────────┘  │
                        │               │   ┌──────────────────┐  │
                        │               │◄─►│ Recovery Manager │  │
                        │               │   └──────────────────┘  │
                        └───────┬───────┘                         │
                                │ okuma/yazma                     │
                                ▼                                 │
                        ┌───────────────┐                         │
                        │Memory Manager │─────────────────────────┘
                        └───────────────┘        (bağlam girdisi)

   ═══ her adımdan tek yönlü span ═══►  ┌───────────────┐
                                        │ Observability │
                                        └───────────────┘
```

### 3.2 Bir adımın veri akışı

```
1.  Task Manager   → adım kaydı yazılır: durum=BASLADI (yan etki öncesi)
2.  Agent Registry → ajan sözleşmesi (agent.schema.json)
3.  Memory Manager → ilgili kayıtlar (yalnızca geçerli olanlar)
4.  Context Manager→ bütçe uygulanır, kısılma sırası önceden yazılı
5.  Model Router   → LLM çağrısı; dönüş: içerik + usage
6.  Cost Manager   ← usage; bütçe eşiği aşıldıysa faz geçişi tetiklenir
7.  Araç çağrısı varsa:
      Tool Registry → araç şeması (MCP)
      Permission Mgr→ ALLOW | BLOCK | HUMAN_REQUIRED
        HUMAN_REQUIRED → Task Manager durum=ONAY_BEKLIYOR (kesintili),
                         ONAY-BEKLEYENLER.md'ye satır, süreç ölebilir
8.  Evaluator      → gecerli_mi() / esigi_asti_mi()   [deterministik]
        kaldıysa → Critic → message.schema.json içinde düzeltme alanı
                 → Recovery Manager → mod: düzelt | temiz sayfa | durdur
9.  Task Manager   → adım kaydı: durum=BITTI + sonuç özeti
10. Observability  ← 1–9 arasındaki her olay için span (tek yönlü)
```

### 3.3 Sözleşmeler (K3)

| Sözleşme | Durum | Kimler okur |
|---|---|---|
| `contracts/agent.schema.json` | var | Agent Registry, Orchestrator, Evaluator |
| `contracts/task.schema.json` | Faz 3 "Orchestration Architecture" maddesinde yazılacak | Task Manager, Orchestrator |
| `contracts/message.schema.json` | aynı madde | Critic, Orchestrator, Observability |
| `contracts/permission.schema.json` | Faz 3 "Security Architecture" maddesinde yazılacak | Permission Manager, Tool Registry |
| araç şeması | **yeni sözleşme yazılmaz** — MCP'nin JSON Schema'sı kullanılır | Tool Registry |

---

## 4. Mimariye girmeyen bileşenler

K2 dört maddesi yazılamadı. Silinmediler; **ne olursa girer** yazılı.

### 4.1 Planner (hedef → görev grafı)

| Madde | Durum |
|---|---|
| Problem | ✅ Serbest bir hedefin yürütülebilir adımlara bölünmesi. |
| Önlediği hata | ⚠ Elle yazılmış görev dosyasının eksik kalması — ama bugün görev dosyalarını insan yazıyor ve eksiklik yaşanmadı. |
| Maliyet | ⚠ Ayrı bir bileşen + plan doğrulama; İ4 iki yolu tartışıp "plan üretimini kendisi bir adım yap" seçeneğini daha basit buluyor. |
| **Kanıt** | ❌ **Ayrı bir planlayıcı bileşen için yinelenen desen yok.** İ1'in altı yinelenen deseninin hiçbiri planlama değil; dinamik plan üretimi tek projede (CrewAI hierarchical) ve orada da bir *ajan rolü*, çekirdek bileşen değil. |

**Karar:** plan üretimi bir **ajan rolüdür**, çekirdek bileşen değil — çıktısı
bir görev grafıdır, onu Orchestrator yürütür. **Ne olursa girer:** ikinci bir
olgun projede planlayıcının çekirdek bileşen olarak ayrıldığı gösterilirse,
veya elle yazılmış görev dosyasının yetmediği bir arıza yaşarsak.

### 4.2 Router (görev → ajan) ayrı servis olarak

| Madde | Durum |
|---|---|
| Problem | ✅ Bir adımı hangi ajanın yapacağına karar vermek. |
| Önlediği hata | ⚠ Yanlış ajana düşen iş — ama bunun ayrı bir servisle çözüldüğü örnek yok. |
| **Maliyet** | ❌ **Karşılığı olmayan bir bileşen:** ekosistem bunu zaten bedavaya çözmüş. |
| Kanıt | ❌ İ1 D5 tam tersini söylüyor: *"Yönlendirme = bir sonraki ajanı belirten dönüş değeri… ayrı bir servis değil, adım çıktısının bir alanı."* (OpenAI SDK `run.py:1409-1414`, LangGraph `types.py:704,799`). |

**Karar:** yönlendirme, adım çıktısının bir alanıdır; Orchestrator + Agent
Registry bunu karşılar. **Ne olursa girer:** iki olgun projede yönlendirmenin
ayrı bir bileşen olduğu ve bunun somut bir kazanç sağladığı gösterilirse.

### 4.3 Knowledge Layer (graf tabanlı bilgi katmanı)

| Madde | Durum |
|---|---|
| **Problem** | ❌ **Somut, örnekli bir problem yazılamıyor** — `docs/02-EN-IYI-FIKIRLER.md` A3'ün kendi tespiti: "graf olmadan çözülemeyen somut bir kullanım senaryomuz var mı? Bugün yok." |
| Önlediği hata | ⚠ İlişki sorularının cevapsız kalması; bizim ölçeğimizde böyle bir soru henüz yok. |
| Maliyet | ✅ Ölçülü ve yüksek: yazma başına birden çok LLM çağrısı. mem0 v2'de grafı OSS'ten çıkardı. |
| Kanıt | ✅ 4 olgun proje. |

**Karar:** bilgi ihtiyacı Memory Manager'ın katmanlarıyla karşılanır.
**Ne olursa girer:** grafsız çözülemeyen somut bir senaryo yazıldığında.

### 4.4 Security / Guardrails (ayrı denetim motoru)

| Madde | Durum |
|---|---|
| Problem | ✅ Güvenilmeyen içeriğin/kodun zarar vermesi. |
| Önlediği hata | ✅ Prompt enjeksiyonu, kontrolsüz çalıştırma. |
| **Maliyet** | ❌ **Bugün uygulanamaz:** sandbox yolu kapalı (bu makinede KVM yok ve Windows → microsandbox çalışmaz; E2B bulut, kod dışarı çıkar → K4 ve gizlilikle çelişir). |
| **Kanıt** | ❌ Detektör tarafında iki olgun bağımsız kaynak yok: LlamaFirewall'ın tarayıcıları kendi deposunda EXPERIMENTAL (AP5), mcp-vet kullanıcının kendi deposu (olgunluk 2, matris kuralı gereği kanıt sayılmaz). |

**Karar:** güvenlik sınırı ayrı bir motor değil, **Permission Manager**'dır
(D12). Bu **bilinçli bir zayıflık** olarak kaydedilir. Detektörler ileride
gelirse kural 6 gereği **gölge modda** başlar — sinyal üretir, yetki almaz.
**Ne olursa girer:** Windows'ta çalışan ve kodu dışarı çıkarmayan bir izolasyon
katmanı, veya üretimde ölçülmüş ikinci bir bağımsız detektör.

### 4.5 Learning Layer

| Madde | Durum |
|---|---|
| Problem | ✅ Sistemin kendi izlerinden ders çıkarmaması. |
| Önlediği hata | ⚠ Aynı hatanın tekrarı — ama bugün bunu `BILINEN-TUZAKLAR.md` elle karşılıyor ve çalışıyor (21 madde). |
| Maliyet | ⚠ Öneri sözleşmesi + sürümleme + geri alma + sürüklenme tespiti; K7'nin insan kapısı zaten akışı insana bağlıyor. |
| **Kanıt** | ❌ İ6'nın K7 sonucu net: **insan kapısız kendini-değiştirmenin üretimde güvenle çalıştığı tek bir örnek yok.** Kapılı öneri üretimi tarafında da olgun ikinci kaynak yok — A2'nin üç adayı (DGM tarihî, OpenEvolve 0.x, GEPA 0.1.4) hiçbiri olgun değil. |

**Karar:** Faz 3'ün **"Self-improvement Architecture"** maddesine devredilir; o
madde ADR-000 K7 çerçevesinde bu kararı yeniden ele alır. Blueprint'e bir
çekirdek bileşen olarak **girmez**; Observability'nin iz çıktısı ve
Evaluator'ın sonuçları o maddenin girdisidir ve bugünden hazırdır.
**Ne olursa girer:** kapılı öneri üretiminin üretimde çalıştığı ikinci bir
olgun örnek, veya elle tuzak kaydının yetmediği ölçülmüş bir arıza.

---

## 5. Bağlayıcı kurallar — nerede karşılanıyor

`docs/03-ANTI-PATTERNLER.md` §6'nın 12 kuralı ve nereye düştükleri:

| # | Kural | Karşılayan |
|---|---|---|
| 1 | Sabit sınırlar config'ten okunmaz | Permission Manager · [ADR-005](../adr/ADR-005-izin-siniri.md) |
| 2 | Onay bir durumdur | Task Manager · [ADR-003](../adr/ADR-003-ilerleme-kaydi.md) |
| 3 | Karar algoritması tek yerde | Orchestrator · [ADR-002](../adr/ADR-002-yurutme-ve-iletisim.md) |
| 4 | Garanti cümlesi kodun sağladığından fazlasını söylemez | Bu belgenin kendisi: her iddia kanıt sütunlu |
| 5 | Bağımsızlık üç eksende sınanır | Model Router (§2.11) + Observability (§2.13) |
| 6 | Her sinyalin bir tüketicisi ve yetki seviyesi var | Observability (§2.13), Guardrails gölge modu (§4.4) |
| 7 | Kapsam belirtilmemişse sonuç boş kümedir | Permission Manager · ADR-005 |
| 8 | Bileşenin testi diğerlerini başlatmadan koşar | ADR-002 (bileşenler birbirini çağırmaz) |
| 9 | "Rollback" kelimesi mimariye girmez | Recovery Manager (§2.10) — bu belgede o kelime yalnızca yasağın kendisini yazarken, tırnak içinde geçiyor (§2.10 ve bu satır); hiçbir bileşen davranışı onunla adlandırılmadı |
| 10 | Belleğe yazmak bir izin işlemidir | Memory Manager (§2.6) → Faz 3 "Memory Architecture" |
| 11 | Katalog veridir, koda gömülmez; bilinmeyen maliyet `null` | Cost Manager (§2.12) |
| 12 | Yansıma belleği sınırlıdır, ham kayıt korunur | Critic (§2.9) + Context Manager (§2.7) |

## 6. Açık soruların dağıtımı

`docs/02-EN-IYI-FIKIRLER.md` §7'nin yedi sorusu:

| Soru | Nerede karara bağlandı |
|---|---|
| S1 kayıt birimi (tablo mu event log mu) | [ADR-003](../adr/ADR-003-ilerleme-kaydi.md) |
| S2 "başladı" checkpoint'inin maliyeti | [ADR-003](../adr/ADR-003-ilerleme-kaydi.md) |
| S3 onay sonrası yan etki tekrarı | [ADR-003](../adr/ADR-003-ilerleme-kaydi.md) |
| S4 deterministik kaynağı olmayan çıktı | [ADR-004](../adr/ADR-004-degerlendirme-kapisi.md) |
| S5 uzatma noktaları izinden muaf mı | [ADR-005](../adr/ADR-005-izin-siniri.md) |
| S6 yaklaşık mı kesin tokenizer mı | **Bu belgede değil** → Faz 3 "Memory Architecture" (bağlam penceresi yönetimi orada) |
| S7 izin sürüme bağlansın mı (A1) | **Bu belgede değil** → Faz 3 "Security Architecture"; yol haritası bu maddeyi zaten oraya bağlamış |

İ1 §6'nın soruları: S1 (graf mı rol mü) ve S3 (paralel yazma çakışması)
ADR-002'de; S2 (deterministik replay) `02` §4/A4'te zaten elenmişti; S4
(sözleşme katılığı) Faz 3 "Agent Architecture"; S5 (`ai-workflow-engine`
yeniden kullanılacak mı) Faz 4 "Repository / folder structure".

---

## 7. Dürüstlük

- Bu belge **yeni kanıt üretmedi.** Kaynağı Faz 2'nin üç belgesi ve altı iz
  özetidir; bu turda hiçbir klona girilmedi, hiçbir `dosya:satır` yeniden
  doğrulanmadı. Buradaki alıntıların güvenilirliği altındaki katmanların
  denetim durumuna eşittir (altı izin altısında da `DENETIM.md` var, altısının
  kararı "sentezde kullanılabilir").
- **Kanıt gücü eşit değil.** D13 (Recovery Manager'ın iki modu) 3 proje / 2 izle
  sınırda geçti; D12 (Permission Manager'ın varsayılan kapalı ilkesi) tek izden
  geliyor. Bu iki bileşen mimariye giriyor ama kanıt zincirleri diğerlerinden
  zayıf — Faz 4'te bunlara ayrı dikkat gerekir.
- **Beş bileşenin dışarıda kalması bir eksiklik değil, K2'nin çalıştığının
  kanıtıdır** — ama bedeli var: Planner yokken hedef→görev dönüşümünü insan
  yapar, Guardrails yokken tek savunma Permission Manager'dır. İkisi de bilinçli
  ve kayıtlı zayıflıktır.
- **Sayılmayan şey:** bileşenlerin birbirine bağımlılık sırası (hangi bileşen
  hangisinden önce yazılır) bu belgede yok; Faz 4 "Repository / folder structure
  ve core interfaces" maddesinin işi.
