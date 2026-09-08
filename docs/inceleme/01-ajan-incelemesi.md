# Ajan mimarisi (01-AJAN + sözleşme v2.0) — bağımsız inceleme

**Tarih:** 08.09.2026 14:15 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/mimari/01-AJAN.md`, `contracts/agent.schema.json` v2.0,
`contracts/ornek/*.json`, `arac/sema-dogrula.js` (koşu b642613)

## Mekanik kontroller (bu incelemede bağımsız koşuldu)

| Kontrol | Sonuç |
|---|---|
| Şema geçerli JSON, draft 2020-12 | ✓ |
| ADR-000'in 16 sözleşme alanı | 16/16 var; ek olarak `contract_version`, `x-host` ve (şema 2.1, ADR-010) `triggers` → 19 alan, 18 zorunlu |
| `additionalProperties` | `false` — tanımsız alan reddediliyor |
| Sabit sınır: `permissions.filesystem.delete` | `const: false` korunmuş |
| Belge ↔ şema örtüşmesi | 19 alanın 19'u `01-AJAN.md` içinde geçiyor |
| İki örnek sözleşme | `kod-gozden-gecirici` ve `kanit-denetcisi`: 18'er alan, **eksik zorunlu yok, şemada olmayan alan yok** (şemadan bağımsız betikle sayıldı) |
| `arac/sema-dogrula.js --test` | Çıkış 0; 12 bozma senaryosunun 12'si reddedildi |
| Alıntı izlenebilirliği (`arac/iz-izle.js`) | `00-BLUEPRINT.md` 9/9 birebir; `01-AJAN.md` kod alıntısı içermiyor (tasarım belgesi, beklenen) |

## Değerlendirme

**Güçlü yan: iddia testle beraber gelmiş.** Belge "şema kuralları zorluyor"
demekle kalmayıp bağımlılıksız bir doğrulayıcı ve 12 red senaryosu yazmış.
Doğrulayıcı desteklemediği bir anahtar kelimeyi görünce **hata veriyor**,
sessizce geçmiyor — bu tam olarak AP3'ün ("beyan edilen garantinin kodda
karşılığı yok") kendimize uygulanmış hâli ve İ3'ün "sessiz geçen doğrulayıcı
doğrulamıyordur" dersi.

**Güçlü yan: iki örnek bilerek farklı dalları geziyor.** Biri yazma izni yok
ve tek adımlı, diğeri yazma izni tek glob ile sınırlı, döngülü ve kalıcı
bellek yazıyor. Yani şemanın `if/then` dalları örneklerle fiilen kapsanıyor.

**Not: `contract_version` zorunlu ve sabit** (bu inceleme sırasında `"2.0"`; U15 ile `"2.1"`, [ADR-010](../adr/ADR-010-tetikleyici-ifade.md)). Bu, eski (v1) sözleşme
dosyalarını geçersiz kılar. Depoda v1 sözleşme kalmadığı için şu an sorun
değil; Faz 4'te `turkce-ajanlar` ajanları bu şemaya taşınırken göç adımı
gerekecek — `01-AJAN.md` §6 bunu "ev sahibi türetme" boşluğu olarak zaten
işaretlemiş.

**Not: doğrulayıcı JSON Schema'nın alt kümesi.** Bilinçli ve belgelenmiş bir
sınır; `$ref`, `allOf`, `if/then` destekleniyor. Faz 4'te üçüncü taraf bir
doğrulayıcıyla çapraz kontrol yapılırsa alt kümenin yeterliliği ölçülmüş olur.

## Karar

Ajan mimarisi ve sözleşme v2.0 **kullanılabilir**; Faz 3'ün kalan mimari
belgeleri (orkestrasyon, bellek, değerlendirme, güvenlik, gözlem, öğrenme)
bu sözleşmenin üstüne yazılabilir. Açık iş yok; iki not Faz 4'e taşınan
doğrulama adımları.
