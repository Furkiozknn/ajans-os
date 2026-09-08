# 05 — Güvenlik mimarisi

**Faz 3 · Mimari sentez.** Karar kaynakları:
[ADR-000](../adr/ADR-000-program-ve-ilkeler.md) K6,
[ADR-005](../adr/ADR-005-izin-siniri.md),
[ADR-007](../adr/ADR-007-izin-surum-bagi.md).
Kanıt kaynağı: [İ3 iz özeti](../arastirma/i3-arac-guvenlik/OZET.md).
Sözleşme: [`contracts/permission.schema.json`](../../contracts/permission.schema.json)
+ dört örnek (`contracts/ornek/izin/`).

Bu belge yeni bir bileşen eklemez. ADR-005 ve ADR-007'nin kararlarını
**işleyen** hâle getirir: Permission Manager'ın içinden neyin nasıl geçtiğini,
hangi kapının kimin tarafından açılamayacağını ve bir hata olduğunda neyin
neyden yalıtıldığını yazar.

Bir cümlelik özet: **ajan yetenek ister, kapı karar verir, sır ajana hiç
ulaşmaz, ve verilen izin bileşenin o anki hâline bağlıdır.**

---

## 1. Neden bu katmanı biz yazıyoruz

İ3'ün en güçlü ve en çok tekrarlanan bulgusu (D1): **protokoller güvenliği
tanımlar, zorlamaz.** MCP'de zorlayıcı bir izin katmanı yok, host'a devredilmiş
(`mcp-spec.md` §Mimari). A2A neredeyse aynı cümleyi kuruyor:

> Authorization boundaries are defined by each agent's authorization model,
> **not prescribed by the protocol**

(`specification.md:3105`). İki bağımsız, rakip spesifikasyon aynı kararı
vermiş. Sonuç tektir: **bu katmanı biz yazmazsak kimse yazmıyor.**

Bu bir tercih değil, boşluğun tespiti. Ve boşluk tek başına gelmiyor: blueprint
§4.4'te ayrı bir guardrail motoru **mimariye giremedi** (sandbox yolu bu
makinede kapalı, detektör tarafında iki olgun bağımsız kaynak yok). Yani
Permission Manager burada **tek** savunmadır. Bu, mimarinin bilinen en zayıf
noktasıdır ve §7'de açıkça sayılıdır.

---

## 2. Permission Manager: tek geçit

### 2.1 Konumu

`00-BLUEPRINT.md` §3.2'nin 7. adımı: araç çağrısı varsa önce Tool Registry
araç şemasını verir, sonra Permission Manager karar verir. Ajan aracı doğrudan
çağıramaz (K6). Bileşenler birbirini çağırmaz (ADR-002): kapıyı **yürütme
döngüsü** çağırır, araç değil.

Bunun pratik sonucu: bir aracın kendi içinde "bu izinli mi" diye sorması
yasaktır. İkinci bir karar noktası, kural 3'ün ("karar algoritması tek yerde")
ihlalidir ve sonucun hangi yoldan geçildiğine bağlı olmasına yol açar — İ3'ün
AP3'ü tam olarak budur (LlamaFirewall'da sync ve async yolların farklı karar
birleştirme mantığı, `llamafirewall.py:141-160` vs `167-182`).

### 2.2 Girdi ve çıktı

Girdi dört parçadır: **kim** (`requester`), **ne** (`action`), **nerede**
(`scope`), **hangi bileşenle** (`binding`). Çıktı tek bir kayıttır:
`permission.schema.json`'a uyan bir izin kararı. Kayıt yoksa çağrı da yoktur —
"karar verilmedi ama çalıştı" diye bir durum tanımlı değildir.

### 2.3 Karar üç değerlidir

