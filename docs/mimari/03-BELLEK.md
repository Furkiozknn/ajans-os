# 03 — Bellek mimarisi

**Tarih:** 2026-09-08 · **Faz:** 3 (mimari sentez)
**Girdi:** [00-BLUEPRINT.md](00-BLUEPRINT.md) §2.6/§2.7/§4.3/§5,
[01-AJAN.md](01-AJAN.md) (`memory_scope`), [02-ORKESTRASYON.md](02-ORKESTRASYON.md) §4.2,
[ADR-003](../adr/ADR-003-ilerleme-kaydi.md), [ADR-005](../adr/ADR-005-izin-siniri.md),
[ADR-006](../adr/ADR-006-ajan-sozlesmesi.md), İ2 özeti
([`docs/arastirma/i2-bellek/OZET.md`](../arastirma/i2-bellek/OZET.md)),
`docs/02-EN-IYI-FIKIRLER.md` (D5, D9, D10), `docs/03-ANTI-PATTERNLER.md` (AP9, AP11, kural 10/12).

Bu belge tek soruya cevap verir: **bir bilgi ajans-os'ta nereye, kimin
yetkisiyle, ne kadar süre yazılır ve okunurken hangi hâli döner?** Bileşen
kümesi ADR-001'de karara bağlandı; Memory Manager ve Context Manager oraya
girdi. Burada o iki bileşenin **veri ve yetki düzeyindeki karşılığı** yazılır.
Yeni bir bileşen tanıtılmaz.

> Bu belgenin ilkesi İ2'nin en sert bulgusundan gelir: incelenen yedi projenin
> yedisinde de belleğe yazma kararını LLM verir ve **yazma öncesi bir kapı
> yoktur** (İ2 §2/D2, §4/AP9). Kopyalanacak örnek olmadığı için bu bölümün
> gerekçesi kanıt değil **karardır**; nerede kanıt yok, orada açıkça yazıldı.

---

## 1. Tek cümlelik akış

> Her kayıt **bir katmana** yazılır; yazma **üç sınıftan** birine düşer ve
> sınıfı yazanın kimliği değil **hedef katman** belirler; hiçbir kayıt üzerine
> yazılmaz — yeni kayıt eskisini geçersiz kılar; okuma **varsayılan olarak
> yalnızca geçerli** kaydı döndürür; okunan, Context Manager'ın **önceden
> yazılmış kısılma sırasına** göre bütçelenir ve taşma bir hata değil
> planlanmış bir faz geçişidir.

---

## 2. Katmanlar

Beş katman. Enum `contracts/agent.schema.json` `$defs.memory_layer` içinde
zaten sabit: `task`, `session`, `project`, `global`, `knowledge`. Bu belge o
enum'a anlam, sınır ve süre veriyor.

| Katman | Ne tutar | Kim yazar | Kim okur | Saklama | PII | Çelişki çözümü |
|---|---|---|---|---|---|---|
| `task` | Adım çıktıları, ara sonuçlar, o görevin kendi notları | Yürütülen ajan (deterministik sınıf) | Yalnızca aynı `run_id`'nin adımları | `task` — görev bitince düşer | İzinli (girdide ne varsa) | Yok; son yazan geçerlidir |
| `session` | Bir koşunun görevler arası özeti, tahliye edilmiş bağlam özetleri | Orchestrator (deterministik) + ajan (çıkarımsal) | Aynı oturumun görevleri | `session` | İzinli, ama oturum sonunda düşer | Geçersiz kılma zorunlu |
| `project` | Bir depo/proje hakkında kalıcı olgu: mimari kararlar, yaşanmış tuzaklar, dosya haritası | Yalnızca insan onaylı yazma (kalıcı sınıf) | Bütün ajanlar | `permanent` | **Yasak** | Geçersiz kılma zorunlu |
| `global` | Makine ve kullanıcı düzeyinde tercih ve sabit kural | Yalnızca insan onaylı yazma | Bütün ajanlar | `permanent` | Gerekçeli izin (`pii_basis`) | Geçersiz kılma zorunlu |
| `knowledge` | Dışarıdan alınmış referans: spec, belge, iz özeti — **kopya**, kaynağı dışarıda | Yalnızca alım (ingest) işi, deterministik | Bütün ajanlar | `days-30` (yenilenmezse düşer) | **Yasak** | Kaynak yenilenir; kayıt tartışılmaz |

