# 04 — Değerlendirme mimarisi

**Tarih:** 2026-09-08 · **Faz:** 3 (mimari sentez)
**Girdi:** [00-BLUEPRINT.md](00-BLUEPRINT.md) §2.8/§2.9/§2.10/§5,
[01-AJAN.md](01-AJAN.md) (`evaluation_criteria`),
[02-ORKESTRASYON.md](02-ORKESTRASYON.md) (adım döngüsü),
[03-BELLEK.md](03-BELLEK.md) §7 (bütçe),
[ADR-004](../adr/ADR-004-degerlendirme-kapisi.md) (birincil),
[ADR-003](../adr/ADR-003-ilerleme-kaydi.md), [ADR-005](../adr/ADR-005-izin-siniri.md),
[ADR-006](../adr/ADR-006-ajan-sozlesmesi.md),
`docs/02-EN-IYI-FIKIRLER.md` (D3, D8, D11, D13),
`docs/03-ANTI-PATTERNLER.md` (AP2, AP5, AP11, kural 4/6/12).

Bu belge tek soruya cevap verir: **bir çıktının "geçti" sayılması için ne
olması gerekir, o kararı ne verir ve veremediğinde ne olur?** Kararın kendisi
ADR-004'te alındı (Evaluator ve Critic ayrı bileşendir). Burada o kararın
**işleyen hâli** yazılıyor: ölçüt türleri, çıktı türü → yol eşlemesi, eşik
kuralları, doğrulayıcı sözleşmesi ve kapının kendisini sınayan benchmark seti.
Yeni bir bileşen tanıtılmıyor.

> Bu belgenin ilkesi ADR-004'ün tek cümlesidir: **yargı deterministik
> kaynaktan gelir; LLM eleştirir, karar vermez.** Belgenin geri kalanı bu
> cümlenin uygulanabilir olup olmadığının sınanmasıdır — ve bir yerde
> uygulanamıyorsa (§4, satır 8) bunu gizlemek yerine yazmasıdır.

---

## 1. Tek cümlelik akış

> Her çıktı **iki fonksiyondan** geçer — önce `gecerli_mi()`, geçerse
> `esigi_asti_mi()`; ikisini de **program** cevaplar, model değil; program
> yoksa sonuç `GECTI` değil `DEGERLENDIRILMEDI`'dir ve iş durmaz, **insan
> kapısına** düşer; yalnızca `KALDI` durumunda Critic çağrılır ve yazdığı
> şey bir oy değil, bir sonraki denemenin **yapılandırılmış girdi alanıdır**.

---

## 2. İki bileşen, iki fonksiyon

| | **Evaluator** | **Critic** |
|---|---|---|
| Ne yapar | Geçme kararını verir | Başarısızlığın nedenini ve düzeltme ipucunu yazar |
| Neyle beslenir | Yalnızca deterministik kaynak: çıkış kodu, şema doğrulaması, test sonucu, sayı | Evaluator'ın başarısızlık kaydı + çıktının kendisi |
| Model çağırır mı | **Hayır** | Evet |
| Kararı bağlar mı | Evet, tek başına | **Hayır** — oyu karara girmez |
| Ne zaman çalışır | Her adım sonunda | Yalnızca `KALDI` sonrasında |
| Çıktısı | `GECTI` / `KALDI` / `DEGERLENDIRILMEDI` | `message.schema.json` `kind: "critique"` → `payload.items[]` |
| Üst sınırı | Yok (deterministik, ucuz) | `retry.max_critique_items` (≤ 20, şemada sabit) |

**Kararın tek satırlık testi (ADR-004 uygulama notu):** `src/evaluator/`
içinden Model Router'a çağrı çıkmaz. Bu, gözle değil `grep` ile denetlenir ve
Faz 5'te bir teste bağlanır.

**Critic üç durumda çağrılmaz:**

1. `GECTI` — açıklanacak bir başarısızlık yok; çağırmak saf maliyettir.
2. `DEGERLENDIRILMEDI` — ortada mekanik bir başarısızlık kaydı yoktur.
   Critic'e "bu çıktı iyi mi" diye sormak, kapıya arka kapıdan LLM yargısı
   sokmaktır; ADR-004'te S3 tam olarak bu gerekçeyle elendi (AP5).
