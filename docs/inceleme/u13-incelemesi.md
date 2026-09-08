# U13 — `src/orchestrator/` — bağımsız inceleme

**Tarih:** 08.09.2026 18:42 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/orchestrator/index.js` (391 satır) + testleri (495 satır) (koşu b42d383)

## Kapı yeniden koşuldu

`npm test` → **137 test, 137 geçti** (U13'ün payı 9). `npm run kapi` temiz;
`yapi-dogrula` hâlâ "import yönü tek" diyor — orkestratör on iki modülü
birleştirdiği hâlde kardeş modüller birbirini çağırmıyor.

## Bağımsız kontroller

**Bağımlılıklar elle bağlanıyor, eksikse kuruluşta patlıyor.** Boş nesneyle
kurmayı denedim:

```
orkestrator: eksik bagimlilik: gorev_yoneticisi, ajan_defteri, arac_defteri,
izin_yoneticisi, bellek_yoneticisi, baglam_yoneticisi, degerlendirici,
elestirmen, kurtarma_yoneticisi, model_yon...
```

On iki bağımlılığın hepsi adıyla isteniyor; testlerden biri bunu kural olarak
sınıyor: *"hata koşu ortasında değil kuruluşta gelir"*. Gizli bağımlılık ve
servis yerleştirici yok — AP7'nin ("çekirdek tek dosyada birikir") tersi.

**Test adları mimariye çapa atmış.** Dokuz testin adı doğrudan belge
maddelerine gönderme yapıyor: çağrı sırası blueprint §3.2'nin 1-10'uyla
birebir, `KALDI` → önce eleştirmen sonra kurtarma (§3.2/8), `HUMAN_REQUIRED`
→ adım `ONAY_BEKLIYOR`'da kalıyor ve koşu ikinci adıma **geçmiyor**,
`DEGERLENDIRILMEDI` geçti sayılmıyor (D11), bütçe eşiğinde koşu `butce` ile
**duruyor, çökmüyor** (D10), araç çağrısı olmayan adımda araç defteri ve izin
yöneticisi **hiç çağrılmıyor** (gereksiz kapı maliyeti yok).

## Karar

U13 **bitti sayılabilir**. On üç modülün birleşimi mimarinin çağrı sırasına
uyuyor ve sınır davranışları (onay bekleme, bütçe, değerlendirilmedi) testle
sabitlenmiş. Kalan: U14 uçtan uca kabul koşusu.
