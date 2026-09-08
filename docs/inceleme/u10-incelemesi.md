# U10 — `src/critic/` — bağımsız inceleme

**Tarih:** 08.09.2026 18:16 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/critic/index.js` + testleri (koşu 4a230cf)

## Kapı yeniden koşuldu

`npm test` → **112 test, 112 geçti** (U10'un payı 7). `npm run kapi` temiz.

## Bağımsız deneme: Critic geçme kararına karışabiliyor mu?

ADR-004'ün ayrımı: **Evaluator karar verir, Critic yazar.** Bunu doğrudan
zorladım — `GECTI` kararı için eleştiri istedim:

```
elestir: elestiri yalnizca KALDI karari icin istenir, "GECTI" verildi.
Elestirinin gecme kararina oyu yoktur; gecmis bir karari ...
```

Reddedildi. Yani Critic mimaride yazılı sınırın dışına çıkamıyor; bir LLM
bileşeni olmasına rağmen karar akışına giremiyor. D3'ün ikinci yarısı
("LLM eleştirir, karar vermez") kodda.

Testler ayrıca üst sınırı sınıyor: 20'den fazla madde **kesiliyor ve
bildiriliyor** (sessizce kırpılmıyor), geçersiz madde düzeltilmeden
reddediliyor. İkincisi önemli: eleştiriyi "onarmak" Critic'in işi olsaydı
bozuk çıktı sessizce geçerli görünürdü.

## Karar

U10 **bitti sayılabilir**. Evaluator/Critic ayrımı bağımsız denemeyle
doğrulandı.
