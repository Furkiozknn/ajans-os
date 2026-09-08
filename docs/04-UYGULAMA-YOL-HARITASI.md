# 04 — Uygulama yol haritası (Faz 5)

**Tarih:** 2026-09-08 · **Faz:** 4 (tasarım), son madde · **Girdi:**
[`docs/mimari/08-YAPI-VE-ARAYUZLER.md`](mimari/08-YAPI-VE-ARAYUZLER.md) (13 modül,
import yönü, §7 sıra kısıtı), [`00-BLUEPRINT.md`](mimari/00-BLUEPRINT.md) §2–§3,
[`ADR-001`](adr/ADR-001-bilesen-kumesi.md), [`ADR-002`](adr/ADR-002-yurutme-ve-iletisim.md),
[`ADR-008`](adr/ADR-008-arayuz-dili.md), [`03-ANTI-PATTERNLER.md`](03-ANTI-PATTERNLER.md).

Bu belge Faz 5'i **maddeye** çevirir. Kod yazmaz; her maddenin ne olduğunu,
neyin üstüne oturduğunu ve **hangi komut 0 dönerse bittiğini** yazar. Maddeler
`YOL-HARITASI.md`'nin Faz 5 bölümüne aynı sırayla kopyalanır; gece döngüsü
oradan tek tek alır.

---

## 1. Maddeleştirme kuralı

08 §7 kuralı aynen geçerli: **her modül klasörü bir madde**, "bitti" ölçütü o
modülün arayüzünü karşılayan bir uygulama **artı** testtir. Buna iki madde
eklenir: en başta çalışma zamanı iskeleti (U0), en sonda uçtan uca kabul
koşusu (U14). Toplam **15 madde**.

Üç sınır, hepsi mevcut kararlardan gelir:

1. **Yeni modül klasörü açılmaz.** `src/` altında 13 klasör vardır; on
   dördüncüsü ADR-001'i yeniden açmayı gerektirir (08 §1). Bir madde
   "buraya küçük bir yardımcı modül lazım" diyorsa yardımcı, ait olduğu
   modülün klasörüne veya `arac/` altına girer.
2. **Arayüz değişmez, uygulanır.** Bir madde `index.d.ts`'yi değiştirmek
   zorunda kalıyorsa bu bir bulgudur: değişiklik yapılır **ve** gerekçesi
   günlüğe yazılır; imza değişikliği 08'in ilgili satırına da işlenir.
   Sessiz imza kayması AP3'ün ta kendisidir.
3. **Bağımlılık yönü kodda da tek yön.** `../<kardeş-modül>` import'u
   yalnızca `orchestrator` içinde geçer — bu kural bugün yalnızca `.d.ts`
   dosyalarında denetleniyor; U0 denetimi `.js` dosyalarına genişletir.

---

## 2. Sıra ve bağımlılık

Sıra 08 §7'den türer: hiçbir madde kendisinden sonra gelen bir maddeyi
gerektirmez. `src/tipler.d.ts` zaten yazılı olduğu için her madde yalnızca
ondan ve U0'dan beslenir; **modüller birbirini beklemez.**

```
U0  çalışma zamanı iskeleti  ─┬─ U1  task-manager
                              ├─ U2  agent-registry
                              ├─ U3  tool-registry
                              ├─ U4  permission-manager
                              ├─ U5  memory-manager      (U4'ün tipini kullanır,
                              │                           uygulamasını değil)
                              ├─ U6  context-manager
                              ├─ U7  model-router
                              ├─ U8  cost-manager
                              ├─ U9  evaluator
                              ├─ U10 critic
                              ├─ U11 recovery-manager
                              └─ U12 observability
                                        │
                                 U13 orchestrator  (12 modülün tamamını çağırır)
                                        │
                                 U14 uçtan uca kabul koşusu
```

U1–U12 arası sıra **tavsiyedir**, kısıt değil: hepsi yalnızca U0'a bağlıdır ve
istenen sırayla alınabilir. Kısıt olan iki yer: **U13 en sonda** (12 modülün
tamamını çağırır) ve **U14 U13'ten sonra**.

---

## 3. Ortak "bitti" ölçütü

Bir madde ancak şu üç komut da 0 dönerse işaretlenir:

```
node --test src/<modul>/              # maddenin kendi testleri
node arac/yapi-dogrula.js             # yapı + import yönü hâlâ temiz
npx -p typescript@5.6 tsc -p tsconfig.json   # arayüzler tutarlı (ağ varsa)
```

