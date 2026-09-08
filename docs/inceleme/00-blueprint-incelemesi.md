# Mimari blueprint + ADR-001…005 — bağımsız inceleme

**Tarih:** 08.09.2026 14:00 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/mimari/00-BLUEPRINT.md` ve `docs/adr/ADR-001…005` (koşu c5f4034 + 612da96, 16 dk, ~4,8 USD)

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Alıntı izlenebilirliği (`arac/iz-izle.js`) | ADR-002 1/1, ADR-003 7/7, ADR-004 2/2, ADR-005 2/2 **birebir**; ADR-001 alıntı içermiyor (bileşen kararı, kod alıntısı gerekmiyor) |
| Belge içi atıflar | 27 iç atıf, **kırık yok**. `contracts/{task,message,permission}.schema.json` henüz yok ama ADR'ler bunları "türeyecek" diye işaretliyor (Faz 4 işi) |
| Bileşen sayısı tutarlılığı | Blueprint §2'de **13** alt başlık, §4'te **5** dışarıda kalan; ADR-001'in "13 girer, 5 kalır" başlığıyla birebir |
| "Ne olursa girer" | Dışarıda kalan 5 bileşenin **hepsinde** var (7 geçiş: ikisi ADR metninde) |
| Şablon uyumu | Beş ADR de `SABLON.md` başlıklarını (Bağlam / Seçenekler / Karar / K2 / Sonuçlar / Uygulama notu) eksiksiz taşıyor; her birinde "yeniden açılma koşulu" yazılı |

## İçerik değerlendirmesi

**Güçlü yan: K2 gerçekten eledi.** 18 adayın 5'i dışarıda kaldı ve gerekçeler
somut: Planner için "kanıt boş", Knowledge Layer için "problem boş", Learning
Layer için İ6'nın olumsuz bulgusu (üretimde çalışan tek örnek yok). Faz 2'de
desen düzeyinde uygulanan eleme, bileşen düzeyinde de uygulanmış. Bu, ADR-000
K2'nin süs değil ölçüt olduğunun ikinci kanıtı.

**Güçlü yan: bilinçli zayıflıklar yazılı.** Guardrail motoru yokken prompt
enjeksiyonuna karşı tek savunmanın Permission Manager olduğu §4.4'te açıkça
kabul ediliyor. Bu, AP3'ün ("beyan edilen garantinin kodda karşılığı yok")
kendimize uygulanmış hâli.

**Doğrulanan kanıt bağları.** Her bileşenin K2 tablosundaki kanıt satırı
Faz 2'nin desen/anti-pattern numaralarına (D1, D5, D6, D11, D12, AP1, AP7,
AP9) bağlı; bu numaralar 02 ve 03 belgelerinde denetlenmişti (88/88 ve 32/32
alıntı birebir). Zincir dört halka: klon → iz özeti → Faz 2 sentezi → mimari.

**Dikkat: `src/` 13 modül ölçütü.** ADR-001'in test edilebilir ölçütü
"`src/` altındaki modül klasörü sayısı 13'tür". Depoda `src/` şu an boş
iskelet; Faz 4 bunu yazacak. Ölçüt iyi ama **şu an geçmiyor** — Faz 4
kapanana kadar ADR-001 "uygulandı" sayılmamalı.

**Dikkat: Cost Manager ile bütçe duvarı.** Blueprint bütçe taşmasını D10'a
(planlanmış faz geçişi) bağlıyor. Bu makinede yaşanan arıza tam da buydu
(`BILINEN-TUZAKLAR.md` #7). Faz 4'te Cost Manager'ın ilk testi, 6 USD'lik
görev bütçesinde kısmi çıktının yazılabildiğini göstermeli.

## Karar

Blueprint ve beş ADR **Faz 3'ün geri kalanı için sağlam bir temel**. Bir
sonraki mimari belgeleri (Agent, Orchestration, Memory, Evaluation, Security,
Observability, Self-improvement) bu 13 bileşenin üstüne yazılabilir. Açık iş
yok; iki "dikkat" maddesi Faz 4'e taşınan doğrulama ölçütleri.
