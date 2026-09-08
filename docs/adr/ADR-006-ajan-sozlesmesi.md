# ADR-006 — Ajan sözleşmesi: katılık derecesi ve v2.0 alanları

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ1 (birincil — S4 sözleşme katılığı sorusu buradan geldi), İ3, İ4, İ6
**Yeniden açılma koşulu:** Katı sözleşmenin yeni ajan ekleme maliyetini ölçülebilir
biçimde bloke etmesi (bir ajanın sözleşmesini yazmak, ajanı yazmaktan uzun sürerse);
veya bir ev sahibinin `x-host` ile ifade edilemeyen bir zorunlu alan istemesi.

## Bağlam

`docs/mimari/00-BLUEPRINT.md` §6 son paragrafı İ1'in S4 sorusunu bu maddeye
havale etti: **sözleşme ne kadar katı olmalı?** Soru boş değil — ADR-000 K3
sözleşmeyi zorunlu kılıyor ama katılık derecesini yazmıyor, ve
`contracts/agent.schema.json` v1.0 bu soruyu sormadan yazılmıştı.

İkinci girdi Faz 2'nin bağlayıcı kurallarıdır. `docs/03-ANTI-PATTERNLER.md` §6'nın
12 kuralından **beşi** doğrudan ajan sözleşmesinin alanlarına düşüyor (1, 7, 9, 10,
12) ve v1.0 şeması bunların hiçbirini şema düzeyinde zorlamıyordu: hepsi alan
açıklamasında yazılı bir temenniydi. `docs/03-ANTI-PATTERNLER.md` AP3'ün tanımı
tam olarak budur — beyan edilen garantinin kodda (burada: şemada) karşılığı yok.

Üçüncü girdi somut: `turkce-ajanlar/agents/kod-gozden-gecirici.md` bu depoda
çalışan gerçek bir ajan ve v1.0 sözleşmesine çevrildiğinde iki yerde boşluğa
düşüyor (§Sonuçlar).

## Seçenekler

### S1 — Gevşek sözleşme: az zorunlu alan, `additionalProperties: true`

- Nasıl çalışır: sözleşme bir "öneri şeması"dır; ajanlar eksik alanla da kayıt
  defterine girer, eksikler çalışma anında varsayılanla doldurulur.
- Kanıt: ekosistemin çoğunluğu böyle — ajan bir prompt dosyası, makine-okur
  alanlar en fazla ad/model/araç listesi (`docs/01-KARSILASTIRMA-MATRISI.md`
  genişletilebilirlik sütununun yüksek puanlıları bu yüzden yüksek).
- Artı: yeni ajan eklemek beş satır. Deneme maliyeti sıfıra yakın.
- Eksi: kural 1, 7, 9, 10 ve 12'nin hiçbiri zorlanamaz; her biri gözden
  geçirenin dikkatine kalır. AP1'in ekosistemdeki yaygınlığının sebebi bu.
- Maliyet: karmaşıklık düşük, bakım yüksek — zorlanmayan her kural zamanla
  ihlal edilir ve ihlal ancak arıza anında görünür.

### S2 — Katı çekirdek + tek kaçış kapısı (`x-host`)

- Nasıl çalışır: her nesne `additionalProperties: false`; 17 alan zorunlu;
  bağlayıcı kurallar `if/then` ile şemaya gömülü. Ev sahibine özgü her şey tek
  bir yerde, `x-host` altında, ve çekirdek orayı **okumaz** (ADR-000 K8).
- Kanıt: İ1 D6 — 7/7 projede araç sözleşmesi zaten katı ve şemalı; katılığın
  genişletilebilirliği öldürmediği ölçülmüş yer burası. İ3: MCP ve A2A
  spesifikasyonlarının ikisi de katı şema + adlandırılmış uzantı alanı modeli.
- Artı: sözleşmesi geçen ajan, beş bağlayıcı kuralı **yapısal olarak** karşılar;
  gözden geçirenin dikkatine bırakılmaz.