Saklama değerleri `agent.schema.json`'daki `retention` enum'una birebir oturur
(`task` / `session` / `days-7` / `days-30` / `permanent`); `days-7` bu belgede
bir katmana atanmadı, ajan sözleşmesinde daha dar bir süre istenirse
kullanılabilir — katmanın süresi tavan, sözleşmedeki süre onu kısaltabilir,
uzatamaz.

**İki kural katman sınırını taşır:**

1. **Terfi otomatik değildir.** `task` → `session` → `project` yükselmesi ancak
   açık bir yazma işlemiyle olur; "sık tekrar eden bilgi kendiliğinden kalıcı
   olur" gibi bir mekanizma yoktur. Gerekçe kural 7'dir: kapsam belirtilmemişse
   sonuç boş kümedir, "hepsi" değil.
2. **Kaynak referansı zorunludur.** Türetilmiş her kayıt hangi ham veriden
   çıktığını taşır. İ2'nin en güçlü sinyali buydu: yedi projenin yedisi de ham
   konuşma ile türetilmiş belleği ayırıyor ve aralarındaki köprü her yerde bir
   kaynak referansı (İ2 §2/D1). Kaynağı olmayan kayıt yazılamaz.

**`knowledge` bir bilgi grafı değildir.** Blueprint §4.3 grafı mimariden
çıkardı ("grafsız çözülemeyen somut bir senaryo" yazılamadığı için). Bu belge o
kararı yeniden açmıyor: `knowledge` kaynaklı belge parçalarından oluşan düz bir
koleksiyondur, ilişki çıkarımı yapılmaz. Girme koşulu blueprint §4.3'te
yazıldığı gibi durur.

---

## 3. Yazma yolu — üç sınıf, tek kapı

İ2 Ö3'ün önerisi alındı ve bir yerde sıkılaştırıldı: sınıf, **yazanın
kimliğinden değil hedef katmandan** türer.

| Sınıf | Ne tetikler | Kod tarafındaki doğrulama | Kapı | Hedef katman |
|---|---|---|---|---|
| **Deterministik** | Bir olay: adım bitti, onay verildi, dosya yazıldı. LLM sorulmaz. | Şema doğrulaması + `icerik_hash` ile idempotency | Yok — izin görev sözleşmesinde zaten verilmiş | `task`, `session`, `knowledge` (alım) |
| **Çıkarımsal** | LLM "bunu hatırla" der | Şema + idempotency + kaynak referansı zorunlu + güven ağırlığı | Permission Manager: `ALLOW` \| `BLOCK` (katman politikası) | `session` |
| **Kalıcı/paylaşılan** | `project` veya `global` katmanına yazma isteği | Yukarıdakilerin hepsi | Permission Manager: **her zaman `HUMAN_REQUIRED`** | `project`, `global` |

Sınıfın hedef katmandan türemesinin gerekçesi kural 3'tür: karar algoritması
tek yerde durur. Kimlikten türeseydi her ajan tipi için ikinci bir uygulama
gerekirdi ve AP2 (aynı kararın ikinci uygulaması, sonuç hangi yoldan geçtiğine
bağlı) doğrudan tekrarlanırdı.

**Kalıcı yazma insan kapısına düşer** — bu blueprint §5'in 10. kuralının
(*belleğe yazmak bir izin işlemidir*) buradaki karşılığıdır. Kapının mekaniği
ADR-005 ve ADR-003'te tanımlı: `HUMAN_REQUIRED` → görev durumu
`ONAY_BEKLIYOR`, `raporlar/ONAY-BEKLEYENLER.md`'ye satır, süreç ölebilir.
Yani gece koşusunda hiçbir ajan `project` veya `global` belleğe yazamaz;
önerisi sabaha kalır. Bu bilinçli bir yavaşlatmadır.

**Yazma senkrondur (İ2 S5 kararı).** mem0 yazmayı arka plana atıyor
(`_async_add_to_memory`), bu gecikmeyi düşürür ama "az önce söylediğimi
hatırlamıyor" tutarsızlığını üretir. ADR-002'nin tek yürütme döngüsü zaten adım
sınırında duruyor (ADR-003); yazma o sınırda, adım kaydıyla aynı anda yapılır.
Maliyeti adım başına gecikmedir ve kabul edildi.

### 3.1 Kayıt alanları

