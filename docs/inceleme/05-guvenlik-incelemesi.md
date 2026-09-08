# Güvenlik mimarisi — bağımsız inceleme

**Tarih:** 08.09.2026 15:12 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/mimari/05-GUVENLIK.md`, `contracts/permission.schema.json` (koşu 89c75e9)

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Alıntı izlenebilirliği | 16/16 birebir |
| `permission.schema.json` | Geçerli JSON, 21 alan / 14 zorunlu, `additionalProperties: false` |
| Üç değerli karar | `ALLOW` / `BLOCK` / `HUMAN_REQUIRED` şemada mevcut — blueprint §2.5 ile birebir |
| `arac/sema-dogrula.js --test` | Temiz (dört şema birlikte) |
| AP1 kuralı 1 (sabit sınır config'ten okunmaz) | Belgede açık: "kapsamsız yazma izni diye bir kayıt yazılamaz", `reliability: kontrol-edilmedi` iken `ALLOW` yazılamaz — **şema `if/then` ile zorluyor**, yalnızca metinde değil |

## Değerlendirme

**Güçlü yan: kural şemaya inmiş.** İ3'ün K6 değişiklik önerisi (izni bileşenin
sürümüne bağlama) ve D11 ("denetlenmedi ≠ temiz") burada `if/then` kuralı
olarak yaşıyor: doğrulanmamış bir bileşene `ALLOW` yazmak şema düzeyinde
geçersiz. Bu, AP3'ün ("garanti cümlesi kodun sağladığından fazlasını söyler")
tam tersi bir davranış.

**Güçlü yan: kapanmayan yerler yazılı.** §9 sandbox'ın bu makinede
uygulanamadığını (KVM yok, Windows) ve prompt enjeksiyonuna karşı tek
savunmanın kapsam sınırları olduğunu kabul ediyor. ADR-001'in "Guardrails
mimariye girmedi" kararıyla tutarlı ve bilinçli zayıflık olarak kayıtlı.

**Not: sır enjeksiyonu tasarım aşamasında.** §5 proxy süreç / ayrı kullanıcı
hesabı seçeneklerini tartışıyor ama seçim Faz 4'e bırakılmış. Bu, sabit
sınırla (ajan kimlik bilgisi görmez) doğrudan ilgili olduğu için Faz 4'ün ilk
sıralarında olmalı; uygulama yol haritası maddesi bunu sıralayacak.

## Karar

Güvenlik mimarisi **kullanılabilir**. Açık iş yok; sır enjeksiyonu seçimi
Faz 4'e devredilmiş ve belgede işaretli.
