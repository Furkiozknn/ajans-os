# Depo yapısı ve çekirdek arayüzler — bağımsız inceleme

**Tarih:** 08.09.2026 15:55 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/` iskeleti (13 modül + `tipler.d.ts`), `docs/mimari/08-YAPI-VE-ARAYUZLER.md`,
`arac/yapi-dogrula.js` (koşu deac0dc)

## ADR-001'in test edilebilir ölçütü

ADR-001 şunu yazmıştı: *"`src/` altındaki modül klasörü sayısı 13'tür ve her
birinin adı `00-BLUEPRINT.md` §2'deki bir başlıkla birebir eşleşir."*

Bu incelemede **bağımsız betikle** ölçüldü (aracın kendi çıktısına
güvenilmedi): 13 modül klasörü, blueprint §2'de 13 başlık, eşleşmeyen yok
(iki yönde de). **Ölçüt geçti.** ADR-001 artık "kabul edildi" değil,
*uygulandı* durumunda.

## Diğer mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Her modülde `index.d.ts` | 13/13 |
| ADR-002 çağrı yönü (yalnızca Orchestrator kardeş modül çağırır) | Bağımsız tarama: **0 ihlal** |
| `tipler.d.ts` sözleşme atıfları | Beş şemanın beşi de diskte mevcut |
| `arac/yapi-dogrula.js` | Çıkış 0; beş kontrolü (sayı, ad eşleşmesi, `index.d.ts`, import yönü, belgede geçme) kendisi de koşuyor |
| `08-YAPI-VE-ARAYUZLER.md` | Kod alıntısı yok (tasarım belgesi) — beklenen |

## Değerlendirme

**Güçlü yan: ölçüt koda dönüştü.** ADR'nin "test edilebilir ölçüt" satırı bir
temenni olarak kalmamış; `arac/yapi-dogrula.js` onu her koşuda sınayan bir
betik. Bu, AP3'e karşı bu programda üçüncü kez tekrar eden refleks: iddia +
onu sınayan araç birlikte geliyor.

**Güçlü yan: mimari kural kodda görünür.** "Bileşenler birbirini çağırmaz,
Orchestrator çağırır" kuralı `.d.ts` import yönü olarak somutlaşmış ve
denetlenebilir. Faz 5'te gerçek kod yazılırken bu kontrol kırmızı yanarsa
mimariden sapma anında görülür.

**Not: derleyici yok.** Bu makinede `tsc` kurulu değil, tip dosyaları
derlenerek doğrulanmadı; yapısal kontrol (import yönü, dosya varlığı) yapıldı.
Faz 5'te TypeScript kurulursa `tsc --noEmit` bir adım olarak eklenmeli.

## Karar

İskelet **kullanılabilir**. Kalan tek yol haritası maddesi uygulama yol
haritası (Faz 5 sıralaması).
