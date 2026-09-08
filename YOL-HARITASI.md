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

- [ ] **Evaluation Architecture** — Evaluator vs Critic ayrımı, rubrik/
      test/metrik/insan ölçütleri, hangi çıktı ne zaman hangi yolla
      değerlendirilir, geçme eşikleri, benchmark seti. Çıktı:
      `docs/mimari/04-DEGERLENDIRME.md`.

- [ ] **Security Architecture** — Permission Manager tasarımı, en az
      yetki, sandbox katmanları, insan kapısı kuralları (hangi işlemler,
      geçilemez), ajan kimliği, hata sınırları/izolasyon.
      `contracts/permission.schema.json`. **İ3 girdileri zorunlu okuma:**
      OZET §5 (şema alanları: şiddet ve güvenilirlik ayrı eksen,
      `ALLOW/BLOCK/HUMAN_REQUIRED`, "kontrol edilmedi" ≠ "temiz", onay kapsamı;
      kimlik bilgisi ajana ulaşmaz; denetleyici hatası güvenli tarafa düşer)
      ve §6 **K6'ya aday ek madde:** verilen izin bileşenin sürümüne/içerik
      özetine bağlanır, bileşen değişirse izin düşer — bu maddede ADR olarak
      karara bağlanır. Çıktı:
      `docs/mimari/05-GUVENLIK.md`.

- [ ] **Observability Architecture** — İz (trace) modeli (OTel GenAI
      uyumlu), hangi olaylar kaydedilir, maliyet/gecikme sayaçları, iz
      → değerlendirme → öğrenme akışının veri sözleşmesi. Çıktı:
      `docs/mimari/06-GOZLEM.md`.

- [ ] **Self-improvement Architecture** — ADR-000 K7 çerçevesinde:
      izlerden öneri üretme, öneri sözleşmesi, insan onay akışı,
      sürümleme ve geri alma, "sürüklenme" tespiti. Çıktı:
      `docs/mimari/07-KENDINI-GELISTIRME.md`.

### Faz 4 — Tasarım

- [ ] **Repository / folder structure ve core interfaces** — Faz 3'ten
      türeyen klasör yapısı; her çekirdek bileşen için arayüz tanımı
      (TypeScript `.d.ts` veya Python Protocol — dil kararı ADR ile).
      Modüller birbirinden bağımsız, her biri tek başına test edilebilir.
      Çıktı: `docs/mimari/08-YAPI-VE-ARAYUZLER.md` + `src/` iskeleti
      (yalnızca arayüzler, uygulama yok).

- [ ] **Implementation Roadmap** — Faz 5 için sıralı, birbirinden
      bağımsız modül maddeleri; her biri tek gece görevi büyüklüğünde,
      "bitti" ölçütü test. Bu maddeler **bu dosyanın Faz 5 bölümüne**
      yazılır. Çıktı: `docs/04-UYGULAMA-YOL-HARITASI.md` + aşağıdaki
      Faz 5 bölümünün doldurulması.

### Faz 5 — Uygulama

<!-- Faz 4'ün son maddesi burayı doldurur. Öncesinde buraya madde yazılmaz. -->

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
