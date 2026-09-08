# 07 — Kendini geliştirme mimarisi

> Faz 3, `YOL-HARITASI.md` "Self-improvement Architecture" maddesi.
> Girdi: [ADR-000](../adr/ADR-000-program-ve-ilkeler.md) K7,
> [`00-BLUEPRINT.md`](00-BLUEPRINT.md) §4.5 ve §5 (kural 9),
> [`04-DEGERLENDIRME.md`](04-DEGERLENDIRME.md) §6 ve §8,
> [`05-GUVENLIK.md`](05-GUVENLIK.md) §4,
> [`06-GOZLEM.md`](06-GOZLEM.md) §6 ve §7,
> ve İ6 izi (`docs/arastirma/i6-kodlama-ogrenme/`).
> Çıktı sözleşmesi: [`contracts/proposal.schema.json`](../../contracts/proposal.schema.json).

ADR-000 K7 zinciri beş halkalıdır:

> *izler (traces) → değerlendirme → **öneri** → insan onayı → uygulama.*

İlk iki halka yazıldı: span kayıtları [`06-GOZLEM.md`](06-GOZLEM.md)'de,
değerlendirme kararları [`04-DEGERLENDIRME.md`](04-DEGERLENDIRME.md)'de. Bu
belge kalan üç halkayı taşır — ve bunu yaparken **yeni bir çalışan bileşen
eklemez.** Neden eklemediği §2'nin konusudur; eklemeden ne kazandığı geri
kalanın.

---

## 1. Tek cümlelik akış

```
span kayıtları (06 §7 K7 girdi paketi)
        │
        ▼
  bir insan (bugün) veya bir üreteç (ileride) bir ÖNERİ yazar
        │        proposal.schema.json — veri, eylem değil
        ▼
  kapı 1: geçerli mi?      ─ şema tutuyor mu, test koşuyor mu
  kapı 2: eşiği aştı mı?   ─ ölçülen fark yeterli mi
        │        ikisi AYRI, tek bir "başarılı" bayrağı yok
        ▼
  kapı 3: insan onayı      ─ raporlar/ONAY-BEKLEYENLER.md
        │
        ▼
  uygulama: hedef yapıtın sürümü ilerler
        │
        ▼
  sürüklenme izleme: sayaç hareketi onaylı bir öneriyle açıklanabiliyor mu?
```

Üç kapı vardır ve **ilk ikisi üçüncünün yerine geçmez.** Makine kapıları
önerinin insana *gösterilmeye değer* olduğunu söyler; uygulanabilir olduğunu
söylemez.

---

## 2. Taşıyıcı karar: bu belge bir bileşen eklemiyor

`00-BLUEPRINT.md` §4.5 Learning Layer'ı çekirdek bileşen kümesinin **dışında**
bıraktı ve giriş koşulunu yazdı:

> **Ne olursa girer:** kapılı öneri üretiminin üretimde çalıştığı ikinci bir
> olgun örnek, veya elle tuzak kaydının yetmediği ölçülmüş bir arıza.

İ6 izi bu koşulu doğrudan sınadı. Yedi proje (OpenHands, DGM, OpenEvolve,
SWE-agent, Aider, TextGrad, GEPA) üç eksende — (a) kendi kodunu mu yoksa harici
bir hedefi mi değiştiriyor, (b) insan kapısı var mı, (c) üretim mi araştırma mı
— sınıflandırıldı. Sonuç:

> **Sonuç:** K7 çürümedi, bu turda daha da güçlendi — incelenen yedi projenin
> hiçbirinde "kendi kod/promptunu insan kapısız değiştirip üretimde güvenle
> çalışan" tek bir örnek bulunamadı.

Ve giriş koşulunun ikinci yarısı da karşılanmadı: elle tuzak kaydı
(`BILINEN-TUZAKLAR.md`, bugün 22 madde) hâlâ çalışıyor. §4.5'in kendi tespiti:
*"bugün bunu `BILINEN-TUZAKLAR.md` elle karşılıyor ve çalışıyor."*

**D1 — Öneri üreteci bir bileşen olarak kurulmaz; öneri *biçimi* bugün
kurulur.**

