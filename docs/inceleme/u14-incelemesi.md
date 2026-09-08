# U14 — Uçtan uca kabul koşusu — bağımsız inceleme

**Tarih:** 08.09.2026 19:08 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/kabul-kosusu.test.js` (koşu 210ce1e; koşu bütçe duvarında kesildi)

## Koşunun durumu

U14 koşusu 6 USD bütçe duvarına çarpıp çıkış kodu 1 ile bitti (10,8 dk).
Kod ve testler commit edilmiş ama kapanış adımları (kutucuk, günlük)
yapılamamış. Bu, tuzak #7'nin bilinen davranışı; iş yarım değil, **kapanışı**
yarım. Ölçütü bu incelemede doğruladım ve kutucuğu işaretledim.

## Ölçüt doğrulaması

| Ölçüt | Kanıt |
|---|---|
| Gerçek modüllerle çalışıyor | Test 13 modülün 13'ünü de `./<modul>/index.js` olarak içe alıyor; sahte olan yalnızca `ModelTasiyici` |
| Üretilen belgeler şemadan geçiyor | Test içinde `arac/sema-dogrula.js --dosya` çağrısı; çıkış kodu 0 değilse test düşüyor |
| Öldürülüp sürdürülünce yan etki tekrarlanmıyor | `node --test src/kabul-kosusu.test.js` → 3/3 geçti; ilk test tam olarak bunu kuruyor (koşu ortasından öldürme → `kosuyu_surdur`) |
| Kapı | `npm test` **142/142**, `npm run kapi` temiz |

Üçüncü test ayrıca özetin (sha256) sözleşmenin **o hâline** bağlandığını
sınıyor: sözleşme değişirse eski onay geçersiz. İ3'ün K6 önerisinin
(izni bileşen sürümüne bağla) uygulamadaki karşılığı.

## Karar

U14 **bitti**. Faz 5 tamamlandı: U0–U15'in on altısı da kapalı, 142 test
geçiyor, yapı doğrulaması temiz. Yol haritasında yalnızca "Sürekli"
başlığındaki araştırma turu maddesi açık — o bilerek hiç kapanmayan madde.
