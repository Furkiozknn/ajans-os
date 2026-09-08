# ADR-004 — Değerlendirme kapısı: Evaluator ve Critic ayrı bileşendir

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ4 (birincil), İ6, İ3
**Yeniden açılma koşulu:** "Değerlendirilmedi" sonucu koşuların büyük
çoğunluğunda çıkarsa (ölçüt: bir turda değerlendirilen çıktıların yarısından
fazlası), kapı gece otonomisini bitiriyor demektir ve üçüncü bir yol aranır.

## Bağlam

D3 (8 proje, 3 iz) yinelenen deseni net: *yargı deterministik kaynaktan gelir;
LLM eleştirir, karar vermez.* AP5 aynı şeyin tersinden kanıtı (3 iz, 6 proje):
sinyal ile karar arasındaki bağ ters kurulduğunda, ölçülmemiş bir detektörün
çıktısı yetki gibi davranıyor.

Ama `docs/02-EN-IYI-FIKIRLER.md` §7 S4 bir boşluk bırakıyor: deterministik
kaynağı **olmayan** çıktı türleri (ör. bir analiz belgesinin kalitesi) nasıl
değerlendirilecek? D11 gereği "değerlendirilmedi" yazmak zorunlu — peki o zaman
kapı ne yapacak?

## Seçenekler

### S1 — Tek bir Evaluator; LLM yargısı da onun girdisi
- Nasıl çalışır: deterministik kontroller ve LLM yargısı aynı bileşende ağırlıklı bir skora indirgenir.
- Görüldüğü yer: DGM `get_full_eval_threshold`, OpenEvolve `_is_better`, GEPA `acceptance.py:49`.
- Artı: tek bileşen, tek eşik, basit.
- Eksi: LLM oyu geçme kararına girer → *sahte yeşil*. Üç kanıtın üçü de pre-1.0 veya donmuş (02 §4/A2), ve İ6 AP2: kapı yalnızca "çalıştı mı / skor arttı mı" ölçüyor, güvenlik veya yan etki denetlemiyor.
- Maliyet: skorun ne anlama geldiği belgelenemez; eşiği kimin belirleyeceği cevapsız.

### S2 — Evaluator (deterministik, karar verir) + Critic (LLM, karar vermez)
- Nasıl çalışır: Evaluator yalnızca deterministik kaynaklardan (çıkış kodu, şema doğrulaması, test, sayısal eşik) beslenir ve geçme kararını tek başına verir. Critic yalnızca başarısızlıkta çağrılır ve "neden başarısız oldu, sonraki denemede ne yapılmalı" yazar; oyu karara girmez.
- Görüldüğü yer: D3'ün 8 projesi; D8'in 4 projesi eleştiriyi bir sonraki çağrının **yapılandırılmış girdi alanı** yapıyor.
- Artı: sahte yeşil yapısal olarak imkânsız; eleştiri kaybolmadan taşınıyor.
- Eksi: deterministik doğrulayıcısı olmayan çıktı türü için Evaluator "değerlendirilmedi" demek zorunda.
- Maliyet: her çıktı türü için doğrulayıcı yazma yükü + başarısızlık başına bir ek LLM çağrısı.

### S3 — S2 + deterministik kaynağı olmayan çıktılarda LLM'e ikincil oy hakkı
- Artı: "değerlendirilmedi" sayısı azalır, otonomi artar.
- Eksi: AP5'in tam kendisi — ölçülmemiş bir sinyale yetki vermek. LlamaFirewall'ın EXPERIMENTAL tarayıcılarının üretim yolunda durması bu hatanın kanıtı.
- Maliyet: hangi çıktı türünde oy hakkı olduğunun listesi; liste zamanla büyür ve kimse geri almaz.

## Karar