3. Deneme hakkı bittiğinde (`attempt == max_attempts`) — eleştirinin
   taşınacağı bir sonraki deneme yoktur.

**Critic'in girdisi zorunlu olarak mekaniktir.** Eleştiri istemi, hangi
doğrulayıcının hangi çıktıyla düştüğünü içerir. İçermezse Critic tahmin
yürütür ve retry kör retry'a döner (D8'in önlediği hatanın ta kendisi).

---

## 3. Dört ölçüt yolu

`contracts/agent.schema.json` içinde `evaluation_criteria[].how` alanı dört
değer alıyor: `rubric`, `test`, `metric`, `human`. Bu dördü **ayrı ölçüt
türleri değil, aynı deterministik kapıya giden dört yoldur.** Anlamları:

| `how` | Ne demek | Kim cevaplar | Hangi fonksiyonu besler | `task.schema.json` `evaluation.method` |
|---|---|---|---|---|
| `test` | Bir komut çalışır, çıkış kodu bakılır | Program | `gecerli_mi()` | `deterministic` |
| `metric` | Bir sayı üretilir, eşikle karşılaştırılır | Program | `esigi_asti_mi()` | `deterministic` |
| `rubric` | **Mekanik kontrol listesi**: her maddesi evet/hayır olarak *programla* cevaplanabilen sorular; skor = geçen madde / toplam madde | Program | ikisi de (§5.3) | `deterministic` |
| `human` | Deterministik karşılığı bulunamamış ölçüt | İnsan | Hiçbiri — sonuç `DEGERLENDIRILMEDI` | `human-gate` |

**`rubric` bu mimaride LLM puanlaması değildir.** Şemadaki örnek eşik
(`"rubric >= 4/5"`) bir modelin beş üzerinden puan vermesi gibi okunabilir;
okunmaz. Rubrik burada, her maddesi bir `grep`, bir dosya varlığı kontrolü,
bir başlık eşlemesi veya bir şema doğrulaması olan kontrol listesidir. Beş
maddelik bir rubrikte "4/5" demek, **dört mekanik kontrolün geçmesi** demektir.

Bu ayrım keyfî değil: `rubric`'i LLM puanı olarak okumak, ADR-004'te elenen
S1'i (ağırlıklı skorda LLM oyu) arka kapıdan geri getirir.

**`human` bir değerlendirme yolu değil, değerlendirmenin yokluğudur.** Ölçüt
`human` işaretlenmişse Evaluator o çıktı için karar üretmez; `DEGERLENDIRILMEDI`
yazar ve `approval_ref` doldurur. `task.schema.json`, `evaluation_result`
`DEGERLENDIRILMEDI` olduğunda `approval_ref` alanını zaten zorunlu tutuyor —
kural şemada karşılanmış durumda, koda güvenilmiyor.

---

## 4. Hangi çıktı hangi yolla değerlendirilir

Kapıdan bugün geçmesi beklenen çıktı türleri ve her biri için iki fonksiyonun
karşılığı. "Bugün var mı" sütunu bu depoda **çalışan** bir doğrulayıcı olup
olmadığını söyler — niyeti değil.

| # | Çıktı türü | `gecerli_mi()` | `esigi_asti_mi()` | `how` | Bugün var mı |
|---|---|---|---|---|---|
| 1 | Kod değişikliği | Dilin parse/derleme adımı çalışır | Test paketi çıkış kodu 0; kapsam eşiği verilmişse oran | `test` | Dil araçları (depo dışı) |
| 2 | Sözleşme örneği (JSON) | `node arac/sema-dogrula.js` | Eşik yok — geçerli ya da değil | `test` | **Var** |
| 3 | Görev grafı (`task.json`) | Şema + `writes` çakışma kontrolü (aynı alana iki adım yazamaz) | Eşik yok | `test` | **Var** (`sema-dogrula.js`) |
| 4 | Araştırma izi özeti | `node arac/kanit-dogrula.js <iz>` — YOK sınıfı sıfır | Matris üretimi **sıfır uyarı** ile dönüyor (`matris-uret.js`) | `rubric` | **Var** |
| 5 | Faz 2/3 belgesi (sentez) | Şablon başlıkları yerinde + `node arac/iz-izle.js <belge>` YOK sınıfı sıfır | Rubrik: kanıt sütunu doldurulmuş iddia oranı | `rubric` | **Kısmen** (`iz-izle.js` var, şablon kontrolü yok) |
| 6 | ADR | `docs/adr/SABLON.md` başlıklarının tamamı mevcut; "Dahil etme ölçütü" tablosunun dört satırı dolu | Eşik yok — zorunlu maddeler ya tamdır ya değil | `rubric` | **Yok** (yazılabilir, §10) |
| 7 | Araç/komut çağrısı çıktısı | Çıkış kodu 0 | Süre veya maliyet tavanı (`metric`) | `metric` | Çalışma zamanı |
| 8 | Serbest düzyazı (özet, taslak, yorum) | **Yok** | **Yok** | `human` | — → `DEGERLENDIRILMEDI` |

