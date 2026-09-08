# U9 — `src/evaluator/` — bağımsız inceleme

**Tarih:** 08.09.2026 18:12 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/evaluator/index.js` + testleri (koşu d03d703)

## Kapı yeniden koşuldu

`npm test` → **105 test, 105 geçti** (U9'un payı 20). `npm run kapi` temiz.

## Bağımsız denemeler

Değerlendiriciyi doğrudan çağırdım; üç davranış mimariyle birebir çıktı:

| Deneme | Sonuç |
|---|---|
| Kanıt türü belirtmeden değerlendirme | **Reddedildi**: *"bir kanit turu degil. Izin verilenler: cikis_kodu, sema, test, olcum (ADR-004: LLM çıktısı kanıt değildir)"* |
| Kanıt listesi boş | `DEGERLENDIRILMEDI` + açıklama: *"deterministik dogrulayici bulunamadi, insan kapisina dusuyor"* — D11'in ("denetlenmedi ≠ temiz") uygulaması |
| Ölçüm kanıtına tanımsız alan (`esik`) eklemek | Reddedildi: *"kanit birlesimi kapalidir (ADR-004)"* — şema dışı alan sessizce yok sayılmıyor |

Testler ayrıca `gecerli_mi` / `esigi_asti_mi` ayrımını (04 §5.1) ve
"tek olumsuz kanıt bütün sonucu KALDI yapar" kuralını sınıyor.

**Kritik nokta:** LLM çıktısının kanıt olarak kabul **edilmemesi** kodda
zorlanıyor. D3'ün ("yargı deterministik kaynaktan gelir; LLM eleştirir,
karar vermez") en somut karşılığı bu; Critic (U10) ayrı bileşen olduğu için
ayrım yapısal.

## Karar

U9 **bitti sayılabilir**. Değerlendirme kapısının çekirdek kuralı bağımsız
denemelerde tuttu.