**S2.** İki ayrı bileşen: `Evaluator` ve `Critic`. Kapı iki fonksiyondur
(İ6'nın inceltmesi): `gecerli_mi()` — biçim/şema/çalışabilirlik, ve
`esigi_asti_mi()` — kalite eşiği. İkisi ayrı çünkü "bozuk çıktı" ile "çalışan
ama kötü çıktı" farklı kurtarma modları gerektirir (ADR-003'ün `hata_turu`
alanı, D13'ün iki modu).

S1 elendi: kanıtlarının üçü de olgun değil ve LLM oyunu karara sokuyor.
S3 elendi: AP5'in tam tanımı.

**S4'ün cevabı — deterministik kaynağı olmayan çıktı.** Üç kademeli, ve kapı
kapanmıyor:

1. **Her çıktı türü için bir deterministik doğrulayıcı aranır.** Bir analiz
   belgesi için bile bunların çoğu yazılabilir: dosya var mı, başlıklar şablona
   uyuyor mu, iddia edilen `dosya:satır` atıfları gerçekten bulunuyor mu
   (`arac/kanit-dogrula.js` bunu bugün yapıyor), sayılar tabloyla tutuyor mu
   (`arac/matris-uret.js`'in sıfır-uyarı kuralı). Bu makinede yazılmış üç araç,
   "öznel" sanılan çıktıların çoğunun aslında deterministik olarak
   denetlenebildiğinin kanıtıdır.
2. **Kalanı için Evaluator `DEGERLENDIRILMEDI` yazar** — `GECTI` değil,
   `KALDI` da değil. Üçüncü değer zorunludur (D11: "kontrol edilmedi" ≠ "temiz").
3. **`DEGERLENDIRILMEDI` çıktı işi durdurmaz; insan kapısına düşürür.** Adım
   `BITTI` olur ama görev sonucu `ONAY_BEKLIYOR` işaretlenir ve
   `raporlar/ONAY-BEKLEYENLER.md`'ye satır düşer. Gece koşusu devam eder,
   karar sabaha kalır.

**Critic'in sınırları.** Çıktısı serbest metin değil,
`contracts/message.schema.json` içinde tanımlı bir alandır (D8). Üst sınır
sözleşmede zorunludur (Aider'ın `max_reflections`'ı); biriken eleştiri Context
Manager'ın bütçe dağıtımına tabidir. Gerekçe AP11: Reflexion
`self.reflections += [...]` (`agents.py:113`) hiç budamıyor ve maliyet deneme
sayısıyla doğrusal büyüyor — üstelik tam da işlerin kötü gittiği anda.

## Dahil etme ölçütü (ADR-000 K2)

| | |
|---|---|
| Çözdüğü problem | LLM-as-judge tuzağı: modelin kendi çıktısını onaylaması. Somut: gece çalışan bir görev kendini "bitti" işaretler, doğrulama yapılmamıştır. |
| Önlediği hata | *Sahte yeşil* (geçmemiş işin geçmiş sayılması) ve *sessiz izin* (denetlenmemişin temiz sayılması). |
| Eklediği maliyet | Her çıktı türü için doğrulayıcı yazma yükü; başarısızlık başına bir ek LLM çağrısı; üçüncü bir değer (`DEGERLENDIRILMEDI`) her çağıran kodda ele alınmak zorunda; insan kapısına düşen iş artar → gece otonomisi azalır. |
| Kanıt (≥2 olgun proje veya yaşadığımız arıza) | D3: 8 proje, 3 iz. D8: 4 proje, 2 iz. Kendi arızamız: `BILINEN-TUZAKLAR.md` #7 — görev "bitti" işaretini koyup doğrulamayı yapamadan kesildi. |

## Sonuçlar

**Olumlu:** Bir çıktının geçmesi, bir programın "evet" demesine bağlıdır. Kötü
çıktı sessizce geçmez; değerlendirilemeyen çıktı da "iyi" sayılmaz.

**Olumsuz / kabul edilen bedel:** `DEGERLENDIRILMEDI` sonuçları insan kuyruğunu
büyütür. Bu bilinçli: gece koşusu üretmeye devam eder, onay sabaha kalır.
Yeniden açılma koşulu tam olarak bu bedelin ölçüsüdür.

**Etkilenen sözleşmeler:** `contracts/message.schema.json` — Critic çıktı alanı
ve üst sınırı. `contracts/agent.schema.json` — `evaluation_criteria` alanı bu
ADR'nin diliyle doldurulur (hangi deterministik doğrulayıcı, hangi eşik).
`contracts/task.schema.json` — `GECTI` / `KALDI` / `DEGERLENDIRILMEDI`.

**Etkilenen diğer ADR'ler:** ADR-003 (sonuç adım kaydına düşer),
ADR-005 (`DEGERLENDIRILMEDI` insan kapısına düşer).

## Uygulama notu

Faz 5'te `src/evaluator/` ve `src/critic/` **ayrı** modüllerdir; `evaluator`
modülü hiçbir model çağrısı yapmaz — bu, kararın tek satırlık testidir.

Test edilebilir ölçüt: "`src/evaluator/` içinde Model Router'a hiçbir çağrı
yok" ve "doğrulayıcısı olmayan bir çıktı türü verildiğinde sonuç
`DEGERLENDIRILMEDI` ve `ONAY-BEKLEYENLER.md`'ye bir satır düşüyor" testleri
geçiyorsa karar uygulanmıştır.
