# 02 — Orkestrasyon mimarisi

**Tarih:** 2026-09-08 · **Faz:** 3 (mimari sentez)
**Girdi:** [00-BLUEPRINT.md](00-BLUEPRINT.md), [ADR-002](../adr/ADR-002-yurutme-ve-iletisim.md),
[ADR-003](../adr/ADR-003-ilerleme-kaydi.md), [ADR-004](../adr/ADR-004-degerlendirme-kapisi.md),
[ADR-005](../adr/ADR-005-izin-siniri.md), İ1 özeti, `docs/02-EN-IYI-FIKIRLER.md`,
`docs/03-ANTI-PATTERNLER.md`.
**Çıktı sözleşmeleri:** [`contracts/task.schema.json`](../../contracts/task.schema.json),
[`contracts/message.schema.json`](../../contracts/message.schema.json).

Bu belge tek soruya cevap verir: **bir hedef, yürütülen adımlara nasıl dönüşür
ve o adımlar birbirine ne söyler?** Bileşen kümesi ADR-001'de, yürütme modeli
ADR-002'de karara bağlandı; burada o kararların **veri düzeyindeki karşılığı**
yazılır. Yeni bir bileşen tanıtılmaz.

> Bu belgenin ilkesi: her kural bir şema satırında zorlanır ve bir öz-testte
> sınanır. Zorlanamayan kural bu belgeye kural olarak yazılmaz — §7'ye
> "temenni" olarak yazılır. Gerekçe AP3: beyan edilen garantinin kodda
> karşılığı olmaması.

---

## 1. Tek cümlelik akış

> **Plan bir veridir** (`task.graph`), **yönlendirme bir alandır**
> (`step.assign` ve `handoff` mesajı), **yürütücü tektir** ve durumu tek bir
> tabloya yazar (`task.run.step_records`); ajanlar birbirine değil,
> yürütücüye konuşur.

---

## 2. Planlayıcı — hedef → görev grafı

**Karar (blueprint §4.1'in devamı): planlayıcı bir çekirdek bileşen değil, bir
ajan rolüdür.** Kanıt maddesi boştu: İ1'in altı yinelenen deseninin hiçbiri
planlama değil ve dinamik plan üretimi tek projede (CrewAI hierarchical) ve
orada da bir rol. Bu belge o kararı değiştirmez; **plan çıktısının biçimini**
sabitler.

**Planın biçimi = `task.schema.json` `graph.steps`.** Kim üretirse üretsin
(insanın yazdığı görev dosyası, `planner` rolündeki bir ajan, ya da elle
düzeltilmiş bir graf) çıktı aynı şemadan geçer. Böylece İ1 §3'ün "graf mı rol
mü" ayrımı **veri düzeyinde** kalır: rol tabanlı akış, `depends_on` boş tek
adımlı bir graftır (ADR-002).

**Planın deterministik doğrulaması var** — ADR-004'ün birinci kademesi
("her çıktı türü için bir deterministik doğrulayıcı aranır") burada karşılandı.
`arac/sema-dogrula.js` şemanın ifade edemediği üç şeyi ayrıca kontrol eder:

| Kontrol | Neden şemada değil | Nerede |
|---|---|---|
| Graf bir DAG'dır (döngü yok) | tek adımın şeması komşularını görmez | `gorevCaprazKontrol` |
| Bağımlılıklar tanımlı adımlara bakar | aynı | aynı |
| İki adım aynı alana yazamaz | ADR-002 kararı, adımlar arası ilişki | aynı |

Üçüncüsü ADR-002'nin "paralel yazma çakışması" kararının makine karşılığıdır:
LangGraph'ın kanal birleştiricisi **alınmadı**, çakışma grafın kendisinde
çözülür. Kontrol edilmeseydi karar bir temenni olurdu.

**Planın revizyonu:** çalışırken plan değişebilir (bir adım iki adıma bölünür).
Değişiklik mevcut kaydın üstüne yazılmaz; yeni bir `run_id` açılır ve
`run.resumed_from` ile öncekine bağlanır (D5 — kaynak kayıt korunur, dal
açılır). Tamamlanmış adımlar tekrar çalıştırılmaz (ADR-003).

**Planlayıcının yapamadığı:** kendi bütçesini büyütmek. `task.budget` görev
sözleşmesinin alanıdır, adımın değil; plan üreten ajan onu okur, yazamaz.

---

## 3. Yönlendirici — görev → ajan

**Karar (blueprint §4.2): yönlendirme ayrı bir servis değildir.** İ1 D5:
*"Yönlendirme = bir sonraki ajanı belirten dönüş değeri… adım çıktısının bir
alanı."* Mimaride bunun iki karşılığı var ve ikisi de sözleşmede:

1. **Statik yönlendirme — `step.assign`.** İki mod: `role` (kayıt defteri o
   role sahip ve `identity.status = active` olan ajanı seçer) veya `agent`
   (doğrudan id). Şema, moda göre eksik alanı reddeder.
2. **Dinamik yönlendirme — `handoff` mesajı.** Çalışan ajan "bunu bir
   `reviewer` yapmalı" der; bu bir **öneridir, çağrı değildir**: şema
   `handoff` mesajının hedefini `orchestrator` olmaya zorlar. Kararı yürütücü
   verir.

**Devir tavanı şemada sabittir:** `handoff_depth` en fazla 3. Yapılandırmadan
yükseltilemez — kural 1'in ("sabit sınırlar config'ten okunmaz") orkestrasyona
düşen hâli. Kanıt İ1 Ö4: Strands'ın Swarm'daki sert devir tavanı ve
tekrarlayan-devir tespiti (`multiagent/swarm.py:210-231`), ajanların birbirine
top atmasını durduruyor. Tavan aşılırsa devir değil, insan kapısı.

**Seçim kriteri kayıt defterinde, yürütücüde değil.** Döngü "hangi ajan"
sorusunu Agent Registry'ye sorar; içinde ajan adı geçmez (ADR-002: politika
döngüde yaşamaz).