Ayrım şudur: kurulmayan şey izleri okuyup öneri yazan otomatik üreteçtir.
Kurulan şey, bir önerinin — kim yazarsa yazsın — hangi alanları taşımak
zorunda olduğudur. Bugün öneriyi insan yazıyor; sözleşme ona da uygulanır.

Gerekçe iki taraflı. Üreteç yazmamanın gerekçesi kanıt eşiğidir (yukarıdaki
iki alıntı). Sözleşmeyi bugün yazmanın gerekçesi ise şudur: `proposal.author.kind`
`insan` ve `uretec` değerlerini birlikte tanır, yani üreteç ileride girerse
kayıt biçimi değişmez, yalnızca bir alanın değeri değişir. Kapılar, onay akışı
ve sürüm bağı üretecin gelmesini beklemez — çünkü onları sonradan eklemek,
şu anda çalışan elle akışı da yeniden yazmak demektir.

**Bu belgenin ölçülebilir çıktısı:** `contracts/proposal.schema.json`
(`contract_version` 1.0), üç örnek kayıt, ve `arac/sema-dogrula.js` içinde
sekiz çapraz kontrol + on beş öz-test. Yeni bir çalışan süreç yok.

---

## 3. Öneri veridir, eylem değildir

**D2 — Bir öneri hiçbir dosyayı değiştirmez; kendisi bir kayıttır.**

İ6'nın AP3'ü tam bu sınırı ihlal eden desendir:

> **AP3 — dışarı açılan bir eylem (PR açma, dosya üzerine koşulsuz yazma)
> onaysız varsayılan yolda mümkün.**

ve aynı ailenin en saf hâli TextGrad'dır:

> TextGrad bu deseni tamamen atlıyor — `optimizer.step()` üretilen metni
> hiçbir karşılaştırma yapmadan `parameter.set_value(new_value)` ile doğrudan
> uyguluyor (`textgrad/optimizer/optimizer.py:186`).

Sözleşmede bunun karşılığı yapısaldır: şemada **uygulama fiili yoktur.**
`status` alanı `UYGULANDI` değerini alabilir, ama bu değer uygulamanın
*olduğunu kaydeder*, uygulamayı *tetiklemez*. Uygulamayı yapan, onaydan sonra
dosyayı düzenleyen insandır.

**D3 — Öneri span kayıtlarını okur, canlı sistemi değil.**

`06-GOZLEM.md` D7'nin devamıdır:

> **D7 — K7'nin girdisi span kayıtlarıdır; öneri üretimi span'leri okur,
> canlı sistemi değil.**
>
> Gerekçe D1'in devamı: öneri, olmuş bitmiş bir koşu hakkındadır. Canlı
> duruma bakan bir öneri üreteci, gözlemlediği sistemi etkileme yoluna
> sahip olur — K7'nin "kendiliğinden değiştirmez" kuralının en sessiz ihlali
> budur.

Burada makinede sınanır hâle gelir: `evidence.window_end` alanı zorunludur ve
çapraz kontrol `window_end > at` olan kaydı reddeder. Kanıt penceresi, önerinin
yazıldığı andan önce **kapanmış** olmak zorundadır. Belgede yazan ama makinede
sınanmayan kural AP3'ün tanımıdır (kural 4).

---

## 4. Ne önerilebilir, ne önerilemez

**D4 — Önerilebilir hedefler kapalı bir listedir; kapının kendisi bu listede
değildir.**

`target.kind` dört değer tanır:

| Sınıf | Ne | Sürümü nerede |
|---|---|---|
| `ajan-sozlesmesi` | Bir ajanın 16 alanlı sözleşmesi | `agent.schema.json` `contract_version` + içerik özeti |
| `prompt` | Ajan sözleşmesindeki yönerge metni | Aynı yapıtın özeti |
| `yonlendirme-politikasi` | Hangi adımı hangi ajan/model alır | `02-ORKESTRASYON.md` + politika dosyası |
| `esik` | Değerlendirme eşikleri, bütçe tavanları, protokol sayıları | `04-DEGERLENDIRME.md` §5, `00-ARASTIRMA-PROTOKOLU.md` |

