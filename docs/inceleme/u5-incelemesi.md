# U5 — `src/memory-manager/` — bağımsız inceleme

**Tarih:** 08.09.2026 16:54 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/memory-manager/index.js` + testleri, tuzak #24 (koşu 6bdbf77)

## Kapı yeniden koşuldu

`npm test` → **45 test, 45 geçti** (U5'in payı 9). `npm run kapi` temiz.

## Bağımsız denemeler

Belleğe yazmayı üç ayrı yoldan zorladım; üçü de farklı ve doğru gerekçeyle
reddedildi:

| Deneme | Sonuç |
|---|---|
| İzin belgesi olmadan yazma | `yaz: izin karari belgesi zorunlu (AP9 → kural 10)` |
| Başka bir işlem için verilmiş `ALLOW` ile yazma | `karar '...' islemi icin verilmis, bellege yazma yetkisi degil` |
| `retention` (saklama süresi) olmadan yazma | Reddedildi — süresiz bellek kaydı yazılamıyor |

Yani "belleğe yazmak bir izin işlemidir" kuralı (AP9 → kural 10) kodda
gerçekten zorlanıyor; izin belgesinin **hangi işlem için** verildiği de
kontrol ediliyor. Bu, izin sızmasının en sessiz biçimine karşı savunma.

## Öğrenilen tuzak: Türkçe yerel metin karşılaştırmasını bozar

Koşu, `BILINEN-TUZAKLAR.md`'ye 24. maddeyi ekledi ve bu **ölçülmüş** bir
bulgu: metin süzgeci iki tarafı `toLocaleLowerCase("tr")` ile küçültünce
`"ISTANBUL"` → `"ıstanbul"` (noktasız) oluyor ve eşleşme kayboluyor. Tuzak
#4'ün (sayı ayrıştırmada her zaman InvariantCulture) tersi: **metinde**
Türkçe yerel vermek zarar veriyor. Bu, programın "hatayı değil sınıfını
yok et" ilkesinin bir örneği; kural artık tuzak listesinde.

## Karar

U5 **bitti sayılabilir**. İzin zinciri bağımsız olarak zorlandı ve tuttu.