- Eksi: yeni ajan eklemek 150 satır JSON. Şema değişikliği tüm sözleşmeleri
  kırar (bu ADR'nin kendisi bunu yapıyor: v1.0 → v2.0).
- Maliyet: her ajan için bir kez ödenen yazma maliyeti + sürüm geçişlerinde
  toplu güncelleme.

### S3 — Katı çekirdek + serbest `x-*` uzantı alanları

- Nasıl çalışır: S2 gibi, ama `x-` önekli her alan serbest — ev sahibi, deney,
  profil, ne gerekiyorsa.
- Kanıt: JSON Schema ve OpenAPI geleneği; `docs/mimari/00-BLUEPRINT.md` §2.11
  Model Router için "açık uçlu usage/cost sözlüğü — kalıcı çöp kutusu değil,
  çekirdeğe terfi bekleme odası" diyerek bu modelin bir örneğini zaten kabul etti.
- Artı: esneklik, kırmadan deneme.
- Eksi: "bekleme odası" pratikte çöp kutusuna dönüşür ve iki ajan aynı bilgiyi
  farklı `x-` alanında taşımaya başlar; AP2'nin (aynı kararın ikinci uygulaması)
  veri düzeyindeki hâli.
- Maliyet: düşük görünür, terfi disiplini yazılmazsa yüksek çıkar.

## Karar

**S2 — katı çekirdek, tek kaçış kapısı.**

Ölçüt kural 4'tür: *garanti cümlesi kodun sağladığından fazlasını söylemez.*
ADR-000 K3 "sözleşmesi olmayan ajan test edilemez, yönlendirilemez,
değerlendirilemez" diyor; bu cümlenin karşılığı ancak şema alanları zorunluysa
vardır. S1 bu cümleyi temenniye çevirir. S3, S2'den yalnızca `x-` önekinin
serbestliğiyle ayrılır ve o serbestlik bugün karşılığı olmayan bir esnekliktir —
tek gerçek ihtiyaç ev sahibi eşlemesidir ve onun adı bellidir (`x-host`).
İkinci bir uzantı alanı gerektiğinde bu ADR yeniden açılır, o zamana kadar
açılmaz.

**Terfi kuralı (S3'ün alınan tarafı):** `x-host` altındaki bir bilginin
çekirdeğe terfi etmesi bir şema değişikliğidir, sessiz bir alan eklemesi değil.

### v2.0'da değişen alanlar

Her satır bir bağlayıcı kurala bağlıdır; kuralsız alan eklenmedi.

| Alan | Değişiklik | Gerekçe |
|---|---|---|
| `contract_version` | `"1.0"` → `"2.0"` | Aşağıdaki değişiklikler uyumsuz. (Sonraki adım `"2.1"`: zorunlu `triggers`, [ADR-010](ADR-010-tetikleyici-ifade.md).) |
| `identity.status` | **yeni, zorunlu** (`draft`/`active`/`deprecated`/`archived`) + `supersedes` | Yaşam döngüsünün arşiv ucu makine-okur olmalı; kayıt defteri durumu türetmez, sözleşmeden okur. |
| `tools[]` | `risk: high` + `scope ≠ read` ise `requires_human_approval: true` **şema ile zorunlu** | Kural 1 / AP1: kapı bir yapılandırma değeri olamaz. `false` yazılamaz — şema reddeder. |
| `permissions.filesystem.read/write` | `default: []` ve açıklama netleşti | Kural 7 / AP6: kapsam belirtilmemişse sonuç boş kümedir, "hepsi" değil. |
| `recovery_strategy.rollback` | **kaldırıldı** → `compensation { side_effects, method, on_impossible }` | Kural 9 / AP8: geri alma diye bir alan yoktur. Yan etkisi olan ajanda telafi yöntemi ve telafisizlik hâlinde `human-gate` zorunlu. |
| `recovery_strategy.retry.max_critique_items` | **yeni**, `max_attempts ≥ 1` ise zorunlu | Kural 12 / AP11: yansıma belleği sınırlıdır. `docs/mimari/00-BLUEPRINT.md` §2.9 "üst sınır sözleşmede zorunlu" diyordu; v1.0'da alan yoktu. |
| `memory_scope.retention` | `write` boş değilse **zorunlu** | Kural 10 / AP9: saklama süresi tanımsız bellek katmanı yazılamaz. |
| `memory_scope.pii_basis` | **yeni**, `pii_allowed: true` ise zorunlu | AP9: bellek yolunda gizlilik kararı hiç verilmiyor (İ2'de 7/7 proje). Gerekçesiz PII izni verilemez. |
| `workflow.max_iterations` | `mode: iterative` ise **zorunlu**, üst sınır 50 | Kural 12: üst sınırı olmayan döngü yazılamaz. |

## Dahil etme ölçütü (ADR-000 K2)

Bu ADR bir bileşen eklemiyor, mevcut bir sözleşmenin katılığını karara bağlıyor.
Ölçüt yine de dolduruldu:

| | |
|---|---|
| Çözdüğü problem | Beş bağlayıcı kuralın (1, 7, 9, 10, 12) yazılı olup zorlanmaması; ve ajan yaşam döngüsünün arşiv ucunun makine-okur karşılığının olmaması. |
| Önlediği hata sınıfı | *Zorlanmayan garanti* (AP3) — sözleşme "insan kapısı var" der ama `requires_human_approval: false` yazan bir ajan kayıt defterine girer. |
| Eklediği maliyet | Yeni ajan yazmak ~150 satır JSON; şema sürümü artınca tüm sözleşmelerin toplu güncellenmesi; koşullu (`if/then`) kuralların doğrulayıcıda desteklenmesi. |
| Kanıt | İ1 D6 (7/7 projede araç sözleşmesi katı ve şemalı) + İ3 (MCP, A2A: katı şema + adlandırılmış uzantı) + kendi arızamız: `BILINEN-TUZAKLAR.md` #22, belgeye yazılı garantinin metinde karşılığının olmaması. |

## Sonuçlar

**Olumlu:** Sözleşmesi geçen ajan beş bağlayıcı kuralı yapısal olarak karşılar.
Doğrulama bir gözden geçirme işi olmaktan çıkıp `node arac/sema-dogrula.js`
çıkış koduna indi.

**Olumsuz / kabul edilen bedel:** Ajan yazmak pahalılaştı. Şema değişikliği
kırıcıdır ve toplu güncelleme gerektirir.

**Türetmede çıkan iki boşluk** (`docs/mimari/01-AJAN.md` §6'da ayrıntısı):

1. `turkce-ajanlar`'ın `kod-gozden-gecirici` ajanı `Bash`'i kapısız kullanıyor.
   Sözleşmeye çevrilince `scope: execute` + `risk: high` çıktı ve şema kapıyı
   zorunlu kıldı. **Kabul edilen sonuç:** bu ajan gece koşusunda `Bash`
   kullanamaz; kullanması gerekirse `ONAY_BEKLIYOR` durumuna düşer. Alternatif
   (yalnızca `npm view`/`curl` çalıştıran dar bir araç tanımlayıp `risk: low`
   yapmak) Faz 4'ün Tool Registry maddesine bırakıldı.
2. Ev sahibi biçimi yazma kapsamını glob ile daraltamıyor. Claude Code
   frontmatter'ı `tools: ["Write"]` der, "yalnızca şu dosyaya" diyemez.
   `permissions.filesystem.write` sözleşmede kalır ve dışa aktarıcı bunu ajan
   metnindeki sınır cümlesine çevirir — yani **kapsam ev sahibinde zayıflar**.
   K8'in bilinen kayıp bilgi noktasıdır; Permission Manager kendi katmanında
   uygular.

**Etkilenen sözleşmeler:** `contracts/agent.schema.json` (v1.0 → v2.0).
`contracts/task.schema.json` ve `contracts/message.schema.json` henüz yok;
yazıldıklarında aynı katılık kararı geçerlidir.

**Etkilenen diğer ADR'ler:** ADR-005 (izin sınırı) — `tools[]` koşulu ADR-005'in
"sabit sınırlar config'ten okunmaz" kararının şema düzeyindeki karşılığıdır,
onu değiştirmez. ADR-004 — `evaluation_criteria.how` alanı `DEGERLENDIRILMEDI`
üçüncü değerini taşımaz; o değer değerlendirme *sonucunun* alanıdır, sözleşmenin
değil.

## Uygulama notu

Faz 5'te Agent Registry, kayıt anında `arac/sema-dogrula.js` ile aynı kuralları
uygular ve geçmeyen sözleşmeyi **kaydetmez** (`draft` bile yapmaz).

Test edilebilir ölçüt: `node arac/sema-dogrula.js --test` çıkış kodu 0 verirse
karar uygulanmıştır. Öz-test, kurallardan her birini ihlal eden bozuk bir
sözleşmenin **reddedildiğini** gösterir; doğrulayıcının sessizce geçmesi
buradan yakalanır.
