# U8 — `src/cost-manager/` — bağımsız inceleme

**Tarih:** 08.09.2026 18:10 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/cost-manager/index.js`, `veri/fiyat-tablosu.json` (koşu d87ea9f)

## Kapı yeniden koşuldu

`npm test` → U8 turunda 85 test, 85 geçti (U8'in payı 15). `npm run kapi` temiz.

## Bağımsız kontroller

| Kontrol | Sonuç |
|---|---|
| AP10 kuralı ("katalog veridir, koda gömülmez") | Fiyatlar `veri/fiyat-tablosu.json` içinde; kodda tablo yok |
| Güncelleme yolu belgeli mi | Dosyada `guncelleme_proseduru` beş adım olarak yazılı; 3. adım açıkça *"fiyat okunamıyorsa alan null bırakılır — 0 yazmak yasaktır"* |
| Kural 11 (bilinmeyen maliyet `null`) | Testler: bilinmeyen model → `maliyet null`, `bilinmeyen_cagri` sayacı artıyor, **toplam artmıyor**; fiyatı `null` olan satır da bilinmeyen sayılıyor |
| Fiyatlanamayan sayaç | Eşleme tablosunda olmayan bir kullanım sayacı sıfır sayılmıyor, çağrı bilinmeyene düşüyor |
| Yerel biçimlendirme | Test: *"kaynakta yerel biçimlendirme yok (USD makine sayısıdır)"* — tuzak #4/#24 ailesine karşı kalıcı koruma |

## U7 ile sözleşme sınırı (U7 incelemesindeki not)

U7 katalogda **çağrı başına** `tahmini_usd` bekliyordu; U8 ise fiyat tablosu +
kullanım sayaçlarından maliyeti **hesaplıyor**. İkisi çelişmiyor: hesaplayan
taraf Cost Manager, tüketen taraf Model Router. Ama bu bağı fiilen kuran kod
henüz yok — U13 (Orchestrator) ikisini birleştirdiğinde `tahmini_usd`'yi
kimin doldurduğu açık yazılmalı. Takip maddesi olarak işaretliyorum.

## Karar

U8 **bitti sayılabilir**. Fiyat tablosunun veri dosyası olması ve `null`
disiplininin testle korunması AP10'un doğrudan karşılığı.