Bir bellek kaydının taşıması gerekenler. Bunların JSON şeması
(`contracts/memory.schema.json`) bu maddenin çıktısı değil — Faz 4'ün
"Repository / folder structure ve core interfaces" maddesine ait; bu tablo o
şemanın girdisidir.

| Alan | Neden zorunlu |
|---|---|
| `layer` | Sınıfı ve saklamayı belirleyen tek alan (§3) |
| `content` | Kaydın kendisi |
| `source` | Türetilmiş kayıt hangi ham veriden çıktı (§2, kural 2) |
| `author` | Hangi ajan/işlem yazdı |
| `write_class` | `deterministic` \| `inferred` \| `human-approved` |
| `content_hash` | Idempotency; ayrıca silme sonrası geriye kalan tek iz (§5) |
| `valid_from` / `valid_to` | Olay zamanı — bilginin dünyada geçerli olduğu aralık |
| `recorded_at` / `superseded_at` | Sistem zamanı — kaydın bizde durduğu aralık |
| `supersedes` | Hangi kaydı geçersiz kılıyor (§4) |
| `confidence` | Güven ağırlığı; elle girilen kayıt kanıt sayılmaz (§4) |
| `retention` | Katman tavanını aşamaz (§2) |
| `pii` | Katman politikasıyla çapraz kontrol edilir (§5) |

İki zaman ekseninin ayrı tutulması graphiti'nin bi-temporal modelinden alındı
(`edges.py:271-282`): "bilgi ne zaman doğruydu" ile "biz ne zaman öğrendik"
farklı sorulardır ve tek alanla ikisi birden cevaplanamaz.

---

## 4. Okuma yolu

**Varsayılan yalnızca geçerli kayıttır.** `superseded_at` dolu olan kayıt
varsayılan sorguya girmez; geçmiş açıkça istenir. Gerekçe İ2 Ö4'ün uyarısıdır:
graphiti'de bile varsayılan arama geçersiz kılınmış fact'leri döndürüyor —
güvenli taraf varsayılan olmalı, geniş sorgu istisna.

**Çelişki üzerine yazmayla değil geçersiz kılmayla çözülür.** Yeni kayıt
`supersedes` alanıyla eskisini işaretler, eski kayıt yerinde kalır. Append-only
(mem0 v2'nin "Ali vegan" ve "Ali et yiyor" kayıtlarını yan yana yaşatması,
`prompts.py:472`) **yasaktır**: otonom karar veren bir sistemde okuma anında
çözülmeyen çelişki, kararın kendisini çözümsüz yapar.

**Katman çakışmasında dar olan kazanır.** Okuma sırası
`task` > `session` > `project` > `global` > `knowledge`. Aynı konuda iki
katmanda çelişen kayıt varsa dar katman döner **ve çakışma bir sinyal olarak
Observability'ye yazılır.** Bu sinyal kural 6 gereği **gölge modda başlar**:
sayar, engellemez, hiçbir kararı değiştirmez. Eşiği ölçülmeden karara
bağlanmaz (§7).

**Elle girilen kayıt kanıt sayılmaz.** LightRAG'in kuralı doğrudan alındı
(`constants.py:51-54`): insan tarafından eklenen veri saklanır ama güven
ağırlığı düşüktür; "bir kaynakta gördüm" ile "elle yazdım" aynı ağırlıkta
sayılmaz.

---

## 5. Saklama, silme ve PII

**Saklama süresi tanımsız katman yazılamaz** (blueprint §5 kural 10). §2'nin
tablosunda beş katmanın beşinin de süresi yazılıdır; süresiz katman eklenmek
istenirse önce bu tabloya süre girer.

**Silme gerçekten siler.** İ2'nin AP2'si mem0'da iki kez tekrarlıyor: süresi
dolan kayıt yalnızca sonuçlardan gizleniyor (`main.py:442`, `show_expired=True`
ile geri geliyor) ve silinen kaydın **metni** geçmiş kaydında kalıyor
(`main.py:2113-2122`). İkisi de burada tekrarlanmaz:

- Saklama süresi bir **iş** tetikler, bir sorgu bayrağı değildir. Süresi dolan
  kayıt fiziksel olarak kaldırılır.
- Silinen kaydın yerinde **yalnızca** `content_hash` + `source` + silinme anı
  kalır. İçerik kalmaz. Böylece "bu bilgi belleğe nasıl girdi" cevaplanabilir
  kalırken "sil" gerçekten siler (İ2 Ö5).