`ALLOW` / `BLOCK` / `HUMAN_REQUIRED` (LlamaFirewall
`llamafirewall_data_types.py:22-25`). Üçüncü değer bir kolaylık değil,
mimarinin taşıyıcı elemanıdır: onay bir yan mekanizma değil, birinci sınıf bir
sonuçtur. A2A'da karşılığı protokolün durum makinesinde: `TASK_STATE_AUTH_REQUIRED`
ayrı bir enum değeri ve "interrupted state" olarak belgelenmiş
(`a2a.proto:206-207`), `INPUT_REQUIRED`'dan ayrı tutulmuş — **"bilgi eksik" ile
"yetki eksik" farklı şeylerdir** (İ3 D2).

`HUMAN_REQUIRED` bir Permission Manager çıktısıdır. **İnsanın kararı yalnızca
iki değerlidir** (`ALLOW`/`BLOCK`) ve `message.schema.json`'ın
`approval_decision` mesajıyla gelir. Kapı kendi kendine onay veremez.

### 2.4 İki eksen, tek skor yok

`severity` (şiddet: `dusuk`/`orta`/`yuksek`) ve `reliability` (güvenilirlik:
`kontrol-edilmedi`/`zayif`/`guclu`) **ayrı alanlardır**. mcp-vet'in
`models.py:9-16` ayrımı budur; `risk.py:3-7` genel kararın alanların *en
kötüsü* olduğunu, ortalaması olmadığını söylüyor.

Tek bir `risk_score` alanı **şemada tanımlı değildir** ve
`additionalProperties: false` olduğu için uydurulamaz. Doğrulayıcının öz-testi
bunu ayrıca sınıyor (`izin: tek "risk skoru" alanı uydurulamaz`). Gerekçe: iki
bağımsız sinyali tek sayıya ezmek AP5'in mekanizmasıdır — sinyalin
güvenilirliği kararın ağırlığına karışır ve ikisi bir daha ayrılamaz.

### 2.5 "Kontrol edilmedi" ≠ "temiz"

`checks[]` dizisindeki her denetleyicinin sonucu dört değerlidir:
`gecti` / `kaldi` / `calistirilmadi` / `hata`. Son ikisi birincisi sayılmaz.
Kaynak, mcp-vet'in `Severity.NOT_FLAGGED` alanını bilerek `SAFE` diye
adlandırmaması:

> mcp-vet never concludes that something is safe, only that a given check did
> not fire

(`models.py:34-40`), ve çalıştırılamamanın ayrı bir çıkış kodu olması
(`risk.py:35` `EXIT_ERROR = 4`).

Bu ayrım üç yerde zorlanıyor — ikisi şemada, biri çapraz kontrolde:

| Kural | Nerede |
|---|---|
| `reliability: kontrol-edilmedi` iken `ALLOW` yazılamaz | şema `if/then` |
| Hiç denetleyici çalışmadıysa `reliability` `kontrol-edilmedi` olmalı | `izinCaprazKontrol` |
| `hata` veya `calistirilmadi` varken `reliability: guclu` olamaz | `izinCaprazKontrol` |
| Denetleyici hatası varken `ALLOW` verilemez | `izinCaprazKontrol` |

Sonuncusu İ3 D5'in doğrudan karşılığı: LlamaFirewall'da bir denetleyici çağrısı
başarısız olursa sonuç `ALLOW` değil `HUMAN_IN_THE_LOOP`
(`alignmentcheck_scanner.py:125-131`). **Hata yolu güvenli tarafa düşer.**
Gece koşularımız için bu doğrudan geçerlidir: denetleyici çöktüğü için sessizce
geçen bir çağrı, denetlenmemiş bir çağrıdır.

### 2.6 Ölçülmemiş detektör yetki almaz

`checks[].shadow: true` bir denetleyiciyi **gölge moda** alır: sinyal üretir,
karara etki etmez (kural 6). Bu, AP4'ün karşılığıdır — LlamaFirewall'ın en
ilginç iki tarayıcısı kendi deposunda `[EXPERIMENTAL]`
(`custom_check_scanner.py:28`), mcp-vet'in 560 satırlık regex kataloğunun
yanlış pozitif oranı hiç ölçülmemiş. Çapraz kontrol, gölge moddaki bir
denetleyicinin tek başına `BLOCK` gerekçesi olmasını reddediyor.