---

## 4. Yürütücü — tek döngü

ADR-002: **tek yürütme döngüsü**; bileşenler birbirini çağırmaz. Döngünün
tamamı, politika içermeden:

```
hazir(graf, kayit) = depends_on'u BITTI olan, kaydı olmayan adımlar
while hazir(...) boş değilse:
    for adım in hazir(...):                  # paralellik depends_on'dan türer
        kayit.yaz(adım, BASLADI)             # yan etkiden ÖNCE (ADR-003)
        sozlesme  = AgentRegistry.getir(adım.assign)
        baglam    = ContextManager.butcele(MemoryManager.oku(...))
        sonuc     = ModelRouter.calistir(sozlesme, baglam)
        araç çağrısı varsa:
            karar = PermissionManager.karar(...)   # ALLOW | BLOCK | HUMAN_REQUIRED
            HUMAN_REQUIRED → kayit.yaz(adım, ONAY_BEKLIYOR, approval_ref); döngüden çık
        hüküm = Evaluator.gecerli_mi(sonuc) ve Evaluator.esigi_asti_mi(sonuc)
        KALDI → Critic.yaz(...) → RecoveryManager.mod(...) → retry politikası adımdadır
        kayit.yaz(adım, BITTI | BASARISIZ, evaluation_result, error_type)
    Observability her satırda tek yönlü span alır
```

Sözde-kod bileşen adlarından ve durum adlarından ibarettir; içinde **tek bir
politika değeri geçmez**: retry sayısı
`step.retry`de, eşik `step.evaluation.threshold`da, bütçe `task.budget`ta,
model kararı Model Router'da. AP7'ye (çekirdek tek dosyada birikir) karşı
somut ölçüt budur ve Faz 5'te test edilir: `src/orchestrator/` içinde
`retry`, `model`, `permission` kelimeleri geçmez (ADR-002 uygulama notu).

### 4.1 Paralel mi, sıralı mı

