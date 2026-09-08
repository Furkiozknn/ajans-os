# Yol haritası — ajans-os

Gece geliştirme döngüsünün yakıtı. `otomasyon\gelistirme-uret.ps1`
ilk işaretsiz maddeyi alır. **Sıra fazları zorlar:** bir sonraki fazın
maddesine, önceki fazın tüm maddeleri işaretlenmeden geçilmez. Bu
sıra ADR-000 K1'in kendisidir; bozma.

Her madde okunmadan önce: `docs/00-ARASTIRMA-PROTOKOLU.md` ve
`docs/adr/ADR-000-program-ve-ilkeler.md` okunur. Protokole uymayan
çıktı sentezde kullanılmaz.

**Devam edilebilirlik:** Bir madde bütçe yüzünden yarım kalırsa
kutucuk boş bırakılır, günlüğe "kaldığım yer" yazılır. Sonraki tur aynı
maddeyi alır; önce `docs/arastirma/<iz>/` altında zaten yazılmış
dosyalara bakar, incelenmiş projeyi **tekrar incelemez**, kaldığı
yerden sürer.

---

## Sırada

### Faz 1 — Araştırma (her iz bir madde)

### Faz 2 — Karşılaştırma

### Faz 3 — Mimari sentez


### Faz 4 — Tasarım

### Faz 5 — Uygulama

Maddelerin tamamı — girdi, iş, "bitti" ölçütü, kapsam dışı —
[`docs/04-UYGULAMA-YOL-HARITASI.md`](docs/04-UYGULAMA-YOL-HARITASI.md)
içindedir; aşağısı o belgenin sırasıdır. **Ortak bitti kapısı** (her madde
için geçerli): `node --test src/<modul>/`, `node arac/yapi-dogrula.js` ve
— ağ varsa — `npx -p typescript@5.6 tsc -p tsconfig.json`, üçü de 0.
U1–U12 arası sıra tavsiyedir, hepsi yalnızca U0'a bağlıdır; **U13 en sonda**
(12 modülü o çağırır), **U14 U13'ten sonra**.

- [ ] **U2 — `src/agent-registry/`** — yükleme, `dogrula`, `turet`.
      Bitti: iki örnek ajan geçiyor, eksik alanlı sözleşme reddediliyor,
      `turet` diske **yazmıyor**.
- [ ] **U3 — `src/tool-registry/`** — MCP şemasıyla argüman doğrulama.
      Bitti: izin sınıfı kayıttan okunuyor, araç **adından türetilmiyor**.
- [ ] **U4 — `src/permission-manager/`** — üç değerli karar, insan kapısı.
      Bitti: `BLOCK`/`HUMAN_REQUIRED` istisna değil belge döndürüyor;
      onay gelmeden ikinci çağrı yine `HUMAN_REQUIRED`.
- [ ] **U5 — `src/memory-manager/`** — katmanlı okuma/yazma.
      Bitti: `ALLOW` olmayan kararla `yaz` yazmıyor; geçersiz kılınan kayıt
      `oku`'dan dönmüyor.
- [ ] **U6 — `src/context-manager/`** — bütçe ve kısılma.
      Bitti: atılan parçaların sırası önceden yazılı sırayla birebir.
- [ ] **U7 — `src/model-router/`** — `sec` + `cagir`, taşıyıcı arkası.
      Bitti: `sec` testinde hiçbir sağlayıcı adı geçmiyor; `cagir` sahte
      taşıyıcıyla `usage` döndürüyor.
