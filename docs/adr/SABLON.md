# ADR-NNN — <Kararın kısa adı>

**Durum:** Önerildi | Kabul edildi | Yeniden açıldı | Reddedildi | Yerini aldı: ADR-MMM
**Tarih:** YYYY-AA-GG
**İlgili izler:** İ1 … İ6 (hangi araştırma izleri bu kararı besledi)
**Yeniden açılma koşulu:** <Hangi bulgu bu kararı çürütür — somut yaz>

## Bağlam

Hangi problem, hangi koşullar altında. Kararı zorlayan gerçek durum.
Araştırma bulgularına dosya yoluyla atıf: `docs/arastirma/i4-guvenilirlik/langgraph.md`
gibi. Bağlamı olmayan karar, keyfi karardır.

## Seçenekler

En az iki seçenek; tercihen üç. Her biri için:

### S1 — <ad>
- Nasıl çalışır (2–4 cümle)
- Hangi projelerde görüldü (kanıt bağlantısı)
- Artı
- Eksi
- Maliyet: karmaşıklık / gecikme / token / bakım

### S2 — <ad>
…

## Karar

Hangi seçenek ve **neden**. "Daha iyi" yetmez; hangi ölçütte, hangi
kanıtla. Diğer seçeneklerin neden elendiğini bir cümleyle yaz.

## Dahil etme ölçütü (ADR-000 K2)

Bu karar bir bileşen ekliyorsa dördü de dolu olmalı; biri boşsa
bileşen mimariye girmez, "aday" listesine düşer.

| | |
|---|---|
| Çözdüğü problem | |
| Önlediği hata sınıfı | |
| Eklediği maliyet | |
| Kanıt (≥2 olgun proje veya yaşadığımız bir arıza) | |

## Sonuçlar

**Olumlu:**
**Olumsuz / kabul edilen bedel:**
**Etkilenen sözleşmeler:** `contracts/<ad>.schema.json` — hangi alan değişiyor
**Etkilenen diğer ADR'ler:**

## Uygulama notu

Faz 5'te bu karar hangi modülde, hangi arayüzle somutlaşır.
Test edilebilir ölçüt: "<şu test> geçiyorsa karar uygulanmıştır".