**Satır 8 bu mimarinin kapanmayan yeridir ve kapatılmış gibi gösterilmiyor.**
ADR-004 §S4'ün üç kademesi burada uygulanıyor: önce deterministik doğrulayıcı
aranır (satır 2–6, "öznel" sanılan çıktıların çoğu aslında denetlenebilir
çıktı), kalanı `DEGERLENDIRILMEDI` olur, ve bu sonuç işi durdurmaz —
`ONAY-BEKLEYENLER.md`'ye bir satır düşer, koşu devam eder.

**Yeni bir çıktı türü kapıya, doğrulayıcısıyla birlikte girer.** Doğrulayıcısı
olmayan tür `human` işaretlenir; sessizce `GECTI` üreten bir yol açılmaz.

---

## 5. Eşikler

### 5.1 İki fonksiyon sıralıdır

`gecerli_mi()` düştüyse `esigi_asti_mi()` **sorulmaz.** Bozuk çıktının kalite
puanı hesaplanmaz; hesaplanırsa "biçimi bozuk ama puanı yüksek" gibi anlamsız
bir sonuç doğar. İkisinin ayrı olmasının sebebi kurtarma modunun farklı
olmasıdır (D13, `retry.mode`):

| Düşen fonksiyon | `hata_turu` | Önerilen `retry.mode` |
|---|---|---|
| `gecerli_mi()` | `SEMA_IHLALI` | `duzelt` — biçim hatası dar bir düzeltmedir, bağlam korunur |
| `esigi_asti_mi()` | `DOGRULAMA_KALDI` | `temiz-sayfa` — çıktı çalışıyor ama yaklaşım yetersiz; birikmiş bağlam aynı yaklaşımı tekrarlatır |

Bu bir öneridir, dayatma değil: mod adım sözleşmesinde yazılıdır, Recovery
Manager onu okur.

### 5.2 Eşiğin kendisi bir sözleşme alanıdır

Eşik iki yerde yaşar ve ikisi de veridir, koda gömülmez:

- `agent.schema.json` → `evaluation_criteria[].threshold` — insan okur biçim
  (`"tests pass"`, `"p95 < 30s"`, `"rubric >= 4/5"`).
- `task.schema.json` → `evaluation.threshold` (sayı) — makinenin karşılaştırdığı.

**Eşik koşu sırasında değişmez.** Çıktı görüldükten sonra eşiği aşağı çekmek,
kapıyı kapatmakla aynı şeydir ve iz kaydında görünmez. Eşik değişikliği bir
sözleşme değişikliğidir: ayrı bir commit, ayrı bir gerekçe.

### 5.3 Rubrik skoru ve ağırlıklar

Rubrik maddeleri iki sınıftır ve sınıf, mevcut `weight` alanıyla ifade edilir —
şemaya yeni alan eklenmiyor:

- **Zorunlu madde** = `weight` verilmemiş madde. Biri düşerse sonuç `KALDI`;
  başka maddelerin geçmesi bunu telafi **etmez**.
- **Puanlı madde** = `weight` verilmiş madde. Skor bu maddelerin ağırlıklı
  oranıdır ve `threshold` ile karşılaştırılır.

**Varsayılan eşik: puanlı maddelerin ağırlıklı oranı ≥ 0,8.** Bu sayının
dışarıdan bir kanıtı yok; ölçülene kadar bir başlangıç değeridir ve §8'in
sayaçları ilk düzeltme fırsatıdır.