- [ ] **U8 — `src/cost-manager/`** — fiyat tablosu, eşik, adım tavanı.
      Bitti: bilinmeyen model → maliyet `null` + `bilinmeyen_cagri` sayacı;
      ondalık ayırıcı testi (tuzak #4).
- [ ] **U9 — `src/evaluator/`** — ADR-004 deterministik kapı.
      Bitti: aynı girdi 100 çağrıda aynı sonuç; LLM metni `Kanit` yerine
      geçemiyor.
- [ ] **U10 — `src/critic/`** — `elestir` → `message.schema.json`.
      Bitti: dönüş `string` değil şemaya uyan belge; eleştirinin geçme
      kararına oyu yok.
- [ ] **U11 — `src/recovery-manager/`** — dört mod, bekleme.
      Bitti: telafisi olmayan eylemden sonra daima `insan-kapisi`.
- [ ] **U12 — `src/observability/`** — span yazımı, tek yönlü.
      Bitti: yazma hatasında `span_yaz` istisna atmıyor, koşu düşmüyor;
      `arac/iz-izle.js` üretilen izi okuyor.
- [ ] **U13 — `src/orchestrator/`** — blueprint §3.2'nin 1–10 sırası,
      elle bağlanan bağımlılıklar. Bitti: 12 sahte bağımlılıkla çağrı sırası
      §3.2 ile birebir; `HUMAN_REQUIRED`'da koşu duruyor; `kosuyu_surdur`
      biten adımı tekrarlamıyor.
- [ ] **U14 — Uçtan uca kabul koşusu** — gerçek modüllerle tek görev
      (sahte olan yalnızca `ModelTasiyici`). Bitti: üretilen her belge
      `arac/sema-dogrula.js`'ten geçiyor; koşu ortasından öldürülüp
      sürdürüldüğünde yan etki tekrarlanmıyor.

### Sürekli

- [ ] **Araştırma turu ve yol haritası yenileme** — Bu maddeye
      gelindiğinde: ekosistemde son 30 günde çıkan kayda değer projeleri
      ve Claude Code / MCP / A2A'daki değişiklikleri tara; ADR'lerden
      birini çürüten bulgu varsa ilgili ADR'yi "yeniden açıldı"
      işaretle ve gerekçeyi yaz; yeni maddeleri ilgili fazın sonuna
      ekle; sonra bu maddeyi işaretle ve **aynısını en sona tekrar
      ekle**. Döngü böyle sürer.

---

## Bitti

<!-- Tamamlanan maddeler tarihiyle buraya taşınır -->

- [x] **U1 — `src/task-manager/`** — 2026-09-08. `src/task-manager/index.js`
      (ADR-003 iki yazma, durum makinesi, `sonraki_adim`) +
      `src/task-manager/index.test.js` (6 test) + `index.d.ts` imza
      güncellemesi. Süreç ölümü benzetimi **bellekteki nesneyi atıp kaydı
      diskten yeniden okumaktır**: `basladi_yaz`'dan sonra ölen koşuda
      `tamamlandi_mi` → `false` ve adım aynı `attempt` ile sürdürülür (yeni
      deneme açılmaz), `bitti_yaz`'dan sonra ölende → `true` ve ikinci
      `basladi_yaz` istisna atar. Yazmalar geçici dosya + `rename` ile
      atomik; yarım JSON diske düşerse iki yazmanın garantisi kalmazdı.
      Şema uyumu **iddia değil ölçüm**: `arac/sema-dogrula.js` bu turda
      `--dosya <yol> --sema <ad>` kipini kazandı ve test, ürettiği kaydı bu
      araca doğrulatıyor (bozuk kayıtla çıkış kodu 1 olduğu ayrıca sınandı).
      Şemanın gördüğü, `.d.ts`'in görmediği iki kural uygulamaya girdi:
      `BITTI` kaydı `evaluation_result` ister — verilmezse
      `DEGERLENDIRILMEDI` olur ve `approval_ref` zorunludur (D11: kontrol
      edilmedi ≠ temiz); `ONAY_BEKLIYOR` `approval_ref`siz yazılamaz.
      Doğrulama: `npm run kapi` (8 test + yapı kapısı) ve
      `node arac/sema-dogrula.js` temiz.

- [x] **U0 — Çalışma zamanı iskeleti ve test kapısı** — 2026-09-08.
      `package.json` (`"type": "module"`, `npm test` →
      `node --test src/**/*.test.js`), `arac/package.json`
      (`"type": "commonjs"`), [ADR-009](docs/adr/ADR-009-uygulama-dili.md),
      genişletilmiş `arac/yapi-dogrula.js`, `arac/yapi-dogrula-test.js`,
      `src/iskelet.test.js`. Dil kararı **Node ESM + `node:test`**: belirleyici
      ölçüt yine doğrulanabilirlik — U1–U14'ün "bitti" ölçütlerinin çoğu bir
      `arac/*.js` aracını **test içinden** çağırmayı gerektiriyor, ve kapı
      ancak ağsız/tek çalışma zamanında koşabiliyorsa kapıdır. TypeScript
      kaynak (S2) daha güçlü garanti verirdi ama `npx tsc` ağa bağlı: paket
      çekilemeyen bir turda test koşusu tamamen dururdu (AP3'ün gecikmeli
      hâli). Python (S3) tuzak #5 ve #6'ya giriyor. Kabul edilen bedel açıkça
      yazıldı: uygulama `.js`'i `tsconfig.json`'ın kapsamında değil, bu yüzden
      **her modül testi imzayı da sınamak zorunda**, yalnızca mutlu yolu
      değil. Tuzak: kök `"type": "module"` altı CommonJS aracı da kırardı —
      `arac/package.json` Node'un en yakın-package.json kuralıyla bunu tek
      dosyada çözdü, altı araç hiç değişmedi. ADR-008 sonuç kuralı 3
      (*"`src/` altında yalnızca `.d.ts`"*) ADR-009 ile yerini bıraktı;
      ADR-008'in kendi yeniden açılma koşulu (Python) **tetiklenmedi**.
      Doğrulama: `npm run kapi` → 0 — `npm test` 2/2 geçti, `yapi-dogrula`
      temiz, `yapi-dogrula-test` kasıtlı `.js` ihlalini yakaladı (çıkış kodu
      1, mesajda dosya adı + ADR-002) ve ağacı geri bıraktı. Ayrıca
      `npx -p typescript@5.6 tsc -p tsconfig.json` → 0,
      `node arac/sema-dogrula.js --test` → temiz. Sıfır test hâlinde de
      koşucunun 0 döndüğü ayrıca sınandı.

- [x] **Implementation Roadmap** — 2026-09-08.
      [`docs/04-UYGULAMA-YOL-HARITASI.md`](docs/04-UYGULAMA-YOL-HARITASI.md) +
      yukarıdaki Faz 5 bölümünün 15 maddesi (U0–U14). Maddeleştirme kuralı
      08 §7'den geldi: **her modül klasörü bir madde**, ölçüt uygulama +
      test. Üç sınır yazıldı: yeni modül klasörü açılmaz (14.'sü ADR-001'i
      yeniden açar), arayüz sessizce değişmez (AP3), import yönü kuralı
      uygulamada da geçerli — bu yüzden U0 `arac/yapi-dogrula.js`'yi `.js`
      dosyalarına genişletir. Taşıyıcı karar: **her maddenin "bitti"si mutlu
      yol değil, mimariden gelen kısıt** (iki yazma, üç değerli izin, `null`
      maliyet, `insan-kapisi`, span'in koşuyu düşürmemesi); yalnızca mutlu
      yolu sınayan test AP3'ü gizler. Bağımlılık: U1–U12 birbirini beklemez
      (hepsi `tipler.d.ts` + U0), yalnızca U13 ve U14 sıralıdır. Test
      koşucusu Node'un kendi `node:test`'i — ek paket yok (Node v24.19.0
      doğrulandı). Doğrulama: belgedeki 14 göreli bağlantının hepsi çözülüyor
      (dosya dosya kontrol edildi); `yapi-dogrula.js`'nin bugün yalnızca
      `index.d.ts` taradığı kaynaktan doğrulandı (satır 68).

- [x] **Repository / folder structure ve core interfaces** — 2026-09-08.
      [`docs/mimari/08-YAPI-VE-ARAYUZLER.md`](docs/mimari/08-YAPI-VE-ARAYUZLER.md) +
      `src/` iskeleti (13 modül klasörü + `src/tipler.d.ts`, yalnızca arayüz).
      Dil kararı [ADR-008](docs/adr/ADR-008-arayuz-dili.md): **TypeScript
      `.d.ts`** — ölçüt popülerlik değil doğrulanabilirlik (AP3); Python
      `Protocol` kapatılmadı, Faz 5 dil kararına ertelendi. Taşıyıcı karar:
      **mimari kural yorum değil imza olur** — `MemoryManager.yaz` zorunlu
      `IzinKarari` argümanı alır (AP9 → kural 10), `Evaluator` yalnızca
      `Kanit` tipini kabul eder (ADR-004), ADR-002'nin tek çağıran kuralı
      import kısıtına çevrildi (kardeş modülü yalnızca `orchestrator` tanır).
      Doğrulama: `npx -p typescript@5.6 tsc -p tsconfig.json` → 0 ve
      `node arac/yapi-dogrula.js` → temiz (13 modül, blueprint §2 ile eşli,
      import yönü tek).

- [x] **Self-improvement Architecture** — 2026-09-08.
      [`docs/mimari/07-KENDINI-GELISTIRME.md`](docs/mimari/07-KENDINI-GELISTIRME.md) +
      `contracts/proposal.schema.json` + üç örnek (`contracts/ornek/oneri/`).
      Yeni çalışan bileşen eklenmedi: blueprint §4.5 Learning Layer'ı
      çekirdeğin dışında bırakmıştı ve giriş koşulu (kapılı öneri üretiminin
      üretimde çalıştığı ikinci olgun örnek) İ6'da karşılanmadı. Taşıyıcı
      karar **D1: öneri üreteci kurulmaz, öneri *biçimi* kurulur** —
      `author.kind` bugün `insan`, ileride `uretec`; kayıt biçimi değişmez.
      **D2** öneri veridir, eylem değildir (İ6 AP3 / TextGrad
      `optimizer.py:186`); şemada uygulama fiili yoktur. **D4** önerilebilir
      hedefler kapalı listedir ve **kapının kendisi listede değildir** —
      AP1'in sessiz biçimi, kapıyı kaldıran bir öneri yazıp onaylatmaktır.
      **D6** geri alma değil **sürüm sabitleme** (kural 9): yapıtın kendisi
      geri sarılır, ürettiği dış etki telafi edilir. **D7** sürüklenme =
      onaylı bir öneriyle açıklanamayan sayaç hareketi; detektör gölge
      modda ve eşik kapısının kanıtı olamaz (kural 6). İ6'nın dört açık
      sorusundan ikisi kapandı (eşiği kim belirler → D5; `CLAUDE.md` ev
      sahibi yapılandırmasıdır, öneri hedefi değil → K8). Doğrulama:
      `node arac/sema-dogrula.js --test` temiz — sekiz çapraz kontrol,
      on beş öz-test; 11 blok alıntı ve 18 satır içi atıf kaynak
      dosyalarda birebir arandı.
- [x] **Observability Architecture** — 2026-09-08.
      [`docs/mimari/06-GOZLEM.md`](docs/mimari/06-GOZLEM.md) +
      `contracts/span.schema.json` + dört örnek (`contracts/ornek/gozlem/`).
      Yeni bileşen eklenmedi; blueprint §2.13'ün "tek yönlü dinleyici"
      satırının veri karşılığı yazıldı. Taşıyıcı karar **D1: iz türetilmiş
      bir gözlemdir, doğruluk kaynağı değildir** — ADR-003'ün adım-sonucu
      tablosu doğruluk kaynağı olarak kalır, bu yüzden *span yazımı
      başarısız olursa adım başarısız sayılmaz*; aksi hâlde gözlem katmanı
      izlediği sistemin arıza kaynağı olurdu. **D3** İ5'in en değerli
      bulgusunu doğrudan alıyor: token ve para muhasebesi **yalnızca tek
      modele ve tek çağrıya karşılık gelen sınırda** tutulur, ajan span'i
      model bilmez — OTel bunu dört kırıcı değişiklikle kendisi yaptı
      (`changelog.d/469.breaking.md`: ajan span'indeki cache kırılımları
      "misleading", tüketici bunları `gen_ai.inference.client` span'lerinden
      toplamalı). **D4** İ5 OZET §6'nın açık sorusunu kapatıyor: hiyerarşi
      açık `parent_span_id` alanıyla taşınır, OTel trace context varsayımına
      güvenilmez (`events.yaml:18` ilişkiyi context'e bırakmış). Para hiçbir
      standartta yok (`cost|price|usd|dollar` OTel'de sıfır sonuç), bu yüzden
      **D5/D6**: fiyat tablosu veridir, her maliyet kaydı tablonun `digest`ini
      taşır, bilinmeyen maliyet `null` ve **sebebi zorunludur** (üç değerli) —
      "bilmiyorum" kabul, sessiz bilmemek değil; **90 günden eski tablo
      `usd`'yi `null` yapar** (AP10'un mekanizması kataloğun eskimesi değil,
      eskidiğinin fark edilmemesi). Açık uçlu `usage.extra` bir **bekleme
      odasıdır**: iki bağımsız sağlayıcı aynı kavramı taşıyınca çekirdeğe
      terfi eder, etmezse altı ay sonra silinir (OTel'de cache token'ları
      tam olarak böyle terfi etti). 04-DEGERLENDIRME §8 ve 05-GUVENLIK §8'in
      ilan ettiği **sekiz sayaç** span karşılığına ve tüketicisine bağlandı;
      sayaç 6 (`HUMAN_REQUIRED` oranı) **bilerek yetkisiz** kaldı. Üç yerde
      bilinçli olarak span **yok** (adım kaydı, bellek okuması, Cost Manager)
      ve gerekçesi yazılı. Belgede §8'in sekiz çapraz kontrolünün sekizi de
      koda girdi — belgede yazıp makinede sınanmayan kural AP3'ün tanımıdır.
      Kapanmayan yedi yer §10'da: dışa aktarım katmanı yok, fiyat tablosu
      dosyası yok, 90 gün ve altı ay eşikleri **ölçülmedi** (sezgi), span
      hacmi/saklama kararı yok, benchmark seti yok, ve İ5 denetiminin iki
      OTel klonunu ayırt edememesi D3/D7'nin tazeleme alıntılarını zayıf
      bırakıyor — bu §0'da ve §11'de açıkça işaretlendi. Doğrulama:
      `node arac/sema-dogrula.js --test` → dört örnek 14/14 zorunlu alanla
      geçti, **14 bozma denemesinin 14'ü reddedildi**, çıkış kodu 0;
      `node arac/iz-izle.js docs/mimari/06-GOZLEM.md` → **28 alıntının 27'si
      BIREBIR**, 1 YAKIN, **YOK 0**. Doğrulayıcı `oneOf`'u bilmediği için
      şema onun desteklediği alt kümeye çekildi (araç genişletilmedi —
      bilmediği anahtarda sessizce geçmemesi kasıtlı bir özellik).

- [x] **Security Architecture** — 2026-09-08.
      [`docs/mimari/05-GUVENLIK.md`](docs/mimari/05-GUVENLIK.md) +
      [ADR-007](docs/adr/ADR-007-izin-surum-bagi.md) +
      `contracts/permission.schema.json` + dört örnek (`contracts/ornek/izin/`).
      ADR-005'in dört kuralı ve İ3 OZET §5'in beş önerisi işleyen hâle getirildi;
      yeni bileşen eklenmedi. Şemanın taşıyıcı kararları: **şiddet ile güvenilirlik
      ayrı eksen, tek `risk_score` alanı yok** (iki bağımsız sinyali tek sayıya
      ezmek AP5'in mekanizması); karar üç değerli `ALLOW`/`BLOCK`/`HUMAN_REQUIRED`
      ve **insanın kararı yalnızca iki değerli** — kapı kendi kendine onay veremez;
      denetleyici sonucu dört değerli (`gecti`/`kaldi`/`calistirilmadi`/`hata`) ve
      son ikisi "temiz" sayılmaz (D11); `shadow: true` ölçülmemiş detektörü gölge
      moda alır (kural 6). İnsan kapısının geçilemezliği **üç yerde** zorlanıyor:
      `additionalProperties: false` (`--yes-always` karşılığı bir alan uydurulamaz),
      `hard_limit.hit` → `decision` **const HUMAN_REQUIRED**, ve sabit sınır
      listesinin koddan okunması (yükleme yolu yoksa yükleme arızası da yok).
      Sır ajana ulaşmaz: `secret_injection` yalnızca ad + **tek** hedef taşır,
      **değer için şemada alan yoktur**; hedef `scope` içinde olmak zorunda.
      Hipervizör yolu kapalı olduğu için mekanizma **proxy süreç** seçildi (ayrı
      kullanıcı hesabı elendi) ve bunun kazayı önlediği ama kararlı saldırganı
      önlemediği §9'da yazıldı. **ADR-007** yol haritasının S7'sini kapatıyor:
      izin bileşenin **içerik özetine** bağlanır (`version` değil — sürüm beyandır,
      özet ölçümdür), `ALLOW` `binding`siz yazılamaz, süresiz izin modu yoktur,
      özet tutmazsa izin düşer ve `supersedes` ile yenisi yazılır. Kanıtı zayıf
      olduğu ADR'nin kendi K2 tablosunda yazılı: `02-EN-IYI-FIKIRLER.md` aynı fikri
      elemişti, karar K2'nin ikinci dalına (tuzak #12/#13 — karar anındaki dünya ile
      eylem anındaki dünya aynı değil) dayanıyor. Sandbox katmanları dört sıraya
      döküldü, **ikisi çalışıyor**; K3/K4 blueprint §4.4'teki gibi girmedi.
      Kapanmayan beş yer §9'da: sandbox yok, proxy süreç kararlı saldırganı
      önlemez, prompt enjeksiyonuna mimari savunma yok, `operation` sınıfını
      çağıran beyan ediyor (AP2 tam kapanmadı), mcp-vet yanlış pozitif oranı
      ölçülmedi. Doğrulama: `node arac/sema-dogrula.js --test` → dört izin örneği
      14/14 zorunlu alanla geçti, **15 bozma denemesinin 15'i reddedildi**, 5 çapraz
      kontrolün 5'i yakaladı, çıkış kodu 0; `node arac/iz-izle.js` belgede
      **16 alıntının 16'sı da BIREBIR** (YOK 0), ADR-007'de 3/3; 5 göreli bağlantı
      çözülüyor; tuzak #22 taraması belgenin kendi metnine dair yedi mutlak iddiayı
      `grep`ledi ve **bir yanlış beyan yakalandı** (sabit sınır listesinin
      "CLAUDE.md'yle birebir aynı" olduğu — CAPTCHA maddesi farklı; kaynak
      ADR-005/1 olarak düzeltildi).

- [x] **Evaluation Architecture** — 2026-09-08.
      [`docs/mimari/04-DEGERLENDIRME.md`](docs/mimari/04-DEGERLENDIRME.md).
      ADR-004'ün kararı işleyen hâle getirildi; yeni bileşen ya da yeni şema
      alanı eklenmedi, var olan alanlara anlam verildi. Üç karar: **`rubric`
      LLM puanlaması değil, her maddesi programla cevaplanan mekanik kontrol
      listesidir** (LLM puanı olarak okunsaydı ADR-004'te elenen S1 arka
      kapıdan geri gelirdi); **doğrulayıcı çıkış kodu sözleşmesi** 0/1/≥2 —
      üçüncüsü "doğrulayıcının kendisi bozuk" demek ve `KALDI` değil
      `DEGERLENDIRILMEDI` üretir (D11: çalışmayan denetleyicinin sessizliği
      ne "temiz" ne "kaldı"); **ağırlık bir ölçütü diğerine satamaz** —
      ağırlıklandırma yalnızca tek rubriğin içinde geçerli, ölçütler arası
      tek ağırlıklı ortalama yasak. `evaluation_criteria[].how`'ın dört değeri
      (`rubric`/`test`/`metric`/`human`) `evaluation.method`'un iki değerine
      bağlandı; `human` bir değerlendirme yolu değil, değerlendirmenin
      yokluğudur. Sekiz çıktı türü için hangi fonksiyonun neyle beslendiği
      tabloya döküldü ve **hangisinin doğrulayıcısı bugün var** ayrı sütun
      oldu. Benchmark seti kapının kendisini ölçer, ajanları değil: her çıktı
      türü için altın/mutant/ölçülemez üçlüsü, ve **üçlüsü yazılmayan
      doğrulayıcı kapıya bağlanmaz** (ölçülmemiş detektöre yetki = AP5);
      tohum `sema-dogrula.js --test` desenidir. Kapının kendisi dört sayaçla
      izlenir — ilki ADR-004'ün yeniden açılma koşulunu ölçer. Kapanmayan
      yer açıkça yazıldı: serbest düzyazının deterministik doğrulayıcısı yok,
      icat da edilmedi. Doğrulama: `sema-dogrula.js` temiz (8 örnek),
      `sema-dogrula.js --test` ve `kanit-dogrula-test.js` (11 geçti, 0 kaldı)
      yeşil, `iz-izle.js` belgede 0 YOK, sekiz göreli bağlantı çözülüyor,
      belgenin kendi metnine dair dört mutlak iddia `grep` ile doğrulandı
      (tuzak #22).

- [x] **Memory Architecture** — 2026-09-08.
      [`docs/mimari/03-BELLEK.md`](docs/mimari/03-BELLEK.md). Beş katman
      (`task`/`session`/`project`/`global`/`knowledge`) kim yazar–kim okur–ne
      kadar durur tablosuyla sabitlendi; enum zaten `agent.schema.json`'da
      duruyordu, bu belge ona anlam ve süre verdi. Üç karar: **yazma sınıfı
      yazanın kimliğinden değil hedef katmandan türer** (kimlikten türeseydi
      her ajan tipi için ikinci bir uygulama gerekirdi — AP2'nin tam kendisi),
      `project`/`global` yazımı **her zaman** `HUMAN_REQUIRED` (yani gece
      koşusunda hiçbir ajan kalıcı belleğe yazamaz, önerisi sabaha kalır —
      kural 10'un buradaki karşılığı); **append-only yasak**, çelişki
      `supersedes` ile geçersiz kılmayla çözülür ve okuma varsayılanı yalnızca
      geçerli kayıttır (İ2 Ö4'ün uyarısı: graphiti'de bile varsayılan filtresiz).
      İ2'nin beş açık sorusu da karara bağlandı: S1 graf **hayır** (blueprint
      §4.3 korundu, `knowledge` düz koleksiyon), S2 beş katman, **S3 PII =
      katman politikası** (yazma anında sınıflandırma değil: token+gecikme, ve
      yanlış pozitif belleği işe yaramaz kılar — AP5), S4/S6 **yaklaşık token
      sayımı** + Letta'nın %30 payı + `usage` ile kalibrasyon (kesin sayım
      sağlayıcı başına tokenizer = K3/K4 ihlali), S5 **senkron yazma** (adım
      sınırında, ADR-003'le aynı anda). Blueprint §6'nın S6'sı böylece kapandı.
      Bağlam yönetimi: LightRAG formülü + **önceden yazılmış kısılma sırası**
      (sistem sözleşmesi ve görev durumu kırpılmaz; ikisi tek başına bütçeyi
      doldurursa bu bir hata durumudur, sessizce küçültülmez), eşik %90, taşma
      = faz geçişi ve **ham kayıt yerinde kalır** (LightRAG'in AP6 hatası
      tekrarlanmaz). Kanıtsız tek bölüm §5: İ2'de 7/7 projede içerik düzeyinde
      PII mekanizması bulunamadı, tasarım sıfırdan yapıldı ve bu dürüstlük
      notunda yazıldı; kalibrasyon fikri de hiçbir projeden alınmadı, bizim
      eklememiz. Üç boşluk **düzeltilmedi, yazıldı** (§8): `memory_scope`
      bugün "yazma ⊂ okuma"yı, "`knowledge`'a yalnızca alım yazar"ı ve katman
      süresi tavanını zorlamıyor — üçü de Faz 4'te `memory.schema.json` ile
      birlikte kapanır. Doğrulama: `node arac/iz-izle.js docs/mimari/03-BELLEK.md`
      → **11 alıntının 11'i de BIREBIR** (YOK 0, çıkış kodu 0);
      `node arac/sema-dogrula.js --test` temiz; tuzak #22 taraması (belgenin
      kendi metni hakkındaki iddialar) `days-7`, `memory.schema.json`,
      Letta sabitleri, `_async_add_to_memory` ve eleştiri üst sınırı 20 için
      tek tek `grep`lendi, hepsi doğrulandı.

- [x] **Orchestration Architecture** — 2026-09-08.
      [`docs/mimari/02-ORKESTRASYON.md`](docs/mimari/02-ORKESTRASYON.md) +
      `contracts/task.schema.json` + `contracts/message.schema.json` + altı örnek
      (`contracts/ornek/gorev/`, `contracts/ornek/mesaj/`). Üç karar: **plan bir
      veridir** (`task.graph`) — planlayıcı çekirdek bileşen değil bir ajan
      rolüdür (blueprint §4.1 korundu), plan revizyonu üstüne yazmaz, yeni
      `run_id` açar (D5); **yönlendirme bir alandır** (`step.assign` statik,
      `handoff` mesajı dinamik) ve devir bir öneridir, çağrı değil — hedefi şema
      düzeyinde `orchestrator` olmak zorunda, tavanı 3 (İ1 Ö4, Strands
      `multiagent/swarm.py:210-231`); **konsensüs mimariye girmedi** — K2'nin
      kanıt maddesi boş (İ1 §7: yedi projede birinci sınıf mekanizma yok) ve
      asıl gerekçe daha güçlü: *oylama deterministik bir kaynağın yerine geçmez*
      (D3), üç bağımlı örneklemi bağımsız sanmak olmayan bir güven üretir.
      Yerine üç kademeli kural: deterministik doğrulayıcı ara → yoksa
      `DEGERLENDIRILMEDI` + insan kapısı (ADR-004) → ikinci görüş isteniyorsa o
      bir `critique` mesajıdır, oy değil. Paralellik `depends_on`dan türer, ayrı
      bayrak yok (AP2); iki adım aynı alana yazamaz ve bu artık **kontrol
      ediliyor** (`gorevCaprazKontrol`: DAG, tanımsız bağımlılık, çift yazma) —
      ADR-002'nin bu kararı bugüne kadar yalnızca metindeydi. İ1 D6'nın
      boşluğu (*araç sözleşmesi katı, ajan devri serbest metin*) beş kuralla
      kapatıldı: ajan-ajan doğrudan mesaj yasağı, devir tavanı, eleştiri üst
      sınırı 20 + `truncated` + ham kayıt (AP11), hata türü enum'u (D7), onay
      isteğinde kapsam boş olamaz ve şiddet/güvenilirlik ayrı eksen (ADR-005;
      birleşik risk skoru **tanımsız** olduğu için yazılamıyor). Doğrulayıcıda
      üç eksik kapatıldı — `maxItems`, dizi tip ve **`allOf` dışındaki `if/then`
      sessizce yok sayılıyordu**. Bilinçli sapma: ADR-003'ün Türkçe alan adları
      yerine İngilizce adlar (değerler Türkçe kaldı), gerekçesi belge §8'de.
      Doğrulama: `node arac/sema-dogrula.js --test` → 8 örnek geçerli, **38
      bozma denemesinin 38'i reddedildi**, çıkış kodu 0; `node arac/iz-izle.js`
      belgede 2 alıntının 2'sini de BIREBIR buldu; tuzak #22 taraması bir yanlış
      beyan yakaladı ve düzeltildi.


- [x] **Agent Architecture** — 2026-09-08. `docs/mimari/01-AJAN.md` +
      [ADR-006](docs/adr/ADR-006-ajan-sozlesmesi.md) + `agent.schema.json`
      **v2.0** + `contracts/ornek/` altında iki tam sözleşme +
      `arac/sema-dogrula.js` (bağımlılıksız doğrulayıcı, öz-testli).
      İ1'in S4 sorusu ("sözleşme ne kadar katı") karara bağlandı: **katı
      çekirdek, tek kaçış kapısı** (`additionalProperties: false` her yerde,
      ev sahibine özgü her şey yalnızca `x-host` altında; terfi bir şema
      değişikliğidir). Asıl bulgu şuydu: v1.0'ın eksiği alan eksikliği değil
      **zorlama** eksikliğiydi — `03-ANTI-PATTERNLER.md` §6'nın 12 kuralından
      ajan sözleşmesine düşen **beşi** (1, 7, 9, 10, 12) şemada yalnızca alan
      açıklamasında yazan bir temenniydi, yani AP3'ün ("beyan edilen garantinin
      kodda karşılığı yok") kendimize dönük hâli. v2.0 beşini de `if/then` ile
      şemaya gömdü: `risk: high` + `scope ≠ read` araçta `requires_human_approval`
      artık **const true** (`false` yazan sözleşme reddedilir); `rollback` alanı
      **kaldırılıp** `compensation { side_effects, method, on_impossible:
      "human-gate" }` geldi; bellek yazımı varsa `retention`, PII izni varsa
      `pii_basis`, `iterative` akışta `max_iterations`, retry'da
      `max_critique_items` zorunlu. Ayrıca `identity.status`
      (draft/active/deprecated/archived) + `supersedes` eklendi — arşivin
      makine-okur karşılığı yoktu (kanıtı en zayıf alan, dürüstlük notunda
      yazılı). Yaşam döngüsünün altı aşaması sahibi, okuduğu sözleşme alanları
      ve başarısızlık hâliyle yazıldı; §3.7'deki aşama × alan tablosu 17 zorunlu
      alanın hepsinin en az bir aşamada kullanıldığını gösteriyor. Türetmede iki
      gerçek boşluk çıktı ve düzeltilmeyip **yazıldı**: (B1) `kod-gozden-gecirici`
      bugün `Bash`'i kapısız kullanıyor, sözleşme kapıyı zorunlu kılınca ajan gece
      koşusunda `Bash` kullanamaz hâle geldi; (B2) Claude Code frontmatter'ı yazma
      kapsamını glob ile daraltamıyor, kapsam ev sahibi katmanında temenniye
      dönüşüyor. Doğrulama: `node arac/sema-dogrula.js --test` → iki örnek de
      17/17 zorunlu alanla geçti, **12 bozma denemesinin 12'si de reddedildi**,
      çıkış kodu 0.

- [x] **kanit-dogrula iyileştirmesi** — Üç denetimin (İ4, İ5, İ6
      `DENETIM.md`) tekrar eden dersleri araca insin: (1) çıplak dosya adı
      (`README.md:14`) önce depo kökünde aranır, iç içe kopya ancak kökte yoksa
      aday olur; (2) `…/dosya.py:N` gibi kısaltılmış yollar depo içinde ada göre
      aranır; (3) tek satırda birden çok `dosya:satır` varsa token'lar en yakın
      alıntıya bağlanır, hepsine değil; (4) `xxx.md:N` atıfları aynı iz
      klasöründeki kardeş belgede aranır; (5) izin "repo bölünmesi" notundaki
      ikinci klon köküne de bakılır. Her kural için DENETIM.md'lerdeki gerçek
      yanlış alarmdan bir regresyon testi (`arac/kanit-dogrula-test.js`);
      İ4–İ6 üzerinde yeniden koşup şüpheli sayısının düştüğünü tabloyla göster.
      *(2026-09-08 — v3.2: çıplak dosya adı kökte, kardeş belge atfı, depo adıyla başlayan yol, tek parçalı kısaltma, dar token penceresi; arac/kanit-dogrula-test.js 11 kontrol; ölçüm İ4 19→18, İ5 32→25, İ6 10→8, DOSYA-YOK 8→0)*

- [x] **Architecture Blueprint** — 2026-09-08. `docs/mimari/00-BLUEPRINT.md`
      + `docs/adr/ADR-001..005`. Yol haritasının saydığı **18 aday bileşenin
      13'ü** K2'nin dört maddesini yazabildi ve mimariye girdi (Orchestrator,
      Task Manager, Agent/Tool Registry, Permission Manager, Memory Manager,
      Context Manager, Evaluator, Critic, Recovery Manager, Model Router,
      Cost Manager, Observability); **5'i giremedi** ve her biri için hangi
      K2 maddesinin boş olduğu + "ne olursa girer" yazıldı: Planner (kanıt
      boş — ayrı planlayıcı bileşen için yinelenen desen yok; plan üretimi
      bir *ajan rolü* olarak tanımlandı), Router/görev→ajan (İ1 D5 tam
      tersini söylüyor: yönlendirme adım çıktısının bir alanı), Knowledge
      Layer (problem boş, 02 §4/A3), ayrı Guardrails motoru (maliyet+kanıt
      boş; sandbox bu makinede uygulanamaz → tek savunma Permission Manager,
      **bilinçli zayıflık** olarak kaydedildi), Learning Layer (İ6'nın K7
      sonucu: üretimde çalışan tek örnek yok → Faz 3 "Self-improvement
      Architecture" maddesine devredildi, çürütülmedi). İletişim modeli
      ADR-002 ile karara bağlandı: **tek yürütme döngüsü**, bileşenler
      birbirini çağırmaz, Observability tek yönlü dinleyici; olay veriyolu
      ve "workflow motoru üstüne ajan döngüsü" gerekçeleriyle elendi.
      02 §7'nin yedi açık sorusundan **beşi** karara bağlandı (S1–S5),
      ikisi (S6 tokenizer, S7 izin-sürüm bağı) yol haritasının kendi
      maddelerine bırakıldı — gerekçesi blueprint §6'da. Doğrulama:
      `node arac/iz-izle.js` altı belgede **21 alıntının 21'i de BIREBIR**
      (YOK 0, çıkış kodu 0); JSON şemaları parse edildi; 18 bileşenin
      hepsinin belgede geçtiği ve giren 13'ün her birinde K2 dört
      maddesinin dolu olduğu script'le sayıldı; yanlış çıkan tek beyan
      (kural 9 satırı) düzeltildi.

- [x] **Anti-patterns** — 2026-09-08. `docs/03-ANTI-PATTERNLER.md`.
      Giriş şartı iki dallı: ya **2+ bağımsız izde** aynı seçim, ya tek izde
      ama **3+ bağımsız projede**. Üstüne bir ayraç kondu ve asıl eleme onu
      yaptı: *anti-pattern bir seçimdir, olgunluk eksikliği değil* — üç
      projede tekrarlayan backoff'suz retry, kaynağın kendisi "olgunluk farkı,
      tasarım tercihi değil" dediği için elendi. **11 desen geçti, 8 aday
      elendi** (her biri için "ne olursa geçer" yazılı). En güçlüsü AP1 —
      insan kapısının bir yapılandırma değeri olması, **5 izde 9 kaynakta**
      (MCP'de SHOULD, Letta'da varsayılana bağlanmamış onay kuralı, Aider
      `--yes-always`, OpenHands `NeverConfirm`, İ4'te yedi projeden yalnızca
      birinde birinci sınıf kapı). AP8 "rollback" kelimesini mimariden
      çıkarıyor (beş projede telafi yok, hepsinde yalnızca durumu geri sarma);
      AP9 (bellek yolunda gizlilik kararı yok, 7/7 proje) ekosistemde aynası
      olmayan tek boşluk. Her AP'de K2'nin "maliyet" maddesinin karşılığı
      olarak **kaçınmanın maliyeti** de yazıldı. Faz 3 için 12 bağlayıcı
      kural çıkarıldı (§6). Doğrulama: 35 `dosya:satır` atıfı + 17 sembol
      alıntısı = 52 kontrol, `grep -rF` ile iz belgelerinde arandı, 52'si de
      bulundu; sıfır uydurma.
- [x] **Best ideas ve patterns** — 2026-09-08. `docs/02-EN-IYI-FIKIRLER.md`.
      Sıralama ölçütü "kaç projede" değil **"kaç bağımsız izde"**: tek izde
      altı proje aynı şeyi yapıyorsa o alanın kültürü olabilir, dört ayrı
      izde on iki proje yapıyorsa problemin şeklidir. **13 desen K2'yi geçti**
      (en güçlüsü D1 — ilerleme kaydı/checkpoint, 4 izde 12 projede),
      **7 aday elendi** ve her biri için "hangi K2 maddesi boş" + "ne olursa
      geçer" yazıldı. Elenenlerin ikisi iz özetlerinin doğrudan "alınmalı"
      dediği fikirlerdi: izin sürüme bağlanması (İ3 D3 — iki kaynaktan biri
      olgunluk 2, kanıt sayılamaz) ve otomatik kabul kapısı (İ6 Desen A —
      üçü de pre-1.0/donmuş). K2'nin ikinci dalı ("bizzat yaşadığımız arıza")
      ilk kez kullanıldı: "başladı" checkpoint'i ekosistemde sıfır örnekli
      ama `BILINEN-TUZAKLAR.md` #7/#13/#20 üçü de onun yokluğundan doğmuş.
      Doğrulama: JSON'lar parse edildi, 16 rastgele alıntı kaynak iz özetine
      geri izlendi, altı izin `DENETIM.md` kararı dosyadan (özet metninden
      değil) okundu.
- [x] **Architecture Comparison Matrix** — 2026-09-08. `node arac/matris-uret.js`
      altı iz özetinden `docs/01-matris.json` + `docs/01-KARSILASTIRMA-MATRISI.md`
      üretti: **40 proje, 6 iz, 0 ayrıştırma uyarısı**. Başlangıçta 5 uyarı vardı
      (i3/i5/i6 puan tablosu bulunamadı, i4 yanlış tablo, temporal satırı eşleşmedi)
      ve matrise yalnızca 20 proje giriyordu. Kaynak tablolar düzeltildi; araç
      puan sütunlarını artık ilk veri satırı tahminiyle değil sütun başlığıyla
      tanıyor. §6.4 yorumu (liderler / boşluklar / çelişkiler, hepsi kanıt
      bağlantılı) yazıldı, yeniden üretimde korunduğu doğrulandı.
- [x] **İ6 Otonom kodlama ve öğrenme araştırması** — Protokol İ6:
      otonom kodlama ajanları (OpenHands, SWE-agent, Aider, Cline,
      Claude Code'un alt-ajan modeli), self-learning / sürekli
      optimizasyon (DSPy, TextGrad). ADR-000 K7 için: insan kapısız
      kendini-değiştirmenin üretimde güvenle çalıştığı **tek bir** örnek
      var mı, açıkça ara ve yaz. Çıktı: `docs/arastirma/i6-kodlama-ogrenme/`.
      **Bitti (2026-09-08):** 5 analiz dosyası / 7 proje (OpenHands, DGM,
      OpenEvolve, SWE-agent, Aider, TextGrad, GEPA) + `OZET.md` + `DURUM.md`.
      K7 sorusunun cevabı: **böyle tek bir örnek bulunamadı** — kendi kodunu
      insan kapısız değiştiren tek aday DGM, canlılık ve üretim testini
      kaybediyor. Cline ve resmî `DENETIM.md` sonraki tura kaldı.

- [x] **İ5 Gözlem ve ekonomi araştırması** — Protokol İ5: tracing
      (OpenTelemetry GenAI kuralları birincil kaynak), değerlendirme ve
      benchmark araçları, maliyet/gecikme optimizasyonu, model
      yönlendirme, üretim dağıtımı. Kullanıcının
      `model-comparison-harness` ve `nvidia-nim-mcp` fallback zinciri
      adaylar arasında. ADR-000 K4 model sınırı için kanıt topla. Çıktı:
      `docs/arastirma/i5-gozlem-ekonomi/`.
      **Bitti (2026-09-08):** 6 proje analizi, `OZET.md` ve OTel
      v1.42+ tazelemesi yazildi. Resmi `DENETIM.md` ayri kosuda yazilacak.

- [x] **İ1 Orkestrasyon ve planlama araştırması** — Protokoldeki İ1
      izini uygula: multi-agent orchestration, routing, dinamik
      planlama, DAG/workflow, ajan-ajan iletişimi, uzman mimariler,
      konsensüs. 6–10 canlı proje; tohum listesi + en az iki listede
      olmayan aday. Her proje için `docs/arastirma/i1-orkestrasyon/<repo>.md`
      (şablon: protokol §3), sonra `OZET.md` (§4). Kullanıcının
      `ai-workflow-engine` deposu adaylardan biri — kayırmadan.
      Bitti sayılması için: en az 6 proje dosyası + OZET.md + her
      projede "Alınacak / Alınmayacak" dolu.
Tamamlandı: 2026-09-07 — 7 proje dosyası + OZET.md yazıldı.

- [x] **İ2 Bellek ve bağlam araştırması** — Protokol İ2: bellek
      katmanları, uzun süreli bellek, bağlam yönetimi, RAG, bilgi
      katmanı. Özellikle şuna bak: bellek yazma kimin yetkisinde, PII
      nasıl ele alınıyor, bağlam penceresi dolunca ne oluyor. Çıktı:
      `docs/arastirma/i2-bellek/`. Aynı bitti ölçütü.

Tamamlandı: 2026-09-07 — 7 proje dosyası + OZET.md yazıldı (letta, mem0,
graphiti, cognee, graphrag, llamaindex, LightRAG).

- [x] **İ3 Araçlar ve güvenlik sınırı araştırması** — Protokol İ3:
      MCP ve A2A spesifikasyonlarını **birincil kaynaktan** oku (repo
      README değil, spec belgesi), araç izin modelleri, sandboxing
      (E2B/Daytona), guardrails, ajan kimliği/güven, insan-onay
      kapıları. Kullanıcının `mcp-vet` aracı adaylardan biri. ADR-000
      K6'yı çürüten veya güçlendiren kanıtı açıkça ara. Çıktı:
      `docs/arastirma/i3-arac-guvenlik/`.

Tamamlandı: 2026-09-07 — 7 kaynak dosyası + OZET.md yazıldı (mcp-spec,
a2a-spec, e2b, microsandbox, llamafirewall, mcp-scan, mcp-vet). ADR-000 K6:
çürüten kanıt bulunamadı, güçlendi; eksik bir madde Faz 3'e not düşüldü.

- [x] **İ4 Güvenilirlik araştırması** — Protokol İ4: değerlendirici /
      eleştirmen / gözden geçirici ajanlar, reflection & self-correction,
      arıza tespiti, retry / fallback / checkpoint / rollback. Özellikle:
      checkpoint durum modeli nasıl (immutable snapshot mı, event log
      mu), rollback gerçekten geri alıyor mu yoksa "yeniden dene" mi.
      Çıktı: `docs/arastirma/i4-guvenilirlik/`.

Tamamlandı: 2026-09-08 — 7 proje dosyası + OZET.md yazıldı (langgraph,
temporal, dbos-transact-py, dspy, instructor, portkey-gateway, reflexion).
Ana bulgu: durum modeli üç yola ayrılıyor (tam snapshot / event log+replay /
adım-sonucu tablosu) ve rollback yedi projenin hiçbirinde gerçek değil —
hepsinde "durumu geri sar + yeniden dene", dünyayı geri alma değil. En güçlü
yinelenen desen: yargı deterministik kaynaktan gelir, LLM yalnızca eleştiri
yazar. İnsan kapısı yedi projeden yalnızca birinde birinci sınıf. Otomatik
kanıt doğrulaması %93; elle DENETIM.md protokol §4 gereği ayrı koşuda yazılacak.
