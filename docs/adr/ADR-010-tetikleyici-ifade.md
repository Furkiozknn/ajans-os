# ADR-010 — Tetikleyici ifade sözleşmenin alanıdır: `triggers`, şema 2.1

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili maddeler:** U2 (`src/agent-registry/`), U15
**Yeniden açılma koşulu:** İkinci bir ev sahibi biçimi eklendiğinde (`cursor`,
A2A kartı vb.) tetikleyici ifadenin o ev sahibinde karşılığı yoksa veya
karşılığı yapısal bir alansa (serbest metin değil) — o zaman `triggers`'ın
tek düz dize dizisi olması yetmeyebilir ve alan yapısallaşır.

## Bağlam

U2 incelemesi ölçtü: `agent-registry.turet(ad, "claude-code")` yapısal olarak
geçerli bir `.md` üretiyor, ama komşu projenin doğrulayıcısı
(`turkce-ajanlar/arac/dogrula.js`) onu **reddediyordu**:

```
[hata] description: tetikleyici ifade yok — kullanicinin diyecegi bir cumleyi
       tirnak icinde yaz ("su klasoru duzenle" gibi) veya "... dediginde
       kullan" kalibini kullan
```

Bu bir biçim kusuru değil, **sözleşmede eksik bilgi**. 18 alanın hiçbiri
"kullanıcı bunu ne diyerek çağırır" sorusunu yanıtlamıyordu:

| Alan | Ne taşır | Neden yetmez |
|---|---|---|
| `capabilities[].description` | Ne **yapabilir** | Yetenek, çağrı ifadesi değil. "Sınır durumlar arar" kullanıcının söyleyeceği cümle değil. |
| `mission` | Ne **için** var | Amaç cümlesi, tek ve soyut. |
| `role.summary` | **Nasıl** çalışır | İç davranış. |
| `identity.tags` | Sınıflandırma | Kebab-case etiket, cümle değil. |

Bilgi hiçbir yerde yoktu; türetici de yoktan üretemez. Ve bu, K8'in
("ev sahibi biçimleri sözleşmeden türetilir, elle yazılmaz") sessizce
çöktüğü noktaydı: sözleşme eksik olduğu için türetilen dosya kabul edilmiyor,
kabul edilmediği için insan `.md`'yi elle düzeltmeye başlıyor.

## Karar

**Sözleşmeye zorunlu `triggers: string[]` alanı eklendi; şema sürümü 2.1.**

```json
"triggers": [
  "şu kodu incele",
  "gözden geçir",
  "bu değişiklikte sorun var mı"
]
```

- Kullanıcının ağzından, **tırnaksız** yazılır. Tırnağı ev sahibi türeticisi
  koyar: biçim ev sahibinin işi, sözleşme cümlenin kendisini taşır.
- `minItems: 1` — bir ajanın ne zaman çağrılacağı boş bırakılamaz.
- `maxItems: 8`, öğe başına 5–120 karakter, `uniqueItems`.
- Türetici (`aciklamaTuret`) bunu `description` sonuna
  `Kullanici "…", "…" dediginde kullan.` cümlesiyle ekler.

**Sürüm 2.1'in gerekçesi:** zorunlu alan eklemek eski sözleşmeleri geçersiz
kılar. `contract_version` sabiti `"2.0"` → `"2.1"` oldu ve iki örnek sözleşme
güncellendi; başka geçerli 2.0 sözleşmesi yok, göç maliyeti sıfır.

## Elenen seçenek: `x-host` altından okuma

`x-host.claude-code.frontmatter.description` alanını türeticinin okuması
düşünüldü ve **reddedildi**:

1. **K8'i tersine çevirirdi.** `x-host` ev sahibine özgü *biçim* bilgisi
   içindir; türetici oradan içerik okusaydı `description` türetilmiş değil,
   elle yazılmış olurdu — tam olarak K8'in yasakladığı şey.
2. **Bilgiyi ev sahibi sayısı kadar kopyalardı.** Tetikleyici ifade ajana
   aittir, Claude Code'a değil. İkinci ev sahibi eklendiğinde aynı cümleler
   ikinci kez yazılırdı ve ikisi sürüklenirdi.
3. **Doğrulanamazdı.** `x-host` çekirdek şemanın denetlemediği alandır
   (`01-AJAN.md` §4: tek kaçış kapısı). Oraya konan zorunluluk şema tarafından
   zorlanamaz, yalnızca temenni edilir — `03-ANTI-PATTERNLER.md` AP3.

Kısacası: eksik olan bilgi ev sahibine özgü değildi, o yüzden çözümü de
`x-host` altında olamazdı.

## Sonuç ve kanıt

Bitti ölçütü sözle değil, komşunun kapısıyla ölçüldü:

```
$ node arac/dogrula.js <turetilen>.md --kati
Sonuc: 2/2 dosya gecti, 0 hata, 0 uyari     # cikis 0
```

Bu kontrol `src/agent-registry/index.test.js` içine iki test olarak girdi:

- **`triggers description'a tirnak icinde gecer`** — komşu depodan bağımsız
  çalışır; her tetik ifadesinin türetilen `description` içinde tırnaklı
  geçtiğini iddia eder.
- **`turetilen dosya turkce-ajanlar/arac/dogrula.js'ten gecer (U15)`** —
  komşu doğrulayıcıyı `--kati` ile alt süreçte koşar. Komşu depo yoksa test
  `t.skip` ile **işaretli** atlanır; ajans-os dışarıya bağımlı değildir
  (ADR-002), ama atlanma sessiz de değildir.

`--kati` bilinçli: türetilen bir dosyada uyarı bırakmak "geçti ama biraz"
demektir, ve o uyarı ("tırnak içinde örnek ifade yok") tam da bu ADR'nin
çözdüğü problemdi.

## Yan karar: frontmatter'da tek tırnaklı YAML

Tetik ifadeleri `description` içine çift tırnakla girince türetici çıktısı
`JSON.stringify` ile yazıldığında `\"` kaçışı üretiyordu. Ev sahiplerinin
frontmatter ayrıştırıcıları (ölçülen örnek: `turkce-ajanlar/arac/dogrula.js`)
ters bölülü kaçışı çözmüyor; tetik ifadesi tırnak içinde görünmez hâle
geliyordu. `yamlDeger` artık çift tırnak içeren metni YAML'ın **tek tırnaklı**
biçimiyle yazıyor (tek kaçış kuralı `'` → `''`).

Kalan sınır, kayıtlıdır: naif bir ayrıştırıcı `''` çiftini tek tırnağa geri
çevirmez, yani metinde kesme işareti varsa (`PATH'te` → `PATH''te`) o
ayrıştırıcının gözünde çift görünür. Gerçek bir YAML ayrıştırıcısı — Claude
Code'unki dahil — doğru çözer. Bu kusur türetilen dosyanın kabulünü
etkilemiyor; etkilediği gün çözüm ayrıştırıcı tarafındadır, türetici tarafında
değil.