`tsc` `npx` ile indirildiği için çevrimdışı turda çalışmaz; o durumda
atlanır ve **atlandığı günlüğe yazılır** (08 §5'teki kural aynen sürer).

**Test kuralları** — hepsi bağımlılık eklememek içindir:

- Test koşucusu Node'un kendi `node:test` modülüdür (bu makinede Node
  v24.19.0; ek paket yok). Test dosyası modülün yanında: `src/<modul>/index.test.js`.
- Testler **ağa çıkmaz, gerçek LLM çağırmaz.** Model çağrısı gereken her
  yerde sahte `ModelTasiyici` kullanılır (08 §3, 2.11: sağlayıcıya özel her
  şey taşıyıcının arkasındadır — sahtelemenin ucuz olması bu kararın karşılığı).
- Diske yazan modüller (`task-manager`, `memory-manager`, `observability`)
  testte `os.tmpdir()` altında geçici klasör kullanır ve sonunda temizler;
  depo içine test çıktısı bırakılmaz.
- Her testin **en az bir tanesi mimariden gelen kısıtı** sınar, mutlu yolu
  değil: iki yazma sırası, üç değerli izin kararı, `null` maliyet gibi. Yalnızca
  mutlu yol sınayan test AP3'ü gizler.

---

## 4. Maddeler