Ayrı bir "paralel" bayrağı **yoktur**; iki gösterim iki uygulama demektir
(AP2). Paralellik `depends_on`dan türetilir: bağımlılığı karşılanmış her adım
aynı anda hazır olur. Aynı alana yazan iki adım grafta yasaklıdır (§2), yani
paralel çalışabilen adımların çıktı alanları zaten ayrıktır.

Tek makine varsayımı ADR-002'nin kabul edilmiş bedelidir; eşzamanlılık tavanı
(kaç adım aynı anda) bir yürütücü ayarıdır, sözleşme alanı değil.

### 4.2 Checkpoint ve devam etme

Kayıt birimi ADR-003'ün kararı: **adım-sonucu tablosu**, `run_id + step_id +
attempt` anahtarıyla. Altı durum: `PLANLANDI`, `BASLADI`, `GIRDI_BEKLIYOR`,
`ONAY_BEKLIYOR`, `BITTI`, `BASARISIZ`.

- `BASLADI` **yan etkiden önce** yazılır. Bütçe duvarı bir ajan çağrısının
  ortasında vurursa (BILINEN-TUZAKLAR #7, beş görev) o çağrının dosya yazıp
  yazmadığı kayıttan okunur.
- Devam: `resumed_from` ile önceki koşu bağlanır; `BITTI` adımlar tekrar
  ödenmez.
- `side_effects_done`, onay sonrası tekrarı önleyen listedir: **onay kapısından
  geçen bir çağrı, kapıdan önce yapılmış hiçbir yan etkiyi tekrarlamaz**
  (ADR-003; LangGraph'ın `types.py:864` kusurunun çaresi).
- Bütçe: `budget.on_exceed` = `stop` ise yeni adım başlatılmaz ve kayıt
  kapatılır; `human-gate` ise görev `ONAY_BEKLIYOR`a düşer. Taşma hata değil,
  planlanmış faz geçişidir (D10).

### 4.3 Başarısızlık ve telafi

`step.on_failure`: `dur` | `devam` | `human-gate`. Retry iki moddur (D13):
`duzelt` (eleştiriyi girdi alarak) ve `temiz-sayfa` (bağlamı atıp baştan);
`duzelt` modunda `max_critique_items` **zorunludur** — sınırsız yansıma
belleği maliyeti tam da işler kötü giderken büyütür (AP11).

Yan etkili her adımda `compensation` zorunludur ve telafinin imkânsız hâli
`human-gate` sabitidir (kural 9). Şema başka bir değer kabul etmez.

---

## 5. Ajan-ajan iletişim kuralları

İ1 D6 bir boşluk tespit etmişti: *"araç sözleşmesi katı, ajan sözleşmesi
gevşek"* — yedi projenin hepsinde araçlar JSON şemasıyla tanımlı, ajanlar arası
devir serbest metin. `message.schema.json` bu boşluğu kapatmak için yazıldı
(ADR-000 K3). Beş kural, hepsi şemada zorlanır:

| # | Kural | Şemadaki karşılığı | Öz-test |
|---|---|---|---|
| İ1 | Ajan ajana doğrudan mesaj göndermez; her mesaj yürütücüden geçer (ADR-002) | `from.kind = agent` ⇒ `to.kind = orchestrator` | "ajandan ajana doğrudan mesaj reddedilmeli" |
| İ2 | Devir bir öneridir, çağrı değil (D5) | `kind = handoff` ⇒ `to.kind = orchestrator`, `reason` + `handoff_depth` zorunlu | "devirde gerekçe zorunlu" |
| İ3 | Devir zinciri sınırlıdır (İ1 Ö4) | `handoff_depth ≤ 3`, şemada sabit | "devir tavanı (3) aşılamaz" |
| İ4 | Eleştiri serbest metin değil, yapılandırılmış girdi alanıdır (D8) | `items[]` = `{id, severity, location, what, fix_hint}`, en çok 20, `truncated` zorunlu, ham kayıt `raw_ref`te durur (kural 12) | "eleştiri üst sınırı (20) aşılamaz" |
| İ5 | Hata türü makine-okurdur, metinden ayrıdır (D7) | `error_type` dokuz değerli enum + ayrı `error_message` | "hatada makine-okur tür zorunlu" |

Onay mesajlarında ADR-005 iki kuralı da şemadadır: kapsam boş olamaz (kural 7 —
"kapsam belirtilmemişse sonuç boş kümedir"), ve `severity` ile `reliability`
**ayrı alanlardır**; birleşik bir `risk_score` alanı tanımlı olmadığı için
yazılamaz (AP5'in mekanizması buydu). İnsanın kararı yalnızca `ALLOW` |
`BLOCK`'tur; `HUMAN_REQUIRED` bir Permission Manager çıktısıdır, insan cevabı
değil.

Mesaj taşıması (bellek içi çağrı mı, dosya mı, kuyruk mu) bu belgenin konusu
değil — sözleşme biçimi sabittir, taşıma Faz 4'ün kararıdır.

---

## 6. Konsensüs — ne zaman gerekir, ne zaman israf

**Karar: çoklu-ajan konsensüsü mimariye girmez.** K2'nin kanıt maddesi boş.
İ1 §7'nin kendi dürüstlük notu: *"Multi-agent konsensüs izin kapsamındaydı ama
incelenen yedi projede birinci sınıf bir konsensüs mekanizması bulunamadı"* —
ve bunun "ekosistemde yok" mu "yanlış yerde arandı" mı olduğu o notta açıkça
belirsiz bırakılmış. Kanıtsız bileşen mimariye girmez (ADR-000 K2).

Asıl gerekçe kanıt eksikliğinden daha güçlü: **oylama, deterministik bir
kaynağın yerine geçmez.** D3 bu ekosistemin en sağlam desenlerinden biri —
yargı deterministik kaynaktan gelir, LLM yalnızca eleştiri yazar. Aynı soruyu
üç LLM'e sorup çoğunluğa bakmak, üç bağımlı örneklemi bağımsız sanmaktır; hepsi
aynı yönde yanılabilir ve sonuç, olmayan bir güven üretir.

Karar kuralı — sırayla sorulur:

1. **Deterministik bir doğrulayıcı yazılabiliyor mu?** Yazılabiliyorsa
   konsensüs israftır: N kat maliyet, sıfır ek güvence. Bu makinede yazılmış üç
   araç (`arac/kanit-dogrula.js`, `arac/iz-izle.js`, `arac/matris-uret.js`)
   "öznel" sanılan çıktıların çoğunun deterministik denetlenebildiğinin kanıtı.
2. **Yazılamıyorsa?** Evaluator `DEGERLENDIRILMEDI` yazar ve iş insan kapısına
   düşer (ADR-004). `GECTI` sayılmaz. Şema bunu zorlar: `DEGERLENDIRILMEDI`
   olan kayıtta `approval_ref` zorunludur.
3. **İkinci bir görüş yine de isteniyorsa** bu konsensüs değil, `reviewer`
   rolüne bir devirdir — sonucu oy değil, `critique` mesajıdır ve nihai kararı
   yürütücü verir. Mevcut sözleşmelerle bugün yapılabilir; yeni mekanizma
   gerekmez.

**Ne olursa girer:** iki olgun projede birinci sınıf bir konsensüs mekanizması
bulunur ve deterministik doğrulayıcının yazılamadığı bir çıktı türünde ölçülmüş
kazanç gösterilirse. İ1 §7 AutoGen'i bütçe yüzünden hiç açmadığını yazıyor;
konuşma tabanlı orkestrasyon ve konsensüs desenleri için bakılacak ilk yer
orası — "Araştırma turu ve yol haritası yenileme" maddesinin işi.

---

## 7. Açık kalanlar ve temenniler

Bu belgenin **zorlayamadığı** üç şey; hiçbiri "çözüldü" diye yazılmadı:

1. **Eşzamanlılık tavanı ve zaman aşımı gerçekten uygulanır mı.** `timeout_s`
   sözleşmede var ama uygulayan yürütücüdür ve yürütücü henüz yazılmadı
   (Faz 5). Bugün bu bir alan, bir garanti değil.
2. **`writes` alanının dürüstlüğü.** Şema iki adımın aynı alana yazmasını
   engeller, ama bir adımın `writes`te yazmadığı bir yola yazmasını
   engelleyemez — bunu ancak Permission Manager'ın dosya kapsamı yakalar
   (Faz 3 "Security Architecture"). Bugün `writes` beyandır.
3. **Mesaj taşıması ve kalıcılığı.** Mesajların nerede saklandığı (bellek,
   JSONL, Observability izi) Faz 4'e ait. Şema biçimi sabitliyor, ömrü değil.

Faz 4'e devredilen: kayıt ortamının seçimi (SQLite mi JSONL mi — ADR-003 birimi
sabitledi, biçimi değil) ve `src/orchestrator/` klasör yapısı.

---

## 8. Dürüstlük

- **Bu belge yeni kanıt üretmedi.** Kaynağı beş ADR, blueprint ve Faz 2'nin üç
  belgesidir; bu turda hiçbir klona girilmedi, hiçbir `dosya:satır` yeniden
  doğrulanmadı. İki dış atıf (`multiagent/swarm.py:210-231`, `types.py:864`)
  sırasıyla İ1 özetinden ve ADR-003'ten alındı; güvenilirlikleri o
  katmanların denetim durumuna eşittir.
- **ADR-003'ten bir sapma var ve düzeltilmedi, yazıldı.** ADR-003 alan
  adlarını Türkçe önermişti (`calistirma_id`, `adim_id`, `durum`, `baslama`,
  `bitis`, `sonuc_ozeti`, `hata_turu`); şemada karşılıkları İngilizce yazıldı
  (`run_id`, `step_id`, `status`, `started_at`, `ended_at`, `result_summary`,
  `error_type`) çünkü `agent.schema.json` v2.0 baştan sona İngilizce alan adı
  kullanıyor ve iki dil bir şema ailesinde okunmaz hâle gelir. **Değerler**
  Türkçe kaldı (`BASLADI`, `ONAY_BEKLIYOR`, `SEMA_IHLALI`, `duzelt`,
  `temiz-sayfa`) — ADR-003'ün ve ADR-004'ün karar metinlerinde geçen adlar
  bunlar ve birebir korundu. Alan adı düzeyinde ADR-003'ün lafzına
  uyulmadı; ruhuna (birim, durum kümesi, iki yazma) uyuldu.
- **Örnek kapsaması eksik.** `contracts/ornek/mesaj/` altında beş mesaj türü
  var (`assignment`, `critique`, `handoff`, `approval_request`, `error`);
  `result` ve `approval_decision` türlerinin tam örneği **yok** — kuralları
  yalnızca öz-testteki bozma denemeleriyle sınanıyor. Görev sözleşmesinin tek
  örneği var ve o örnek bu turun kendisidir.
- **Zayıf halka.** §3'ün devir tavanı (3) tek kaynaktan geliyor (Strands,
  matriste olgunluk 4) ve sayının kendisi keyfî: kanıt "tavan olmalı" diyor,
  "üç olmalı" demiyor. Tavanı değiştirmek bir şema değişikliğidir ve bilinçli
  olarak öyle bırakıldı.
- **Doğrulama.** `node arac/sema-dogrula.js --test` → üç şema, sekiz örnek
  dosya geçerli; **38 bozma denemesinin 38'i de reddedildi** (12 ajan, 13
  görev, 10 mesaj, 3 graf çapraz kontrolü), çıkış kodu 0. Doğrulayıcıda bu
  turda üç eksik kapatıldı: `maxItems` desteklenmiyordu, dizi tip
  (`["number","null"]`) desteklenmiyordu ve **`allOf` dışındaki `if/then`
  sessizce yok sayılıyordu** — sonuncusu bu belgedeki kuralların bir kısmını
  görünmez biçimde uygulanmamış bırakabilirdi.
