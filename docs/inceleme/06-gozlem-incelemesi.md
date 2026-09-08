# Gözlemlenebilirlik mimarisi — bağımsız inceleme

**Tarih:** 08.09.2026 15:26 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/mimari/06-GOZLEM.md`, `contracts/span.schema.json` (koşu c37c59f)

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Alıntı izlenebilirliği | 28 alıntının **27'si birebir**, 1 yakın (kesişen satır aralığı) — uydurma yok |
| `contracts/span.schema.json` | Geçerli JSON; `arac/sema-dogrula.js --test` beş şemayla birlikte temiz |
| 04'ün dört sayacı | `degerlendirilmedi_orani`, `mutant_yakalama_orani`, `retry_sonrasi_gecti_orani`, `kapi_maliyeti` — **dördü de** bu belgede karşılanıyor; değerlendirme belgesinin "Observability taşımalı" borcu kapandı |
| OTel GenAI bağı | 41 yerde `gen_ai.*` / semconv atfı — İ5'in birincil kaynağına dayanıyor, kendi alan adı icat edilmemiş |

## Değerlendirme

**Güçlü yan: "span doğruluk kaynağı değildir" kararı.** İz, kararın kendisi
değil kaydı; doğruluk kaynağı Task Manager'ın kalıcı kaydı. Bu ayrım AP5'in
("sinyal ile karar arasındaki bağ ters kurulur") doğrudan çaresi: gözlem
katmanı düşerse sistem yanlış karar vermez, yalnızca kör kalır.

**Güçlü yan: sekiz sayacın her birinin tüketicisi adlandırılmış** (§6).
Kural 6'nın ("her sinyalin bir tüketicisi ve bir yetki seviyesi vardır")
ikinci uygulaması; 04-DEGERLENDIRME'deki dört sayaç bunun alt kümesi olarak
oturuyor, ikinci bir sayaç kümesi icat edilmemiş.

**Güçlü yan: şemanın göremediği kurallar ayrı başlıkta** (§8). Şema ile
disiplin arasındaki farkı açıkça yazmak, AP3'e karşı bu belgelerde tekrar
eden refleks hâline geldi.

**Not: içerik kaydı ve PII.** §9 prompt/çıktı içeriğinin ize girip
girmeyeceğini tartışıyor; bellek belgesindeki PII kuralıyla (AP9 → kural 10)
kesişiyor. İki belgenin kesişimi Faz 4'te tek bir uygulama kararına
bağlanmalı — takip maddesi olarak işaretliyorum.

## Karar

Gözlemlenebilirlik mimarisi **kullanılabilir**. Faz 3'ün yedi belgesinden
altısı bitti; kalan tek belge öz-gelişim mimarisi.
