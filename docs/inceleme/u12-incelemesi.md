# U12 — `src/observability/` — bağımsız inceleme

**Tarih:** 08.09.2026 18:29 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/observability/index.js` + testleri (koşu e28ee93)

## Kapı yeniden koşuldu

`npm test` → **128 test, 128 geçti** (U12'nin payı 7). `npm run kapi` temiz.

## Bağımsız deneme: gözlem düşerse koşu düşer mi?

06-GOZLEM'in taşıyıcı kararı: *"span doğruluk kaynağı değildir; gözlem
katmanı düşerse sistem yanlış karar vermez, yalnızca kör kalır."* Bunu
zorladım — gözlemciyi bir klasörle kurdum, sonra **klasörü sildim** ve span
yazmayı denedim:

```
dizin silinmisken yazma -> null   (istisna atmadi)
```

Yazma başarısız oldu ama çağrı istisna fırlatmadı; yani iz yazılamadığında
çağıran akış devam ediyor. Tam da mimarinin istediği davranış: gözlem tek
yönlü ve koşuyu düşüremez.

API dar tutulmuş: `span_ac`, `span_yaz`, `kosu_izleri`, `iz_yolu` — okuma
tarafı ayrı, karar tarafına dokunmuyor.

## Karar

U12 **bitti sayılabilir**. Tek yönlülük bağımsız denemede doğrulandı.
