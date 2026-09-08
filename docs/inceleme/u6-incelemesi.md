# U6 — `src/context-manager/` — bağımsız inceleme

**Tarih:** 08.09.2026 17:02 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/context-manager/index.js` + testleri (koşu bb5eb4a)

## Kapı yeniden koşuldu

`npm test` → **56 test, 56 geçti** (U6'nın payı 11). `npm run kapi` temiz.

## Bağımsız deneme

Bütçeleyiciyi sayılarla doğrudan çalıştırdım (toplam 1000, tampon 100,
eşik 0,9 → tavan 900):

```
girdi : sistem 120 + görev 200 + bilgi 400 + sorgu 100 + tampon 100 = 920
çıktı : bilgi 400 → 380, kısılan 20, kalan 100, asildi_mi true
```

Kısılan tek parça **bilgi** oldu; kısılma sırası kuruluşta verilen
`["bilgi","gorev_durumu","sorgu"]` ile birebir ve `sistem_sozlesmesi`
kısılmıyor. D9'un ("bağlam bütçesi bileşenlere bölünür, eşik %100'ün
altındadır") ve 03-BELLEK §7'nin kısılma sırası kuralı çalışıyor.

**Kısılamaz taşma sessiz geçmiyor:** `sistem_sozlesmesi` tek başına tavanı
aşınca istisna, hem de sayılarla: *"kisilamaz parcalar tek basina tavani
asiyor (sistem_sozlesmesi + tampon = 5100, tavan = 900)"*. D10'un
("taşma hata değil planlanmış faz geçişidir") sınır durumu: kısılacak şey
kalmadıysa taşma **bildirilir**, sessizce kesilmez.

Testler ayrıca çalışma anında kısılma sırasının değiştirilemediğini ve
`butcele`nin girdiyi değiştirmediğini sınıyor — ikisi de AP2'ye
("aynı kararın ikinci uygulaması") karşı.

## Karar

U6 **bitti sayılabilir**. Bütçe davranışı sayısal olarak doğrulandı.