**Ağırlık bir ölçütü diğerine satamaz.** Ağırlıklandırma yalnızca *tek bir
rubriğin içinde* geçerlidir. `evaluation_criteria` içindeki ayrı ölçütlerin
tek bir ağırlıklı ortalamaya indirgenmesi yasaktır — bu, ADR-004'te elenen
S1'in mekanizmasıdır ve bir ölçütün çökmesini başka bir ölçütün yüksek
puanıyla gizler.

### 5.4 Doğrulayıcı sözleşmesi

`evaluation.checker` tek bir çalıştırılabilir komuttur. Kapıya bağlanan her
doğrulayıcı şu üç kuralı sağlar:

| Çıkış kodu | Anlamı | Kapının sonucu |
|---|---|---|
| `0` | Geçerli | `gecerli_mi()` = evet |
| `1` | Geçersiz — bulgu var | `KALDI` |
| `≥ 2` | **Doğrulayıcının kendisi bozuk** | `DEGERLENDIRILMEDI` — `KALDI` değil |

Üçüncü satır D11'in doğrudan uygulanmasıdır: çalışmayan bir denetleyicinin
sessizliği "temiz" anlamına gelmez; ama "kaldı" da anlamına gelmez, çünkü
çıktı hakkında hiçbir şey öğrenilmemiştir. Güvenli taraf üçüncü değerdir.

`esigi_asti_mi()` için doğrulayıcı, standart çıktısının **son satırında**
`SKOR=<0..1>` yazar. Yazmıyorsa yalnızca `gecerli_mi()` uygulanır — bu,
`task.schema.json`'ın "threshold yoksa yalnızca `gecerli_mi()` uygulanır"
kuralının çalıştırılabilir karşılığıdır.

Depodaki dört araç bu sözleşmenin **çıkış kodu yarısını** bugün karşılıyor
(`iz-izle.js` YOK bulursa 1 döndürüyor). `SKOR=` satırı henüz hiçbirinde yok;
Faz 5'te eklenir ve eklenmeden 4. ve 5. satırların `esigi_asti_mi()` sütunu
kâğıt üzerindedir.

---

## 6. Kapı akışı

```
adım çıktısı
     │
     ▼
 gecerli_mi()  ──hayır──►  KALDI (SEMA_IHLALI)
     │ evet                      │
     ▼                           │
 eşik var mı? ──hayır──► GECTI   │
     │ evet                      │
     ▼                           │
 esigi_asti_mi() ──hayır──► KALDI (DOGRULAMA_KALDI)
     │ evet                      │
     ▼                           ▼
   GECTI                    ┌──────────┐
                            │  Critic  │  ← yalnızca burada
                            └────┬─────┘
                                 │ items[] (≤ max_critique_items)
                                 ▼
                          Recovery Manager
                        duzelt / temiz-sayfa (D13)
                                 │
                        attempt < max_attempts ?
                          evet → yeniden dene
                          hayır → on_failure

 doğrulayıcı yok  ──►  DEGERLENDIRILMEDI ──► status: ONAY_BEKLIYOR
                                              approval_ref zorunlu
                                              ONAY-BEKLEYENLER.md
```

**Eleştiri birikimi sınırlıdır (kural 12, AP11).** `retry.mode: "duzelt"`
seçildiğinde `max_critique_items` zorunludur; sınır aşılırsa `truncated: true`
işaretlenir ve kesilen içerik `raw_ref` ile Observability izinde durur,
mesajın içinde değil. Ham kayıt korunur, taşınan kayıt budanır.

**Kapının maliyeti bütçeye tabidir.** Critic çağrıları Cost Manager'ın
adım bütçesinden düşer; bütçe duvarına Critic yüzünden çarpmak, tam da işler
kötü giderken maliyeti büyütmektir (AP11). Bütçe kalmadıysa Critic çağrılmaz
ve adım `BASARISIZ` olur — eleştirisiz ama dürüst.

---

## 7. Benchmark seti — kapıyı kim denetler?

Kapı bir programdır ve programlar bozulur. `sema-dogrula.js`'in başlığındaki
cümle bu belgenin de kuralı: *"sessizce geçen doğrulayıcı doğrulamıyor
demektir."* Benchmark seti, **ajanları değil kapının kendisini** ölçen sabit
bir örnek kümesidir.

### 7.1 Üç sınıf örnek

Her çıktı türü için en az bir **üçlü**:

| Sınıf | Örnek nedir | Kapı ne demeli |
|---|---|---|
| **Altın** | Bilinerek doğru, kabul edilmiş bir çıktı | `GECTI` |
| **Mutant** | Altın örneğin bilerek bozulmuş hâli (tek bir alan, tek bir satır) | `KALDI` |
| **Ölçülemez** | Doğrulayıcısı olmayan türden bir çıktı | `DEGERLENDIRILMEDI` + `approval_ref` |

Mutant sınıfı setin asıl varlık sebebidir: *sahte yeşili* yakalayan tek
testtir. Altın örnekleri geçiren ama mutantı da geçiren bir kapı, hiç kapı
olmamasından daha kötüdür — çünkü güven üretir.

### 7.2 Bugün elde olan tohum

Bu desen depoda zaten var, genelleştirilmesi gerekiyor:

- `arac/sema-dogrula.js --test` — doğrulayıcının öz-testi; başlığında yazdığı
  gibi **bozuk sözleşmeler reddedilmeli**. Bu, mutant sınıfının çalışan bir
  örneğidir.
- `arac/kanit-dogrula-test.js` — kanıt doğrulayıcısının kendi testi.
- `contracts/ornek/` — altın örnek kümesi (`sema-dogrula.js`'in varsayılan
  girdisi).

Eksik olan üçüncü sınıf: bugün hiçbir örnek `DEGERLENDIRILMEDI` beklentisiyle
işaretlenmiş değil, çünkü kapı henüz kod olarak yok.

### 7.3 Kural

**Bir doğrulayıcı, üçlüsü yazılmadan kapıya bağlanmaz.** Ölçülmemiş bir
detektörün çıktısına yetki vermek AP5'in tam tanımıdır; bu kural o yolu kapatır.

**Benchmark ne zaman koşar:** doğrulayıcı değiştiğinde, eşik değiştiğinde,
şema değiştiğinde ve sürüm yükseltmesinde. Her görev koşusunda **koşmaz** —
kapının maliyeti görev başına sabit kalmalıdır.

**Set büyür, küçülmez.** Üretimde yaşanmış her sahte yeşil, sete bir mutant
olarak girer. `BILINEN-TUZAKLAR.md` bu kümenin elle tutulan hâlidir; #7 (görev
"bitti" işaretini koyup doğrulamayı yapamadan kesildi) ilk mutant adayıdır.

---

## 8. Kapının kendisi hangi sayılarla izlenir

Bu dört sayaç Observability'nin taşıması gereken **veri sözleşmesidir**; iz
formatı Faz 3'ün "Observability Architecture" maddesinde tasarlanır, burada
yalnızca ne sayılacağı yazılıyor (kural 6: her sinyalin bir tüketicisi var —
bu dördünün tüketicisi aşağıda adlandırılmıştır).

| Sayaç | Ne söyler | Tüketicisi |
|---|---|---|
| `degerlendirilmedi_orani` (koşu başına) | Kapı gece otonomisini bitiriyor mu | **ADR-004'ün yeniden açılma koşulu**: bir turda değerlendirilen çıktıların yarısından fazlası ise ADR yeniden açılır |
| `mutant_yakalama_orani` (benchmark) | Kapı sahte yeşile ne kadar dayanıklı | Doğrulayıcı bakımı; 1,0'ın altı bir arızadır |
| `retry_sonrasi_gecti_orani` | Critic'in eleştirisi işe yarıyor mu | Critic istemi ve `max_critique_items` ayarı |
| `kapi_maliyeti` (doğrulayıcı süresi + Critic çağrı maliyeti) | Kapı bütçenin ne kadarını yiyor | Cost Manager |

İkinci ve dördüncü sayaç olmadan §5.3'ün 0,8 eşiği ve §6'nın Critic
sınırları ayarlanamaz; bu yüzden ikisi de "sonra bakarız" listesinde değil,
sözleşmenin parçası.

---

## 9. Sözleşmelerle bağ

Bu belge **yeni şema alanı istemiyor**; var olan alanlara anlam veriyor.