Gölge moddan çıkış ölçüyle olur, kanaatle değil: `04-DEGERLENDIRME.md`'nin
altın/mutant/ölçülemez üçlüsü yazılmamış bir detektör kapıya bağlanmaz.

---

## 3. En az yetki

### 3.1 Varsayılan: boş küme

`agent.schema.json`'ın `permissions` alanı zaten "açıkça verilmeyen her şey
yasak" diyor. Bu belge ona bir kural ekliyor: **kapsam belirtilmemişse sonuç
boş kümedir, "hepsi" değil** (AP6 → kural 7, ADR-005/3).

`permission.schema.json` bunu `scope` alanında `minItems: 1` ile zorlar. Boş
dizi geçersizdir; "kapsamsız yazma izni" diye bir kayıt yazılamaz. Yıkıcı bir
işlemde kapsamsızlık bir **hata**dır, sessizce genişletilecek bir eksiklik
değil.

### 3.2 Kapsam neyle eşleşir

`action.operation` yedi değerlidir: `read`, `write`, `execute`, `network`,
`delete`, `publish`, `memory_write`. **Bu izin sınıfı araç adından
türetilmez.** Blueprint §2.4'ün önlediği hata budur: izin kararının araç adı
gibi kırılgan bir anahtara bağlanması. `Bash` aracı hem `read` hem `execute`
yapabilir; karar aracın adına değil, çağrının ne yaptığına bakar.

`memory_write`'ın ayrı bir sınıf olması AP9 → kural 10'un karşılığıdır:
**belleğe yazmak bir izin işlemidir.** `03-BELLEK.md`'nin kararı gereği
`project`/`global` katmanlarına yazma her zaman `HUMAN_REQUIRED`'dır; şema en
azından böyle bir çağrının `dusuk` şiddetli sayılmasını reddeder.

### 3.3 Uzatma noktaları muaf değil

ADR-005/4: yeni bir ajan, araç veya eklenti eklemek izin kapsamını
genişletmez. Tool Registry'ye bir araç eklemek onu çağrılabilir yapmaz — çağrı
yine kapıdan geçer ve ilgili ajanın sözleşmesinde o araç **kapsamlı olarak**
istenmiş olmalıdır. Matrisin genişletilebilirlik ↔ güvenlik çelişkisi bilinçli
olarak güvenlik tarafına çözüldü: *genişleme ucuzdur, yetki genişlemesi ucuz
değildir.*

---

## 4. İnsan kapısı: hangi işlemler, ve neden geçilemez

### 4.1 Geçilemezliğin mekanizması

İ3'ün ve tüm anti-pattern listesinin en güçlü maddesi AP1 (5 iz, 9 kaynak):
**insan kapısı bir yapılandırma değeri olduğunda tek bayrakla sıfırlanır.**
Aider `--yes-always`, OpenHands `NeverConfirm`, MCP'de yalnızca SHOULD.

Bizde `--yes-always` karşılığı **yoktur** ve bu bir temenni değil, üç ayrı
yerde zorlanan bir kısıttır:

1. `permission.schema.json` `additionalProperties: false` — böyle bir alan
   uydurulamaz; öz-test bunu sınıyor (`izin: "--yes-always" karşılığı bir alan
   yazılamaz`).
2. `hard_limit.hit: true` iken `decision` şema düzeyinde `const: "HUMAN_REQUIRED"` —
   `ALLOW` yazan kayıt reddedilir.
3. Sabit sınırlar listesi **koddadır** ve hiçbir yapılandırma okuyucusu
   tarafından okunmaz (ADR-005/1). Uzatılabilir, daraltılamaz.

Üçüncüsü kritiktir: ilk ikisi sözleşmeyi korur, kapıyı kapatan asıl şey
listenin okunduğu yerdir. Yapılandırmadan okunan bir liste, bir bayrağın uzun
hâlidir.

### 4.2 Sabit sınırlar

`hard_limit.rule` enum'u ADR-005/1'in saydığı listeyle birebir aynıdır:

| Sınır | Kapsam |
|---|---|
| `kimlik-bilgisi-girme` | şifre, kart, kimlik alanı doldurma |
| `kalici-silme` | çöp kutusunu boşaltma, geri dönüşü olmayan silme |
| `para-transferi` | ödeme, satın alma |
| `hesap-acma` | yeni hesap, kayıt |
| `sistem-guvenlik-ayari` | güvenlik duvarı, izin politikası, antivirüs |
| `disari-yayin-gonderim` | e-posta, push, paylaşım linki, yayın |

Şema ayrıca iki `operation` değerini doğrudan bu listeye bağlar: `delete` ve
`publish` çağrıları `HUMAN_REQUIRED` ve `hard_limit.hit: true` olmadan
yazılamaz. Bir üçüncü kural aynı yönde çalışır: `irreversible: true` olan hiçbir
kayıt `ALLOW` olamaz — telafisi olmayan eylem insan kapısına düşer (AP8 →
kural 9; bu mimaride "geri alma" diye bir mekanizma yoktur, **telafi** vardır).

### 4.3 Kapı bir durumdur, kaydı vardır

`HUMAN_REQUIRED` kararı iki alanı zorunlu kılar: `recorded_in`
(`raporlar/ONAY-BEKLEYENLER.md` içindeki satır) ve `gate_ref` (doğan
`approval_request` mesajının kimliği). Kural 2'nin karşılığı: onay bir
durumdur. Görev tarafındaki karşılığı `task.schema.json`'ın `ONAY_BEKLIYOR`
durumu — kesintilidir, **süreç ölebilir** ve akış onay olayıyla canlanır.

Bu, bütçe duvarına karşı tasarımın bir parçasıdır: bir gece koşusu onay
beklerken kesilirse, kayıt dosyada durur ve sabah devam eder.

### 4.4 Onayın kapsamı

A2A `specification.md:1968-1972`'nin uyarısı: **onay sinyali tek başına yetki
değildir.** `grant` alanı bu yüzden var:

- `tek-cagri` — varsayılan. Kayıt tükendi; sonraki çağrı yeni karar ister.
- `oturum` — aynı `run_id` boyunca; `expires_at` ve `max_calls` zorunlu.
- `sureli` — `expires_at`'e kadar; aynı iki alan zorunlu.

**Süresiz mod yoktur** — enum'da tanımlı değildir. Tavansız süreli izin de
yazılamaz (`max_calls` zorunlu). Çapraz kontrol ayrıca geçmişe verilen izni
reddeder.

### 4.5 Onay isteği zincirde yukarı taşınır

Alt ajan doğrudan insana ulaşamaz (ADR-002: ajan-ajan doğrudan mesaj yasağı,
insanla konuşan kapı tek). A2A `specification.md:1945-1947`'nin deseni burada
geçerlidir: üst-ajan kendi görevini de onay bekler duruma geçirir ve isteği
yukarı taşır. Devir tavanı 3'tür (`message.schema.json`), yani bir onay isteği
en fazla üç sıçramada insana ulaşır.

### 4.6 Denetim raporu izni genişletmez

İ3 §7'nin 5. açık sorusu: temiz bir denetim raporu izni genişletebilir mi?
**Hayır.** Rapor, insan kapısındaki kararı *bilgilendirir*; kararın kendisini
vermez ve `HUMAN_REQUIRED`'ı `ALLOW`'a çeviremez. Mekanizması şudur: rapor bir
`checks[]` girdisidir, `decision` alanı değil. Bir denetleyicinin en iyi
sonucu `reliability`'yi `guclu` yapmaktır — `hard_limit.hit`'i `false`
yapamaz.

---

## 5. Ajan kimliği ve sır enjeksiyonu

### 5.1 Sır ajana ulaşmaz

İ3 D4: ajan sırra değil **yeteneğe** sahip olur. microsandbox'ın iddiası
`README.md:38` — "Unexploitable secret keys that never enter the VM" — ve her
sır tek bir hedefe bağlı (`README.md:216-219`). A2A bağımsız olarak aynı yere
varıyor: in-band kimlik bilgisi zincirdeki her ajana açılır, bu yüzden kimlik
bilgisi isteği başlatan ajana bağlanmalı ki yalnızca o kullanabilsin
(`specification.md:1961-1962`).

