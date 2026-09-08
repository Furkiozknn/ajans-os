# U4 — `src/permission-manager/` — bağımsız inceleme

**Tarih:** 08.09.2026 16:48 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/permission-manager/index.js` + testleri, ADR-007 (koşu 45a1c9a)

## Kapı yeniden koşuldu

`npm test` → **36 test, 36 geçti** (U1 8 + U2 5 + U3 6 + U4 17). `npm run kapi` temiz.

## Bağımsız saldırı denemesi: sabit sınır config ile açılabiliyor mu?

AP1'in kuralı 1: *"sabit sınırlar config'ten okunmaz; yapılandırma kapıyı
daraltabilir, genişletemez."* Bunu doğrudan denedim — izin yöneticisini
`kurallar: { filesystem: { delete: true } }` ile, yani kalıcı silmeyi
yapılandırmadan **açmaya çalışarak** kurdum ve bir silme isteği gönderdim:

| Deneme | Sonuç |
|---|---|
| Kapısız kurulum (`kapi` verilmeden) | **Reddedildi**: "insan kapisini yazan `kapi` fonksiyonu zorunlu" — kapısız izin yöneticisi kurulamıyor |
| `delete: true` config ile kalıcı silme | **`HUMAN_REQUIRED`** — config sınırı açamadı, karar kapıya düştü |
| Kapsamlı okuma (`scope: ["docs/**"]`) | `HUMAN_REQUIRED` — açık izin kaydı yokken varsayılan kapalı (AP6 kuralı 7) |
| Kapsamsız istek (`scope: []`) | **İstisna**: "'scope' en az bir somut hedef içermeli (ADR-005/3)" |
| Kayıtsız onay (`recorded_in`/`gate_ref` yok) | **İstisna**: "kaydı olmayan onay yoktur (ADR-005/2)" |

Beş denemenin beşi de mimarinin yazdığı gibi davrandı. Özellikle sonuncusu
değerli: insan kapısı "evet" dese bile **iz bırakmayan onay kabul edilmiyor**.
Bu, AP1'in en sert biçimine (bayrakla sıfırlanan kapı) karşı yapısal savunma.

## Değerlendirme

Testlerin 17'si tek başına U4'e ait ve hepsi kısıt sınıyor: gölge denetleyici
kararı değiştiremiyor, süresi geçmiş izin yeniden kullanılamıyor, yeniden
kullanılabilir izin özet ve tavan olmadan verilemiyor, dışarı verilen kayıt
değiştirilse içerideki karar bozulmuyor.

Bu modül, programın en riskli bileşeni (sabit sınırların bekçisi) ve
davranışı belgeyle birebir. Şu ana kadar incelenen dört modül içinde en
sıkı doğrulanmış olanı.

## Karar

U4 **bitti sayılabilir**. Bağımsız saldırı denemeleri sınırı aşamadı.
