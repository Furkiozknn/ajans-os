# U3 — `src/tool-registry/` — bağımsız inceleme

**Tarih:** 08.09.2026 16:32 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/tool-registry/index.js` + testleri (koşu 3ea66df)

## Kapı yeniden koşuldu

`npm test` → 19 test, 19 geçti (U1 8 + U2 5 + U3 6). `npm run kapi` temiz.

## Bağımsız deneme

Modülü elle çağırdım. Kayıt doğrulaması **her eksik alanda tipli ve adıyla
hata veriyor**, sessizce atlamıyor:

- `kayitlar` dizi değilse → `aracKaydi: kayitlar bir dizi olmali`
- `tanim.name` yoksa → `kayit: 'tanim.name' zorunlu`
- `inputSchema` nesne değilse → `... 'tanim.inputSchema' bir nesne olmali (MCP şeması)`
- `irreversible` boolean değilse → `dosya_oku: 'irreversible' bir boolean olmali`

Bu, AP3'ün ("beyan edilen garantinin kodda karşılığı yok") tersi: kayıt
defterine giren her araç, izin kararının ihtiyaç duyduğu alanları taşımak
zorunda. Geçerli kayıtla argüman doğrulaması MCP `inputSchema`'sına göre
çalışıyor; bilinmeyen araç `null` dönüyor.

**U1 ile karşıtlık:** U1'in `olustur`u girdiyi doğrulamadan alan okuyordu
(ham `TypeError`). U2 ve U3 tipli hata veriyor. U1'in notu bu yüzden geçerli:
üç modül aynı disiplinde olmalı.

## Karar

U3 **bitti sayılabilir**. İzin sınıfının araç adından değil kayıttan
okunması (D12/AP6'nın "etiket ≠ yetki" dersi) testle ve elle doğrulandı.