Bu dördü ADR-000 K7'nin saydıklarıdır: *"kendi prompt'unu, ajan sözleşmesini
veya yönlendirme politikasını"*. `esik` dördüncü olarak eklendi çünkü
`04-DEGERLENDIRME.md` §5'in eşikleri de sürümlü sayılardır ve İ6'nın kapalı
kalan sorusu tam onlarla ilgilidir (§10, S3).

Listenin dışında kalan her şey bir öneri değil, **normal bir değişikliktir** ve
kendi kapısından geçer. Bu bir kısıtlama değil, bir yönlendirmedir: kodu
değiştirmek için önerinin onayını beklemek gerekmez; kodu değiştirmek zaten
git'in ve insanın işidir.

**Yasak hedefler.** Dört sınıfın dışında, yol düzeyinde de reddedilen bir liste
vardır (`ONERI_YASAK_HEDEF`, `arac/sema-dogrula.js`):

- `contracts/permission.schema.json` — izin kararının biçimi
- `contracts/proposal.schema.json` — önerinin kendi biçimi
- `docs/adr/ADR-000`, `docs/adr/ADR-005` — program kararları ve sabit sınırlar
- `docs/mimari/05-GUVENLIK.md` — kapının tanımı
- `arac/sema-dogrula.js` — kuralları sınayan araç

Gerekçe İ6'nın AP1'idir:

> **AP1 — "İnsan kapısı var" görünümü, tek bayrak/tek config değeriyle
> tamamen kaldırılabiliyor.**

AP1'in klasik biçimi bir bayraktır (`--yes-always`, `NeverConfirm`). Öneri
mekanizmasında ise daha sessiz bir biçimi vardır: kapıyı kaldıran bir öneri
yazıp onaylatmak. Bir kez olur, sonra hiçbir şey onay istemez. Bu yüzden kapı,
öneri hedefi olamaz — `05-GUVENLIK.md` §4.1'in üçüncü mekanizmasının aynısı:

> Üçüncüsü kritiktir: ilk ikisi sözleşmeyi korur, kapıyı kapatan asıl şey
> listenin okunduğu yerdir. Yapılandırmadan okunan bir liste, bir bayrağın uzun
> hâlidir.

Liste **uzatılabilir, daraltılamaz**: yasak hedef eklemek normal bir kod
değişikliğidir, çıkarmak ise kapının kendisini değiştirmek olduğu için aynı
listeye takılır.

---

## 5. İzlerden öneri üretme

Öneriyi bugün insan yazıyor (D1). Ama neye bakarak yazacağı sözleşmede sabittir
— "gözlemime göre" ile başlayan bir öneri kayıt olamaz.

`evidence` bloğu `06-GOZLEM.md` §7'nin K7 girdi paketinden **türetilir**:

| Öneri alanı | 06 §7'deki karşılığı |
|---|---|
| `evidence.run_ids` | `run_id + trace_id` — hangi koşu |
| `evidence.span_refs` | `invoke_agent` / `evaluate` span'leri |
| `evidence.observation.counter` | §6'nın sekiz sayacından biri |
| `evidence.window_start` / `window_end` | koşunun kapanmış zaman aralığı |
| `evidence.doc_refs` | depo içi `dosya:satır` alıntısı |

