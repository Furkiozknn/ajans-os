# Uygulama yol haritası (Faz 5) — bağımsız inceleme

**Tarih:** 08.09.2026 16:00 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/04-UYGULAMA-YOL-HARITASI.md` ve `YOL-HARITASI.md`'ye eklenen
U0–U14 maddeleri (koşu 31d173b)

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Madde sayısı | Belgede 15 madde (U0–U14); `YOL-HARITASI.md`'de de 15 açık madde olarak duruyor — **birebir** |
| Modül kapsamı | 13 modülün 13'ü birer maddeye sahip (U1–U13); U0 iskelet/test kapısı, U14 uçtan uca kabul |
| "Bitti" ölçütü | Üç komut zorunlu: modül testi, `yapi-dogrula.js`, `tsc`. Ölçüt madde başına değil **ortak** — kaçamak yok |
| Bağımlılık yok kuralı | Test koşucusu Node'un kendi `node:test`'i; yeni paket eklenmiyor. K3 ile tutarlı |

## Değerlendirme

**Güçlü yan: her testte en az bir mimari kısıt.** "Yalnızca mutlu yol sınayan
test AP3'ü gizler" kuralı yazılı; iki yazma sırası, üç değerli izin kararı,
`null` maliyet gibi kısıtlar test konusu yapılıyor. Bu, Faz 2'nin bulgusunun
teste kadar inmiş hâli.

**Güçlü yan: `tsc` yoksa atlanır ama günlüğe yazılır.** Çevrimdışı turda
sessizce geçilmiyor — "denetlenmedi ≠ temiz" kuralının (D11) araç
seviyesindeki uygulaması.

**Güçlü yan: bitiş tanımı net.** Faz 5, on beş madde işaretli ve iki komut
temiz olduğunda biter; sağlayıcı entegrasyonu ve panel bilerek kapsam dışı.
"Her şeyi ekle" eğilimine karşı ADR-000 K2'nin son uygulaması.

**Not: sıra bağımlılığı sıkı.** U13 (Orchestrator) diğer on iki modülün
arayüzlerine dayanıyor; U0 test kapısını kurmadan hiçbir madde
işaretlenemez. Döngü maddeleri sırayla aldığı için bu doğal olarak
sağlanıyor, ama bir madde bütçe duvarına çarparsa sonraki madde onun
eksik bıraktığı arayüze dayanabilir. Kural olarak: yarım kalan madde
**işaretlenmez** (`gelistirme-uret.ps1` zaten böyle davranıyor).

## Karar

Uygulama yol haritası **kullanılabilir**. Faz 4 (tasarım) bu belgeyle
kapandı; Faz 5 kodlama sırası açık ve ölçütlü.