Her madde şu biçimdedir: **girdi** (hangi arayüz + hangi mimari belge), **iş**,
**bitti ölçütü** (§3'ün üstüne o maddeye özel test), **kapsam dışı**.

### U0 — Çalışma zamanı iskeleti ve test kapısı

- **Girdi:** ADR-008 (arayüz dili; "uygulama dili Faz 5'te" notu), `tsconfig.json`,
  `arac/yapi-dogrula.js`.
- **İş:** `package.json` (`"type": "module"`, `npm test` → `node --test src/`),
  uygulama dili kararı **ADR-009** olarak yazılır (ADR-008'in yeniden açılma
  koşulu tam olarak budur: Python seçilirse arayüzler `Protocol`a çevrilir),
  `arac/yapi-dogrula.js` `.js` dosyalarını da tarayacak biçimde genişletilir
  (import yönü kuralı uygulamada da geçerli), bir modülde tek bir örnek test
  dosyasıyla koşucunun çalıştığı gösterilir.
- **Bitti:** `npm test` 0 döner (sıfır test bile olsa koşucu ayakta),
  `node arac/yapi-dogrula.js` `.js` içeren bir ihlali **yakalar** — kapıyı
  kanıtlamak için kasıtlı bir ihlal dosyası yazılıp silinerek denenir.
- **Kapsam dışı:** derleyici/bundler, CI, lint. Hiçbiri bugün gerekmiyor.

### U1 — `src/task-manager/`

- **Girdi:** `src/task-manager/index.d.ts`, [ADR-003](adr/ADR-003-ilerleme-kaydi.md),
  `contracts/task.schema.json`, blueprint §2.2.
- **İş:** görev kaydının diskten okunması/yazılması, adım durum makinesi,
  `sonraki_adim` bağımlılık çözümü, `tamamlandi_mi`.
- **Bitti:** `basladi_yaz` → süreç ölümü benzetimi → yeniden yükleme sonrası
  `tamamlandi_mi` **false**, `bitti_yaz` sonrası **true**; yazılan kaydın
  `contracts/task.schema.json`'a `arac/sema-dogrula.js` ile uyduğu test içinde
  doğrulanır.
- **Kapsam dışı:** paralel adım. Tek dönüşlü `sonraki_adim` bilinçli kısıttır.

### U2 — `src/agent-registry/`

- **Girdi:** `index.d.ts`, `contracts/agent.schema.json`, iki örnek ajan
  (`contracts/ornek/kod-gozden-gecirici.json`, `kanit-denetcisi.json`), ADR-006.
- **İş:** ajan sözleşmesi yükleme, `dogrula`, ev sahibi biçimine `turet`.
- **Bitti:** iki örnek ajan yüklenir ve doğrulanır; eksik zorunlu alanlı bir
  sözleşme **reddedilir**; `turet` dosya **yazmaz** — testte dönüşün içerik
  olduğu ve diskin değişmediği gösterilir.
- **Kapsam dışı:** ajan üretimi/şablonu.

### U3 — `src/tool-registry/`

- **Girdi:** `index.d.ts`, blueprint §2.4, §3.3 ("araç şeması MCP'den; yeni
  sözleşme yazılmaz").
- **İş:** araç kaydı, `argumanlari_dogrula` (MCP'nin JSON Schema'sı ile),
  kayıtta yazan izin sınıfının okunması.
- **Bitti:** geçersiz argüman reddedilir; izin sınıfı **araç adından
  türetilmeye çalışılmadığı** bir testle sabitlenir (adı `read_*` olan ama
  kayıtta `write` yazan bir araç `write` döner).
- **Kapsam dışı:** gerçek MCP sunucusuna bağlanma.

### U4 — `src/permission-manager/`

- **Girdi:** `index.d.ts`, [ADR-005](adr/ADR-005-izin-siniri.md),
  [ADR-007](adr/ADR-007-izin-surum-bagi.md), `contracts/permission.schema.json`,
  [`05-GUVENLIK.md`](mimari/05-GUVENLIK.md).
- **İş:** üç değerli `karar`, `insan_kapisina_yaz`, `onayi_isle`.
- **Bitti:** `BLOCK` ve `HUMAN_REQUIRED` **istisna atmaz, belge döndürür**;
  üretilen belge `permission.schema.json`'a uyar; `HUMAN_REQUIRED` bir satır
  yazar ve onay gelmeden ikinci çağrı yine `HUMAN_REQUIRED` döner.
- **Kapsam dışı:** onay arayüzü. Kapı bir dosya satırıdır.

### U5 — `src/memory-manager/`

- **Girdi:** `index.d.ts`, [`03-BELLEK.md`](mimari/03-BELLEK.md), AP9 → kural 10.
- **İş:** katmanlı `oku`/`yaz`/`gecersiz_kil`; `yaz` zorunlu `IzinKarari` alır.
- **Bitti:** `ALLOW` olmayan kararla `yaz` çağrısı yazmaz; `gecersiz_kil`
  sonrası `oku` o kaydı **döndürmez** (geçersiz kayıt sessizce dolaşmaz).
- **Kapsam dışı:** vektör arama / gömme. Blueprint'te yok.

### U6 — `src/context-manager/`

- **Girdi:** `index.d.ts`, blueprint §2.7.
- **İş:** `esik`, `butcele`, önceden yazılı `kisilma_sirasi`.
- **Bitti:** bütçe aşıldığında atılan parçaların **sırası deterministik** ve
  `kisilma_sirasi` ile birebir; sıra dizisi `readonly` olduğu için çalışma
  anında değiştirilemediği testte gösterilir.
- **Kapsam dışı:** özetleme. Kısılma atmaktır, özetlemek değil.

### U7 — `src/model-router/`

- **Girdi:** `index.d.ts`, blueprint §2.11 (K4: seçim ve taşıma ayrı).
- **İş:** `sec` (sağlayıcı-agnostik), `cagir` (bir `ModelTasiyici` üzerinden).
- **Bitti:** `sec`'in testi **hiçbir sağlayıcı adı içermez**; `cagir` sahte
  taşıyıcıyla çalışır ve dönüşünde `usage` bulunur.
- **Kapsam dışı:** gerçek sağlayıcı taşıyıcısı (ayrı bir gece işidir; U14'ten
  sonra ele alınır).

### U8 — `src/cost-manager/`

- **Girdi:** `index.d.ts`, blueprint §2.12, AP10 → kural 11.
- **İş:** fiyat tablosu yükleme, `usage_isle`, `gecis_gerekli_mi`, `adim_tavani`.
- **Bitti:** tabloda olmayan model → maliyet **`null`** ve `bilinmeyen_cagri`
  sayacı artar (sıfır sayılmaz); sayı ayrıştırmada ondalık ayırıcı testi —
  `BILINEN-TUZAKLAR.md` #4 bu hatanın maliyetini bir kez ödedi.
- **Kapsam dışı:** fatura/raporlama.

### U9 — `src/evaluator/`

- **Girdi:** `index.d.ts`, [ADR-004](adr/ADR-004-degerlendirme-kapisi.md),
  [`04-DEGERLENDIRME.md`](mimari/04-DEGERLENDIRME.md), `arac/kanit-dogrula.js`.
- **İş:** `gecerli_mi`, `esigi_asti_mi` — deterministik, girdi yalnızca `Kanit`.
- **Bitti:** aynı girdi 100 çağrıda aynı sonucu verir; LLM metni `Kanit`
  yerine geçemez — tip dışı bir gövde ile çağrı reddedilir.
- **Kapsam dışı:** LLM-yargıç. ADR-004 bunu kapatmıştır.

### U10 — `src/critic/`

- **Girdi:** `index.d.ts`, `contracts/message.schema.json`, blueprint §2.9.
- **İş:** `elestir` → `MesajSozlesmesi` (`kind: "critique"`).
- **Bitti:** dönüş `string` değil, şemaya uyan bir belgedir
  (`arac/sema-dogrula.js` testte çağrılır); eleştirinin **geçme kararına oy
  vermediği**, kararın yalnızca U9'dan geldiği bir testle sabitlenir.
- **Kapsam dışı:** eleştiri kalitesi ölçümü.

### U11 — `src/recovery-manager/`

- **Girdi:** `index.d.ts`, blueprint §2.10, AP8 → kural 9.
- **İş:** `mod_sec` (`duzelt` / `temiz-sayfa` / `insan-kapisi` / `durdur`),
  `bekleme_ms`.
- **Bitti:** telafisi olmayan eylem sonrası hata → **`insan-kapisi`**, hiçbir
  koşulda `duzelt` değil; `bekleme_ms` artan ve üst sınırlı.
- **Kapsam dışı:** geri alma (rollback) — mimaride yoktur, uygulamada da yok.

### U12 — `src/observability/`

- **Girdi:** `index.d.ts`, [`06-GOZLEM.md`](mimari/06-GOZLEM.md),
  `contracts/span.schema.json`, `arac/iz-izle.js`.
- **İş:** `span_yaz`, `span_ac`, `kosu_izleri`.
- **Bitti:** disk dolu / yazma hatası benzetiminde `span_yaz` **istisna
  atmaz** ve koşuyu düşürmez; yazılan span `span.schema.json`'a uyar ve
  `arac/iz-izle.js` üretilen izi okuyabilir.
- **Kapsam dışı:** OTLP dışa aktarımı, gösterge paneli.

### U13 — `src/orchestrator/`

- **Girdi:** `index.d.ts` + `OrchestratorBagimliliklari`, blueprint §3.2
  (1–10 sırası), ADR-002.
- **İş:** `kosuyu_yurut`, `kosuyu_surdur`, `adimi_yurut`; bağımlılıklar elle
  bağlanır (08 §6: enjeksiyon çatısı yok).
- **Bitti:** 12 sahte bağımlılıkla `adimi_yurut` çağrılır ve çağrı **sırası**
  §3.2'nin 1–10'uyla birebir kaydedilir (sıra testi); `HUMAN_REQUIRED`
  senaryosunda koşu `ONAY_BEKLIYOR`'da **durur**, devam etmez;
  `kosuyu_surdur` yarım kalmış koşuyu tamamlanmış adımı tekrarlamadan sürdürür.
- **Kapsam dışı:** paralel adım yürütme, planlayıcı.

### U14 — Uçtan uca kabul koşusu

- **Girdi:** U1–U13, `contracts/ornek/` altındaki örnek görev ve ajanlar.
- **İş:** gerçek modüllerle (sahte olan yalnızca `ModelTasiyici`) tek görevlik
  bir koşu; çıktı: görev kaydı, izin belgeleri, span dosyası.
- **Bitti:** koşu 0 döner; üretilen **her** belge `arac/sema-dogrula.js`'ten
  geçer; koşu ortasından öldürülüp `kosuyu_surdur` ile devam ettirildiğinde
  yan etki **tekrarlanmaz** (D1 amnezisinin kapanış kanıtı);
  `arac/iz-izle.js` koşunun izini baştan sona okur.
- **Kapsam dışı:** başarım ölçümü, çoklu görev, eş zamanlılık.

---

## 5. Bu yol haritasında bilerek olmayanlar

- **Tarih ve süre tahmini.** Maddeler gece döngüsünün yakıtıdır; sıra
  bağlayıcıdır, takvim değil.
- **CI kurulumu.** Kapı üç komuttur ve elle de koşar; CI'nın önlediği bir
  hata bu makinede henüz yaşanmadı (K2 ölçütü karşılanmıyor).
- **Sağlayıcı taşıyıcıları, MCP sunucu bağlantısı, gösterge paneli.** Üçü de
  çekirdek 13 bileşenin dışında; U14'ten sonra ayrı madde olarak açılabilir.
  Bugün açılmaları Faz 5'in tanımını bulanıklaştırırdı.
- **Yeni ADR ihtiyacı öngörüsü.** U0'ın ADR-009'u dışında ADR planlanmadı;
  bir madde karar gerektirirse ADR'yi o madde yazar.

---

## 6. Faz 5 ne zaman biter

U0–U14'ün on beşi de işaretlendiğinde ve `npm test` + `node arac/yapi-dogrula.js`
temiz olduğunda. O noktada depo, **13 bileşenli mimarinin çalışan ve sınanan**
hâlidir; sonrası (sağlayıcı entegrasyonu, gerçek MCP, panel) Faz 5'in değil,
"Sürekli" maddesinin işidir.