**Span şemasına bu belge için tek bir alan eklenmedi.** `06-GOZLEM.md` §7 bunu
zaten taahhüt etmişti (*"öğrenme döngüsü için span şemasına fazladan hiçbir alan
eklenmedi"*) ve bu belge o taahhüdü tüketiyor: `proposal.schema.json`
mevcut alanları okur, yenisini istemez. Öğrenme tarafı sözleşme yüzeyine
dokunmadan kuruldu.

`evidence.run_ids` **en az bir** öğe ister (`minItems: 1`). Kanıtsız öneri
yazılamaz; öz-test bunu sınıyor (`kanitsiz oneri yazilamaz`).

**Ölçüm zorunlu değil, ama ölçümsüzlük görünür.** `observation` isteğe bağlıdır
— her öneri bir sayaç hareketinden doğmaz; bazıları bir arızadan doğar
(`BILINEN-TUZAKLAR.md`'nin 22 maddesinin çoğu böyle). Ama `observation`
yoksa `gates.threshold` bir ölçüme dayanamaz ve `method` alanı bunu yazmak
zorunda kalır. Eksik ölçüm gizlenemiyor, çünkü eşik kapısının yöntemi
serbest metin değil, "tekrarlanabilir bir şey" olarak tanımlıdır.

---

## 6. Üç kapı

### 6.1 İki makine kapısı ayrıdır (İ6 Desen A)

İ6'nın en çok bağımsız kaynak toplayan deseni:

> **Desen A — otomatik kabul kapısı "geçerli mi" ve "yeterince iyi mi" iki ayrı
> testten geçiyor, hiçbiri tek bir "başarılı" bayrağına indirgenmiyor.**

Üç bağımsız proje bunu ayrı ayrı üretmiş: DGM'de `is_compiled_self_improve()`
(`utils/evo_utils.py:96-126`) yalnızca derlenme/boş-olmayan-yama testini yapıyor,
eşiği ayrı bir fonksiyon (`get_full_eval_threshold`, `DGM_outer.py:192-215`)
ölçüyor; OpenEvolve'da `database.py:292` `should_replace = self._is_better(...)`;
GEPA'da `src/gepa/strategies/acceptance.py:49` `return new_sum > old_sum`.

Sözleşmede `gates` iki zorunlu alt nesnedir ve **birleştirilemez**: öz-test
`tek basarili bayragi iki kapinin yerine gecemez` durumunu sınıyor — `threshold`
silinip `valid` "geçti" yapılan kayıt reddediliyor.

Her kapı üç değerlidir: `gecti` · `kaldi` · `calistirilmadi`. Üçüncü değer
`05-GUVENLIK.md` §2.5'in kuralıdır — *"Kontrol edilmedi" ≠ "temiz".* Çalıştırılmamış
kapıyla uygulama yapılamaz.

**Karşıt kanıt yazılıdır.** İ6 aynı desenin ihlalini de buldu (TextGrad,
§3'te alıntılandı) ve bu, desenin "herkes böyle yapıyor" değil, "yapmayan
üretimde savunulamıyor" biçiminde okunmasını sağlıyor. İ6'nın kendi tablosu
TextGrad satırında bunu açıkça yazıyor: *"yalnızca insanın canlı izlediği hızlı
deneysel iterasyon; üretimde savunulamaz"*.

### 6.2 Eşiği kim belirler

İ6 §6'nın açık sorusu: *"Bir otomatik kabul kapısı kurulursa eşiği kimin/nasıl
belirleyeceği (görev dosyası mı, sabit protokol mü) bu izde cevaplanmadı."*

**D5 — Eşiği öneri belirlemez; eşik, önerinin hedefi olabilen sürümlü bir
yapıttır.**

Yani eşik iki roldedir ve ikisi aynı anda olamaz: bir öneri ya *bir eşiği
değiştirmeyi önerir* (`target.kind: "esik"`) ya da *bir eşikten geçer*
(`gates.threshold`). Kendi eşiğini kendi içinde tanımlayan öneri, eşiği
olmayan öneridir.

Mekanizması sözleşmede değil, hedefin yerindedir: eşikler
`04-DEGERLENDIRME.md` §5 ve `00-ARASTIRMA-PROTOKOLU.md` gibi sürümlü
belgelerde yazılıdır. Bir öneri eşiği değiştirmek isterse, o belgeyi hedef alır
ve kendisi o belgenin **eski** sürümündeki eşiğe göre değerlendirilir. Eşiği
gevşetip aynı kayıtta o gevşemeden faydalanmak bu yüzden mümkün değildir.

### 6.3 İnsan kapısı

`05-GUVENLIK.md` §4.3'ün deseni birebir uygulanır: **onay bir durumdur, kaydı
vardır.** `approval` nesnesi üç alan ister — `by` (tek değerli: `insan`), `at`,
ve `recorded_in` (`raporlar/ONAY-BEKLEYENLER.md` içindeki satır). `gate_ref`
doğan `approval_request` mesajının kimliğidir.

Üç yapısal kısıt kapıyı bayrağa indirgenemez kılıyor — `05-GUVENLIK.md` §4.1'in
üçlüsünün bu belgedeki karşılığı:

1. `additionalProperties: false` — `auto_apply` gibi bir alan **uydurulamaz**;
   öz-test bunu sınıyor (`otomatik uygulama alani yazilamaz`).
2. `status` `ONAYLANDI`/`UYGULANDI`/`GERI_SARILDI` iken `approval` şema
   düzeyinde zorunludur; onaysız uygulanmış kayıt reddedilir.
3. `approval.by` `const: "insan"` — bir bileşen buraya yazılamaz. Çapraz kontrol
   ayrıca aynı şeyi ikinci kez söylüyor, çünkü şema değişirse kontrol kalır.

Dördüncüsü sözleşmenin dışındadır ve en güçlüsüdür: **uygulayan bir bileşen
yoktur.** Hiçbir ajanın `contracts/`, `docs/mimari/` veya politika dosyalarına
yazma yetkisi tanımlı değildir (`05-GUVENLIK.md` §3.1, varsayılan boş küme).
Onaylanan öneriyi insan uygular. Kapıyı kapatmak için kaldırılacak bir bayrak
değil, yazılacak bir bileşen gerekir — ve o bileşen `05-GUVENLIK.md`'nin izin
kapısından geçmek zorundadır.

### 6.4 Reddedilen öneri silinmez

GEPA reddedilen adayı state'e hiç sokmadan **loglar**
(`_report_rejected_proposal`, `src/gepa/core/engine.py:520-565`). Aynı ayrım
burada da var: `status: "REDDEDILDI"` bir kayıttır ve `rejection_reason` şema
düzeyinde zorunludur. Reddin kendisi sinyaldir — aynı öneri üç kez reddedilmişse
sorun önerinin değil, hedefin tarafındadır.

---

## 7. Sürümleme ve durumu geri sarma

**D6 — Uygulanan öneri hedefin sürümünü ilerletir; geri alma diye bir mekanizma
değil, sürüm sabitleme vardır.**

`00-BLUEPRINT.md` §5 kural 9 bağlayıcıdır: *"Rollback" kelimesi mimariye
girmez.* Bu belge o kuralın altında kalır ve `reversal` alanının açıklaması
bunu yazar: geri sarma, hedef yapıtın sürümünü `version_before`'a
**sabitlemektir**. Çapraz kontrol başka bir sürüme sabitlemeyi reddediyor
(`geri sarma baska bir surume sabitlenemez`).

Neden bu ayrım anlamlı: öneri hedefleri (§4'ün dört sınıfı) **veri
yapıtlarıdır** — bir sözleşme dosyası, bir prompt metni, bir eşik sayısı.
Önceki hâllerine sabitlenmeleri tam ve kayıpsızdır. Bunun tersi, dışarı açılan
etkilerdir: onaylı bir öneri sonrası koşan bir ajan e-posta gönderdiyse,
sözleşmeyi eski sürüme sabitlemek o e-postayı geri getirmez. `05-GUVENLIK.md`
§4.2 bunun adını koymuş:

> bu mimaride "geri alma" diye bir mekanizma yoktur, **telafi** vardır

Sınır nettir: sürüm sabitleme yapıtın kendisini kapsar, ürettiği etkiyi
kapsamaz. Etki tarafı insan kapısının konusudur ve zaten oraya düşer
(`irreversible: true` olan hiçbir izin kaydı `ALLOW` olamaz).

**Sürüm bağı neye takılır.** `target.version_before` zorunludur,
`version_after` yalnızca `UYGULANDI` durumunda zorunludur (şema `if/then`), ve
çapraz kontrol ikisinin aynı olmasını reddeder. Sürümsüz uygulanan bir
değişiklik geri sarılamaz — çünkü hangi hâle döneceği yazılı değildir.

Sürüm etiketi ya `1.2` biçiminde bir sürüm numarası ya da `sha256:` önekli bir
içerik özetidir. Özet tercih edilir: ADR-007'nin gerekçesi burada da geçerlidir —
`permission.schema.json`'ın `digest` açıklamasının yazdığı gibi, sürüm numarası
değişmeden içerik değişebilir.

**Kayıt append-only'dir.** İ6 Desen C dört bağımsız projede aynı fikri buldu
(OpenHands `EventLog`, DGM `dgm_metadata.jsonl`, OpenEvolve checkpoint, GEPA
`GEPAState.save`). Burada da durum değişince kayıt **güncellenmez**, yeni bir
kayıt yazılır: `ONERILDI` kaydı `UYGULANDI` kaydının yanında durur. Gerekçe
sürüklenme tespitidir (§8) — bir sayaç hareketinin hangi öneriden doğduğunu
söyleyebilmek için önerinin geçmişi gerekir, son hâli değil.

---

## 8. Sürüklenme tespiti

ADR-000 K7'nin gerekçesi tek cümledir: *"gözetimsiz kendini-değiştirme,
ölçülemeyen sürüklenme üretir."* Bu bölüm o cümlenin ölçülebilir hâlidir.

**D7 — Sürüklenme, sayaç hareketinin onaylı bir öneriyle açıklanamamasıdır.**

Tanım bir hipotez üzerine kuruludur: `06-GOZLEM.md` §6'nın sekiz sayacı, onaylı
bir öneri veya kaydedilmiş bir dış neden olmadan **hareket etmemelidir.** Bu
hipotezin ihlali sürüklenmedir:

```
sayaç Δ (iki pencere arası)
   │
   ├─ açıklayan onaylı öneri var mı?        (proposal kayıtları)
   ├─ kaydedilmiş dış neden var mı?         (fiyat tablosu güncellemesi,
   │                                         sağlayıcı değişikliği, 06 §5.2)
   └─ ikisi de yoksa → sürüklenme sinyali (drift, mode: golge)
```

Sürüklenmenin ölçülebilir olması, öneri kayıtlarının var olmasına bağlıdır. Bu,
§2'de yazılmayan üretecin **olmamasının** bir bedeli değil: öneri elle yazılsa
da kayıt aynı biçimdedir, dolayısıyla "hangi Δ hangi değişiklikten doğdu"
sorusu bugünden cevaplanabilir.

**Detektör gölge modda başlar ve yetki almaz.** `03-ANTI-PATTERNLER.md` kural 6
(AP5 → *ölçülmemiş detektör gölge modda başlar*) burada iki yerde
zorlanıyor:

1. `drift.mode` `const: "golge"` — başka bir mod şemada tanımlı değildir.
2. Çapraz kontrol, `gates.threshold.evidence_kind` `surukleme` olan kaydı
   reddeder: sürüklenme sinyali bir eşik kapısının kanıtı **olamaz**.

İkincisi ilk bakışta fazladan görünüyor, ama tam olarak İ6'nın AP2'sinin
önlediği şeydir:

> **AP2 — otomatik kapı yalnızca "çalıştı mı / skor arttı mı" ölçüyor, güvenlik
> veya yan etki denetlemiyor.**

Bir sürüklenme sinyalinin kendisini kendi düzeltmesinin gerekçesi yapmak,
kapının tek bir sinyale kapanmasıdır. Sinyal bir öneriyi **tetikleyebilir**
(`03-reddedildi-surukleme.json` örneği tam bunu gösteriyor), ama o önerinin
eşik kapısı bağımsız bir ölçüme dayanmak zorundadır.

**Sürüklenme sinyalinin normal sonu reddir.** Örnek kayıt bunu gösteriyor:
maliyet sayacı hareket etti, açıklayan öneri yok, ama önerilen düzeltmenin
(ucuz modele geçme) eşik kapısı hiç çalıştırılmadı — kayıt `REDDEDILDI`.
Sinyal saklanıyor, düzeltme uygulanmıyor. Bugünkü ölçekte doğru davranış
budur: `BILINEN-TUZAKLAR.md` #4 ve #7, ölçülmemiş bir maliyet düzeltmesinin
bütçe sayacını yanlış okuduğunda ne olduğunu zaten kaydetmiş.

---

## 9. Sözleşme ve şemanın göremediği kurallar

`contracts/proposal.schema.json` (`contract_version` 1.0). Şemayla ifade
edilemeyen alanlar-arası kurallar `arac/sema-dogrula.js` içinde
`oneriCaprazKontrol` olarak kodlanmıştır — belgede yazan ama makinede
sınanmayan kural AP3'ün tanımıdır (kural 4).

| # | Kural | Nereden |
|---|---|---|
| 1 | Kanıt penceresi önerinin yazıldığı andan sonra kapanamaz | `06-GOZLEM.md` D7 · §3 |
| 2 | `window_start` ≤ `window_end` | tutarlılık |
| 3 | `UYGULANDI` için iki kapının **ikisi** de `gecti` olmalı | İ6 Desen A · §6.1 |
| 4 | Sürüklenme sinyali eşik kapısının kanıtı olamaz | AP5 → kural 6 · §8 |
| 5 | Yasak hedef yolları öneri hedefi olamaz | AP1 · §4 |
| 6 | `UYGULANDI` sürümü ilerletmek zorundadır | kural 9 · §7 |
| 7 | Geri sarma yalnızca `version_before`'a sabitlenir | kural 9 · §7 |
| 8 | Onaylayan yalnızca `insan` olabilir | AP1 · §6.3 |

Şema tarafındaki dört `if/then` kuralı (onay zorunluluğu, `version_after`
zorunluluğu, red gerekçesi, geri sarma kaydı) ve `additionalProperties: false`
bunlarla birlikte çalışır. Toplam on beş bozma denemesi öz-testte sınanıyor:

```
$ node arac/sema-dogrula.js --test
Şema: contracts/proposal.schema.json (contract_version 1.0) — 3 örnek
...
Öneri sözleşmesi (şema + çapraz kontrol):
  ✓ otomatik uygulama alani yazilamaz
  ✓ onay kaydi olmadan UYGULANDI yazilamaz
  ✓ onaylayan bir bilesen olamaz
  ✓ kalmis kapiyla uygulama olmaz
  ✓ calistirilmamis kapi gecmis sayilmaz
  ✓ tek basarili bayragi iki kapinin yerine gecemez
  ✓ kanitsiz oneri yazilamaz
  ✓ canli sisteme bakan oneri yazilamaz
  ✓ surukleme sinyali esik kapisini geciremez
  ✓ kapinin kendisi oneri hedefi olamaz
  ✓ sabit sinirlar oneri hedefi olamaz
  ✓ surum ilerlemeden uygulama olmaz
  ✓ geri sarma baska bir surume sabitlenemez
  ✓ kapali hedef listesi disina cikilamaz
  ✓ red gerekcesi zorunludur

Sonuç: temiz.
```

---

## 10. İ6'nın açık sorularının durumu

İ6 §6 dört soru bıraktı. İkisi burada kapanıyor, ikisi kapanmıyor.

**S3 — eşiği kim/nasıl belirleyecek? → kapandı.** §6.2, D5: eşik önerinin
hedefi olabilen sürümlü bir yapıttır; öneri kendi eşiğini tanımlayamaz ve
gevşettiği eşikten aynı kayıtta faydalanamaz.

**S4 — "kendi promptunu/CLAUDE.md'sini değiştirme" sorusu bu döngüye nasıl
uygulanacak? → kapandı, ama beklenenden dar bir cevapla.** `CLAUDE.md` bu
mimarinin bir yapıtı değil, **ev sahibinin** (Claude Code) yapılandırmasıdır.
§4'ün dört sınıfından hiçbirine girmez: ajan sözleşmesi değil, prompt değil
(ajan sözleşmesindeki yönerge metni kastediliyor), yönlendirme politikası değil,
eşik değil. Dolayısıyla `CLAUDE.md`'yi değiştirmek bir öneri değil, normal bir
değişikliktir ve insanın kendi kararıdır. Bu, K8'in (*"Claude Code ilk ev
sahibi, tek ev sahibi değil"*) doğrudan sonucudur: ev sahibi biçimi
sözleşmeden türetilir, tersi değil — ve türetilen bir biçim öneri hedefi olmaz,
kaynağı olur.

**S1 — Cline'ın insan kapısı UI'da mı çekirdekte mi? → kapanmadı.** Klonlanmadı;
`docs/arastirma/i6-kodlama-ogrenme/DURUM.md`'de en yüksek değerli kalan aday
olarak duruyor. Bu belgenin AP1 tarafındaki kanıtı iki bağımsız kaynakla
(Aider, OpenHands) yetiniyor.

**S2 — üç kalıcılık formatından hangisi bizim ölçeğimize uyar? → bu belgenin
kapsamı dışında.** Öneri kayıtlarının append-only olması kararı §7'de verildi;
formatın kendisi (jsonl mi, dosya başına kayıt mı) Faz 4'ün "Repository /
folder structure" maddesine ait.

---

## 11. Kapanmayan yerler

**1. İkinci olgun kaynak hâlâ yok.** `00-BLUEPRINT.md` §4.5'in giriş koşulu
karşılanmadı ve bu belge onu karşılamıyor — yalnızca karşılandığında ne
olacağını hazırlıyor. A2'nin üç adayı (DGM tarihî referans, OpenEvolve 0.x,
GEPA 0.1.4) bu turda da olgun değil.

**2. Öneri üreteci yazılmadı, dolayısıyla ölçülmedi.** D1 üretecin biçimini
sabitliyor ama bir üretecin izlerden işe yarar öneri çıkarıp çıkaramayacağı
bu depoda hiç denenmedi. Sözleşmenin `author.kind: "uretec"` değeri bir
tahmindir, bir ölçüm değil.

**3. Sürüklenme detektörü de yazılmadı.** §8 tanımı ve gölge modu kuralını
veriyor, sinyali üretecek kodu vermiyor. Sayacın geldiği yer henüz hazır değil:
`06-GOZLEM.md` §10.1 dışa aktarım katmanının yazılmadığını, §10.6 sekiz sayacın
birinin benchmark setinin olmadığını kaydetmişti. Bağımlılık tek yönlüdür ve
sırası bellidir: sayaclar toplanmadan sürüklenme ölçülemez.

**4. `esik` sınıfının sürümü belirsiz.** `ajan-sozlesmesi` ve `prompt` için
sürüm bağı nettir (`agent.schema.json` + içerik özeti). Eşikler ise bugün
markdown belgelerin içinde düz sayı olarak duruyor; içerik özeti belgenin
tamamını kapsar, yani ilgisiz bir düzenleme de özeti değiştirir. Doğru çözüm
eşiklerin ayrı bir sürümlü dosyaya çıkması, ama bu Faz 4'ün yapı kararıdır.

**5. Kapalı hedef listesi test edilmedi, yalnızca savunuldu.** §4'ün dört sınıfı
K7'nin saydıklarından + bir ekten oluşuyor. Beşinci bir sınıfa ihtiyaç doğarsa
bunu ancak gerçek bir öneri yazmaya çalışırken göreceğiz.

---

## 12. Dürüstlük

Bu belge tek bir izin (İ6) bulgularına ve dört kardeş mimari belgesine
dayanıyor; yeni kanıt üretilmedi, hiçbir klona girilmedi. İ6 alıntılarının
tamamı `docs/arastirma/i6-kodlama-ogrenme/OZET.md`'den, kardeş belge
alıntıları ilgili dosyalardan birebir alındı.

En zayıf yer §2'nin kendisidir: bu belge bir mimari tasarlıyor ve aynı belgede
o mimarinin **kurulmaması** gerektiğini savunuyor. Bu tutarsızlık değil, ama
gerilim: sözleşme yazmanın maliyeti düşük (bir şema + üç örnek + yedi kontrol),
buna karşılık yazılmış bir sözleşme kendi uygulamasını çağırma eğilimindedir.
Karşı ağırlık §11'in ilk maddesidir — giriş koşulu yazılı ve değişmedi.

İkinci zayıflık kanıtın tek yönlü olmasıdır. İ6 "insan kapısız kendini
değiştirme üretimde çalışıyor mu?" sorusuna hayır cevabı verdi; ama "kapılı
öneri üretimi işe yarıyor mu?" sorusunu **kimse sormadı** — çünkü onu üretimde
yapan olgun bir örnek de bulunamadı. Bu belgenin tasarımı, ikinci sorunun
cevabının olumlu olduğu varsayımıyla yazıldı ve o varsayımın kanıtı yok.
Elimizdeki tek destek dolaylıdır: `BILINEN-TUZAKLAR.md`'nin 22 maddesi elle
yazılmış, kapılı ve işe yaramış önerilerdir.
