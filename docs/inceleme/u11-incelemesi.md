# U11 — `src/recovery-manager/` — bağımsız inceleme

**Tarih:** 08.09.2026 18:23 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/recovery-manager/index.js` + testleri (koşu 35a66f1)

## Kapı yeniden koşuldu

`npm test` → **121 test, 121 geçti** (U11'in payı 9). `npm run kapi` temiz.

## Bağımsız deneme: mod seçimi

Beş durumu doğrudan sordum; beşi de gerekçesiyle döndü:

| Durum | Mod | Gerekçe (kodun kendi cümlesi) |
|---|---|---|
| `SEMA_IHLALI`, 1. deneme | `duzelt` | "bağlam korunur ve eleştiri eklenir" |
| `DOGRULAMA_KALDI` | `duzelt` | aynı |
| `BUTCE_DUVARI` | **`durdur`** | "tekrar denemekle değişmez" |
| Telafisi olmayan yan etki | **`insan-kapisi`** | "yapılmış yan etkinin tanımlı telafisi yok" |
| Deneme hakkı dolmuş | `durdur` | "3 deneme hakkı doldu" |

Dördüncü satır AP8'in ("geri alma sanılan şey yalnızca durumu geri sarmadır")
doğrudan uygulaması: telafisi olmayan bir eylemden sonra makine kendi başına
devam etmiyor, insana düşüyor. Testler bunu daha da sıkı sınıyor: *"telafi
yoksa 'duzelt' hiçbir koşulda üretilmiyor"* ve *"telafisi olmayan eylemden
sonra her hata türü ve her denemede insan-kapısı"*.

`BUTCE_DUVARI`'nın yeniden denenmemesi de doğru: bu makinede yaşanmış
arızanın (tuzak #7) tam karşılığı — bütçe duvarında tekrar denemek parayı
ikinci kez yakardı.

## Karar

U11 **bitti sayılabilir**. Kurtarma modları ve insan kapısına düşme koşulu
bağımsız denemede mimariyle birebir.