**PII kararı: katman politikası, yazma anında sınıflandırma değil (İ2 S3).**
İki seçenek vardı; ucuz olanı seçildi ve gerekçesi şudur: yazma başına bir
sınıflandırma çağrısı hem token hem gecikme demek, ve yanlış pozitif maskeleme
belleği işe yaramaz hâle getirir — AP5'in "ölçülmemiş detektör karar veremez"
kuralı burada da geçerli. Politika şema düzeyinde zorlanır:

- `project` ve `knowledge` katmanına kişisel veri yazılamaz.
- `global` katmanına yazılabilir ama ajan sözleşmesinde `pii_allowed: true`
  **ve** gerekçe (`pii_basis`, en az 10 karakter) zorunludur — bu zorlama
  `agent.schema.json` `memory_scope` içinde zaten `if/then` ile duruyor
  (ADR-006).
- `task` ve `session` katmanlarında serbesttir, çünkü ikisi de süreli ve
  görev/oturum bitiminde düşer.

**Bilinçli zayıflık.** Katman politikası "yanlış katmana yazılmış kişisel
veriyi" yakalamaz; yalnızca yasağı ilan eder ve şemayla sınırlar. İçerik
düzeyinde tespit yoktur. Bu, blueprint §4.4'teki sandbox zayıflığıyla aynı
türdendir ve aynı şekilde kayda geçiriliyor. Bir detektör eklenirse kural 6
gereği **gölge modda** başlar: bir tur boyunca yalnızca sayar, hiçbir yazmayı
engellemez; yanlış pozitif oranı ölçüldükten sonra karar verilir.

İ2'nin bulgusu bu bölümün neden kanıtsız olduğunu açıklıyor: incelenen yedi
projede içerik düzeyinde PII tespiti veya maskelemesi bulunamadı (AP9), üstelik
mem0 ve LightRAG'in çıkarım promptları kişisel bilgiyi aktif olarak topluyor
(`prompts.py:15`). Kopyalanacak örnek yok; buradaki tasarım sıfırdan yapıldı.

---

## 6. RAG'in yeri

**RAG bir bellek katmanı değil, `knowledge` katmanının okuma yöntemidir.**

- Geri getirilen parça **bellek kaydı değildir.** Bağlama girer, belleğe
  yazılmaz. Yazılırsa İ2 D1 ihlal edilir: ham veri ile türetilmiş bellek
  karışır ve kaynak referansı zinciri kopar.
- Geri getirmeden türetilen bir şey saklanacaksa (özet, çıkarım) **çıkarımsal
  yazma sınıfından** geçer (§3) ve kaynak olarak getirilen parçayı taşır.
- Geri getirme bütçesi Context Manager'ın "bilgi" payıdır (§7); adet sınırı
  (`top_k`) tek başına bütçe sayılmaz — İ2 AP1'in tam olarak yakaladığı hata
  bu: cognee kenarları kırpmasız tek metne yığıyor
  (`resolve_edges_to_text.py:61-97`), mem0 proxy dönen bütün anıları kullanıcı
  mesajına yapıştırıyor (`proxy/main.py:176-186`) ve iki durumda da tek koruma
  çağıranın `top_k` seçimi.

Graf tabanlı bir bilgi katmanının girme koşulu §2'de tekrarlandığı gibi
blueprint §4.3'te duruyor; bu belge onu değiştirmedi.

---

## 7. Bağlam penceresi yönetimi

Context Manager'ın çekirdeği bütçe dağıtımıdır (İ2 Ö1, blueprint §2.7).