Sözleşmedeki karşılığı: `secret_injection[]` yalnızca `name` ve `target`
taşır. **Sırrın değeri için bu şemada alan yoktur** ve
`additionalProperties: false` olduğu için eklenemez; öz-test bunu sınıyor
(`izin: sırrın değeri sözleşmeye yazılamaz`). Çapraz kontrol ayrıca hedefin
`scope` içinde yazılı olmasını zorunlu kılar — kapsamsız kimlik bilgisi, D4'ün
önlediği hatanın kendisidir.

Bu, `CLAUDE.md`'nin sabit sınırını bir adım ileri taşır: ajan kimlik bilgisi
*girmez* değil, kimlik bilgisini **görmez**.

### 5.2 Mekanizma: bu makinede ne mümkün

microsandbox modeli hipervizöre yaslanıyor; bu makinede KVM yok ve Windows
(bkz. `donanim`, blueprint §4.4). O yol kapalı. İ3 §7'nin 2. açık sorusu buydu;
karar:

**Proxy süreç.** Araç çağrısı, sırrı bilen ayrı bir süreçten geçer; ajanın
bağlamına yalnızca sonuç döner. Somut hâli: `gh` CLI'ı ajan çağırmaz, kapı
çağırır ve token'ı ortam değişkeni olarak yalnızca o alt sürece verir.

Ayrı kullanıcı hesabı seçeneği **elendi**: Windows'ta ayrı hesap, tek kullanıcılı
bu makinede dosya sistemi izinlerini de ayırır ve gece koşusunun kendi çalışma
alanına erişimini kırar. Bedeli faydasından büyük.

**Bu kararın bilinen zayıflığı:** proxy süreç, sırrı *aynı işletim sistemi
kullanıcısı altında* tutar. Ajanın çalıştırdığı rastgele bir komut, ilkesel
olarak o süreci gözleyebilir. Yani bu mekanizma **kazayı** önler, kararlı bir
saldırganı değil. Sandbox olmadan daha güçlüsü yazılamıyor ve bu §7'de sayılı.

### 5.3 Ajan kimliği

Ajanın kimliği `agent.schema.json`'ın `identity` bloğudur: `id` (kebab-case),
`status` (`draft`/`active`/`deprecated`/`archived`) ve `supersedes`. İzin
kararında `requester.id` bu kimliğe bağlanır.

İ3'ün AP1'i burada da geçerli: A2A'da Agent Card imzalama "**MAY** be digitally
signed" (`specification.md:2014`) ve doğrulama "SHOULD verify at least one
signature" (`:2140`) — yani uyumlu bir istemci imzasız karta güvenerek hiçbir
kuralı çiğnemiyor. **Opsiyonel kimlik doğrulama, pratikte doğrulanmayan
kimliktir.**

Bizde imza yerine ADR-007'nin bağı geçiyor: `binding.digest`. Tek makinede
çalışan bir sistemde kriptografik imza, ajanın kendi sözleşmesinin özetinden
fazlasını sağlamaz — ama özet, sözleşme değiştiğinde izni **düşürür**. İmzasız
ama bağlı bir kimlik, imzalı ama süresiz bir kimlikten güçlüdür.

### 5.4 İzin bileşenin o anki hâline verilir

ADR-007'nin kararı. `ALLOW` `binding` olmadan yazılamaz; zorunlu olan `digest`,
`version` değil; yeniden kullanılabilir izin özetsiz verilemez; ve özet
tutmuyorsa izin düşer, `supersedes` ile yeni kayıt yazılır. Gerekçe ve "özete
ne girer" tablosu ADR-007'dedir.

---

## 6. Sandbox katmanları

Dört katman sıralanabilir; bu makinede **ikisi çalışıyor**:

| Katman | Ne yalıtır | Bu makinede | Kaynak |
|---|---|---|---|
| K1 — İzin kapısı | Çağrının yapılıp yapılmayacağı | ✅ çalışıyor | ADR-005 |
| K2 — Süreç sınırı (proxy + ayrı alt süreç) | Sır ve ortam değişkenleri | ✅ çalışıyor (§5.2) | microsandbox `README.md:38` deseni, hipervizörsüz |
| K3 — microVM / konteyner | Dosya sistemi ve ağın tamamı | ❌ KVM yok, Windows | `microsandbox.md` |
| K4 — Uzak sandbox (E2B) | Aynısı, başka makinede | ❌ kod dışarı çıkar → K4 ve gizlilikle çelişir | `e2b.md` §Kimlik |

**Karar: K3 ve K4 mimariye girmiyor**, blueprint §4.4'ün kararı korunuyor.
K4 ayrıca bir ilke ihlali: İ3 A2'nin gösterdiği gibi bulut tabanlı karar,
kuota dolduğunda güvenlik kapısının çalışmaması demek (Snyk Agent Scan
`verify_api.py:552`) ve analiz edilen içeriğin dışarı çıkması demek.

**Ne olursa girer:** Windows'ta çalışan ve kodu dışarı çıkarmayan bir izolasyon
katmanı çıkarsa K3 yeniden değerlendirilir. Bu, blueprint §4.4'ün "ne olursa
girer" cümlesiyle aynıdır ve burada tekrarlanıyor çünkü tek savunmalı olmak
kalıcı bir durum değil, bugünkü durumdur.

**K3 yokken kabul edilen bedel:** güvenilmeyen içeriğin çalıştırılması
mimaride *önlenmiyor*, yalnızca **izne bağlanıyor**. Prompt enjeksiyonuna karşı
mimari bir savunma yoktur; `execute` izninin kapsamlı ve kapılı olması dışında.

---

## 7. Hata sınırları ve izolasyon

K5 gereği her bileşenin `failure_modes` ve `recovery_strategy`'si vardır.
Permission Manager'ın kendisi için:

| Arıza | Ne olur | Neden güvenli |
|---|---|---|
| Denetleyici çöktü | `checks[].result = "hata"` → `ALLOW` verilemez | D5; çapraz kontrol zorluyor |
| Denetleyici hiç çalışmadı | `reliability = "kontrol-edilmedi"` → `ALLOW` verilemez | D11; şema `if/then` |
| Kapının kendisi çöktü | Çağrı yapılmaz — kayıt yoksa çağrı yoktur (§2.2) | tek geçit; "karar verilemedi" ≠ "izin var" |
| Özet hesaplanamadı | `grant.mode` yalnızca `tek-cagri` olabilir | ADR-007 |
| Onay bekliyorken süreç öldü | `ONAY_BEKLIYOR` kesintili durum, kayıt dosyada | §4.3 |
| Sabit sınır listesi okunamadı | Bu bir arıza değil — liste koddadır, okunmaz | ADR-005/1 |

Son satır, tasarımın en önemli sonucudur: **sabit sınırların bir yükleme yolu
yoktur, dolayısıyla bir yükleme arızası da yoktur.** Yapılandırmadan okunan
her liste, okunamadığında ne yapılacağı sorusunu doğurur ve o sorunun her
cevabı bir kaçış yoludur.

### İzolasyon: bileşenin testi tek başına koşar

Kural 8: bileşenin testi diğer bileşenleri başlatmadan koşar. Permission
Manager için bu bugün **kanıtlı**: `arac/sema-dogrula.js --test` izin
sözleşmesinin 15 kuralını ve 5 çapraz kontrolünü Orchestrator, Memory Manager
ya da bir LLM çağrısı olmadan sınıyor. Kapı, tek başına test edilebilen bir
karar fonksiyonudur; test için ağ, model veya durum gerektirmez.

---

## 8. Kapının kendisi nasıl izlenir

`04-DEGERLENDIRME.md` kapıyı ölçme desenini kurmuştu; burada dört sayaç
tanımlanıyor. İkisi ADR'lerin yeniden açılma koşulunu doğrudan ölçüyor:

| # | Sayaç | Neyi ölçer | Eşik |
|---|---|---|---|
| 1 | Araç çağrısı gecikmesinin izin kararında geçen oranı | ADR-005'in yeniden açılma koşulu ("tek geçit ölçülebilir darboğaz olursa") | %10 üstü → ADR-005 yeniden açılır |
| 2 | `HUMAN_REQUIRED` oranı (gece koşularında) | Otonominin fiili sınırı | ölçülür, eşiği yok — kapıyı gevşetmek için gerekçe olamaz |
| 3 | Özet uyuşmazlığı yüzünden düşen izin sayısı | ADR-007'nin "fazla kapsayan özet" riski | Aynı bileşen için tekrarlıyorsa özet tanımı yanlıştır |
| 4 | Gölge moddaki denetleyicilerin `kaldi` oranı | Bir detektörün gölgeden çıkmaya hazır olup olmadığı | ölçüsü yoksa çıkamaz (§2.6) |

Sayaç 2'nin eşiksiz olması bilinçlidir. "Çok fazla onay isteniyor" bir
performans bulgusudur, bir güvenlik gerekçesi değildir; kapıyı gevşetmek için
kullanılamaz. AP1'in ekosistemdeki dokuz örneği tam olarak bu argümanla
başlamıştı.

---

## 9. Kapanmayan yerler

Bu belge şunları **çözmedi**, yazdı:

1. **Sandbox yok, tek savunma bu kapı.** §6. İzin kararındaki bir hatanın
   ikinci bir ağı yoktur. Blueprint §4.4'ün "bilinçli zayıflık" kaydı
   geçerliliğini koruyor.
2. **Proxy süreç kazayı önler, saldırganı önlemez.** §5.2. Sır aynı işletim
   sistemi kullanıcısı altında yaşıyor.
3. **Prompt enjeksiyonuna mimari savunma yok.** §6. Detektör tarafında iki
   olgun bağımsız kaynak bulunamadı (blueprint §4.4); gelecek detektör gölge
   modda başlar.
4. **`operation` sınıfını kim doldurur, doğrulanmıyor.** §3.2 izin sınıfının
   araç adından türetilmediğini söylüyor ama sınıfı çağıran taraf beyan
   ediyor. Yanlış beyan edilmiş bir `read`, `write` gibi denetlenmez. İ3'ün
   AP2'si (yan etkinin bağlayıcı olmayan "ipucu" olarak modellenmesi — MCP
   `ToolAnnotations`) bizde de tam kapanmadı. Faz 4'te Tool Registry'nin
   arayüzü yazılırken `operation`'ın araç şemasından **türetilmesi** ele
   alınacak; bugün türetilmiyor.
5. **`mcp-vet`'in yanlış pozitif oranı ölçülmedi**, bu yüzden bir denetleyici
   olarak bağlanırsa gölge modda başlar (§2.6). Aynısı, İ3'ün doğrulanmamış
   saydığı microsandbox iddiası için de geçerli — §5.1'de kaynak olarak
   *desen* için anıldı, garanti olarak değil.

---

## 10. Dürüstlük notu

§5.1'in dayandığı microsandbox iddiası ("sırlar VM'e hiç girmez") İ3'te
**yalnızca README'den** okundu ve protokol §1 gereği doğrulanmamış sayıldı
(`OZET.md` §8). Bu belge o iddiayı bir garanti olarak değil, bir **tasarım
deseni** olarak kullanıyor — ve zaten hipervizör yolu kapalı olduğu için
mekanizmayı §5.2'de sıfırdan tanımladı. Aynı şey A2A tarafı için geçerli
değil: `specification.md:1961-1962` birincil kaynaktan okundu.

ADR-007'nin ekosistem kanıtı zayıftır ve bu ADR-007'nin kendi K2 tablosunda
yazılıdır: `02-EN-IYI-FIKIRLER.md` aynı fikri kanıt yetersizliğinden elemişti.
Karar, K2'nin ikinci dalına — kendi yaşadığımız arızalara — dayanıyor.

Bu belgede yeni bir bileşen mimariye girmedi; §6'nın K3/K4 satırları hâlâ
"girmedi" diyor ve blueprint §4.4 değişmedi.