| Sözleşme | Alan | Bu belgedeki karşılığı |
|---|---|---|
| `agent.schema.json` | `evaluation_criteria[].how` | §3 — dört yolun tanımı |
| `agent.schema.json` | `evaluation_criteria[].threshold` | §5.2 — insan okur eşik |
| `agent.schema.json` | `evaluation_criteria[].weight` | §5.3 — verilmemişse zorunlu, verilmişse puanlı madde |
| `task.schema.json` | `evaluation.method` | §3 — `rubric`/`test`/`metric` → `deterministic`, `human` → `human-gate` |
| `task.schema.json` | `evaluation.checker` | §5.4 — çıkış kodu ve `SKOR=` sözleşmesi |
| `task.schema.json` | `evaluation.threshold` | §5.2 — makinenin karşılaştırdığı sayı |
| `task.schema.json` | `step_record.evaluation_result` | §1 — üç değer |
| `task.schema.json` | `step_record.approval_ref` | §3, §7.1 — `DEGERLENDIRILMEDI` ile birlikte zorunlu (şema bunu hâlihazırda dayatıyor) |
| `task.schema.json` | `retry.mode`, `retry.max_critique_items` | §5.1, §6 |
| `message.schema.json` | `kind: "critique"` → `payload.items[]`, `truncated`, `raw_ref` | §2, §6 |
| `message.schema.json` | `error_type` (`SEMA_IHLALI`, `DOGRULAMA_KALDI`) | §5.1 tablosu |

---

## 10. Açık kalanlar

Bu maddelerin hiçbiri bu turda yapılmadı; yapılmış gibi de yazılmadı.

1. **`SKOR=` satırı** — mevcut dört araç çıkış kodunu döndürüyor, skor
   döndürmüyor. §4'ün 4. ve 5. satırlarında `esigi_asti_mi()` sütunu, bu
   eklenene kadar tasarımdır.
2. **ADR şablon doğrulayıcısı** (§4 satır 6) — yazılabilir ve küçüktür;
   Faz 5'e madde olarak düşer.
3. **Belgenin kendi metni hakkındaki iddiaların denetimi** —
   `BILINEN-TUZAKLAR.md` #22'nin konusu. `kanit-dogrula.js` dışarıyı,
   `iz-izle.js` bir halka yukarısını denetliyor; "bu belgede X yoktur"
   biçimindeki cümleleri denetleyen bir araç yok. Bir çıktı türü olarak §4'e
   girmeye aday.
4. **Zorunlu/puanlı ayrımının açık alanı** — §5.3 bunu `weight`'in varlığıyla
   ifade ediyor. Açık bir bayrak daha okunur olurdu; şema değişikliği demek,
   bu turda açılmadı.
5. **Eşik 0,8** — dışarıdan kanıtı olmayan bir başlangıç değeri (§11).

---

## 11. Dürüstlük

Kanıta dayanan ve karara dayanan kısımlar ayrı:

**Kanıtı olan.** Evaluator/Critic ayrımı (D3: 8 proje, 3 iz), eleştirinin
yapılandırılmış girdi alanı olması (D8: 4 proje, 2 iz), üçüncü değerin
zorunluluğu (D11: 4 proje, 2 iz), retry'ın iki modu (D13: 3 proje, 2 iz),
eleştiri birikiminin sınırlanması (AP11 + kendi arızamız).

**Kanıtı olmayan, karar olan.** `rubric`'in mekanik kontrol listesi olarak
tanımlanması (§3) — incelenen projelerde bu biçimde uygulayan bir örnek
görülmedi; gerekçe kanıt değil, ADR-004'ün S1/S3 elemesinin mantıksal
sonucudur. Doğrulayıcı çıkış kodu sözleşmesi ve `SKOR=` biçimi (§5.4) — bu
depodaki dört aracın alışkanlığından türetildi, dışarıdan alınmadı. Varsayılan
0,8 eşiği (§5.3) — ölçülene kadar keyfîdir ve §8'in sayaçları onu düzeltmek
için var. Benchmark setinin üç sınıfı (§7.1) — `sema-dogrula.js --test`
desenin depodaki tek örneğidir; tek örnek, ADR-000 K2'nin "≥2 olgun proje"
ölçütünü sağlamaz ve bu yüzden ADR'ye değil bu belgeye yazıldı.

**Kapanmayan.** §4 satır 8: serbest düzyazının deterministik doğrulayıcısı
yok ve bu belge bir tane icat etmedi. O çıktılar `DEGERLENDIRILMEDI` alır,
insan kuyruğu büyür. ADR-004'ün yeniden açılma koşulu tam olarak bu bedelin
ölçüsüdür ve §8'in ilk sayacı onu ölçer.