**Formül** (LightRAG'den doğrudan, `operate.py:5864`):

```
kalan = toplam − (sistem sözleşmesi + görev durumu + bilgi + sorgu + tampon)
```

`kalan` geri getirmeye ve geçmişe verilir. Bütçe **gerçekten render edilecek
şablonla** ölçülür (`operate.py:5802-5813`); tahmini bir şablonla ölçmek sessiz
bir hata üretir.

**Kısılma sırası önceden yazılır, çalışma anında seçilmez:**

| # | Bileşen | Kırpılır mı |
|---|---|---|
| 1 | Sistem sözleşmesi (ajan sözleşmesi, sabit sınırlar) | Hayır |
| 2 | Görev durumu (`task.run.step_records` özeti, açık adım) | Hayır |
| 3 | Geri getirilen bilgi (`knowledge`) | Evet, ilk |
| 4 | `session` özetleri | Evet, ikinci |
| 5 | Ham geçmiş mesajlar | Evet, üçüncü |

Kırpma sondan başa yürür. 1 ve 2 kırpılamaz olduğu için, ikisi tek başına
bütçeyi doldurursa bu bir **hata durumudur** ve göreve devam edilmez; sessizce
küçültülmez.

**Eşik %100'ün altındadır.** Tetikleme eşiği toplam pencerenin **%90**'ıdır
(Letta'nın `SUMMARIZATION_TRIGGER_MULTIPLIER = 0.9` değeri, İ2 §2/D5).
Hiçbir bileşen "pencere dolduğunda" değil, "dolmadan önce" davranır.

### 7.1 Token sayımı — S6 kararı

Blueprint §6 bu soruyu (yaklaşık sayım mı, sağlayıcı başına kesin tokenizer mı)
bu maddeye devretmişti. **Karar: yaklaşık sayım + güvenlik payı + ölçülenle
kalibrasyon.**

- **Neden kesin sayım değil:** her sağlayıcı için ayrı tokenizer bağımlılığı
  demek, ve ADR-000 K3/K4 (sağlayıcı bağımsızlığı) ile doğrudan çelişir. Karar
  veren kodda sağlayıcı adı geçmemeli (kural 5); tokenizer seçimi tam olarak
  o adı koda sokar.
- **Güvenlik payı %30** — Letta'nın `APPROX_TOKEN_SAFETY_MARGIN = 1.3` değeri
  (İ2 §2/D5). Yaklaşık sayaç kullanan her yerde uygulanır.
- **Kalibrasyon:** sağlayıcı yanıtta `usage` döndürdüğünde ölçülen değer
  tahminle karşılaştırılır ve sonraki çağrının payı gerçek/tahmin oranıyla
  ayarlanır. `usage` zaten Cost Manager'a akıyor (blueprint §3.2 adım 6); bu
  karar yeni bir veri yolu açmıyor, var olanı ikinci bir tüketiciye veriyor.
- **Dürüst sınır:** kalibrasyonun ilk çağrıda karşılığı yoktur; o çağrıda %30
  pay olduğu gibi harcanır. Ayrıca bu kalibrasyon fikri incelenen projelerden
  alınmadı, bizim eklememizdir — kanıtı yok, gerekçesi var (§9).

### 7.2 Taşma bir faz geçişidir

İ2 D4/D10: dört bağımsız proje aynı fikri buldu — taşma bir hata değil,
planlanmış bir geçiş. Letta'nın modeli alındı (`letta_agent_v3.py:1218`):

1. Eşik aşılır → kesim noktası bulunur.
2. Kesilen kısım **daha ucuz bir modelle** özetlenir.
3. Özet bağlama girer.
4. **Ham kayıt yerinde kalır** — bağlamdan tahliye, diskten silme değil.

4. madde pazarlık konusu değildir. LightRAG'in hatası (özetleme sırasında
orijinal açıklamaları LLM özetiyle **değiştirmesi**, İ2 AP6) tekrarlanmaz:
özet yanlışsa geri dönülecek bir yer kalmalı. Bu aynı zamanda D5'in
(kaynak kayıt korunur) bağlam düzeyindeki karşılığıdır.

**Retry döngüsünde bağlam büyümesi** ayrı bir taşma kaynağıdır (AP11 → kural
12). Orkestrasyon mimarisi bunu şema düzeyinde zaten sınırladı: eleştiri
listesi en fazla 20 madde, fazlası `truncated` işaretiyle kesilir ve ham kayıt
korunur (`02-ORKESTRASYON.md` §5). Context Manager tarafında ek bir kural
gerekmiyor; yansıma çıktısı 4. sıradaki `session` özetleri gibi davranır.

---

## 8. Ajan sözleşmesiyle bağ

`agent.schema.json` `memory_scope` alanı bu belgenin kararlarını bugün
şu ölçüde zorluyor:

| Bu belgedeki kural | Şemada karşılığı | Durum |
|---|---|---|
| Beş katman, başkası yok | `$defs.memory_layer` enum | Zorlanıyor |
| Saklama süresi tanımsız katman yazılamaz | `write` doluysa `retention` zorunlu (`if/then`) | Zorlanıyor |
| PII izni gerekçesiz verilemez | `pii_allowed: true` ise `pii_basis` zorunlu | Zorlanıyor |
| Yazma izni okuma izninden dardır | Yalnızca alan açıklamasında yazıyor | **Zorlanmıyor** |
| `knowledge`'a yalnızca alım işi yazar | `write` enum'u `knowledge`'ı da kabul ediyor | **Zorlanmıyor** |
| Katman süresi tavandır, sözleşme kısaltabilir | Karşılığı yok | **Zorlanmıyor** |

Son üç satır **düzeltilmedi, yazıldı.** Gerekçe: bu maddenin çıktısı
`docs/mimari/03-BELLEK.md`'dir, şema değişikliği değil; ve üçü de aynı yerde
kapanır — Faz 4'te `memory.schema.json` yazılırken `memory_scope` de birlikte
sıkılaştırılır (`write` için ayrı enum, `read ⊇ write` kontrolü, `retention`
tavan kontrolü). AP3 gereği burada "zorlanıyor" diye yazılmadılar.

---

## 9. Açık kalanlar ve temenniler

Bu belgenin **zorlayamadığı** dört şey:

1. **İçerik düzeyinde PII tespiti yok** (§5). Katman politikası yasağı ilan
   eder, ihlali yakalamaz. Bilinçli zayıflık; detektör eklenirse gölge modda
   başlar.
2. **`knowledge` kopyasının bayatlaması.** Kaynağı dışarıdadır ve
   `days-30` süresi bayatlamayı sınırlar ama tespit etmez; kaynak hash'i
   tutulur, karşılaştırma işi Faz 5'e ait.
3. **Katman çakışma sinyalinin eşiği ölçülmedi** (§4). Gölge modda sayılır;
   "kaç çakışma bir sorundur" sorusunun bugün cevabı yok.
4. **`memory.schema.json` yazılmadı** (§3.1). Alan listesi karara bağlandı,
   şema Faz 4'e ait — bu maddenin çıktısı tek bir belgeydi.

**İ2'nin beş açık sorusu ve blueprint'in devrettiği S6:**

| Soru | Karar | Nerede |
|---|---|---|
| İ2 S1 — bilgi katmanı graf mı | Hayır; blueprint §4.3 kararı korundu | §2, §6 |
| İ2 S2 — kaç katman, sınırları ne | Beş katman, tablo | §2 |
| İ2 S3 — PII nerede yakalanır | Katman politikası (yazma anında sınıflandırma değil) | §5 |
| İ2 S4 — yaklaşık sayım yeterli mi | Evet; %30 pay + `usage` ile kalibrasyon | §7.1 |
| İ2 S5 — yazma senkron mu asenkron mu | Senkron, adım sınırında | §3 |
| Blueprint S6 — yaklaşık mı kesin tokenizer mı | Yaklaşık; kesin sayım K3'ü kırar | §7.1 |

---

## 10. Dürüstlük

- **Bu belge yeni kanıt üretmedi.** Kaynağı İ2 özeti, blueprint, iki mimari
  belgesi ve Faz 2'nin üç belgesidir; bu turda hiçbir klona girilmedi, hiçbir
  `dosya:satır` yeniden doğrulanmadı. Buradaki dış atıfların güvenilirliği
  İ2'nin denetim durumuna eşittir (`docs/arastirma/i2-bellek/DENETIM.md`).
- **§5'in PII tasarımı kanıtsızdır ve bu bilinçlidir.** İ2'de yedi projeden
  hiçbirinde kopyalanacak bir içerik düzeyinde gizlilik mekanizması
  bulunamadı; bu bölümün dayanağı kanıt değil gerekçedir. Ekosistemde
  karşılığı olmayan tek bölüm budur.
- **§7.1'in kalibrasyon fikri incelenen projelerden alınmadı.** Letta yaklaşık
  sayaç + sabit pay kullanıyor, kalibrasyon yapmıyor. Ölçülen `usage` ile payı
  düzeltme bizim eklememizdir; ölçülmedi, denenmedi.
- **İ2'nin kapsam boşlukları burada da geçerli.** Letta analizi `origin/archive`
  dalı üzerinden yapıldı; LlamaIndex sparse checkout ile incelendi ve
  `workflows/`, `agent/`, `llms/` kapsam dışı bırakıldı; Anthropic'in bağlam
  yönetimi belgeleri okunmadı. Bu belge o boşlukların üstüne yazıldı ve onları
  kapatmadı.
- **§8'in son üç satırı bir açıktır, kapatılmış gibi yazılmadı.** Ajan
  sözleşmesi bu belgenin üç kuralını bugün zorlamıyor.
