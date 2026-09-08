# ADR-001 — Çekirdek bileşen kümesi: 13 girer, 5 aday kalır

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ1 … İ6 (hepsi; kaynak Faz 2'nin üç sentez belgesi)
**Yeniden açılma koşulu:** Aday listesindeki bir bileşenin K2 maddesi
dolarsa (her biri için "ne olursa girer" `docs/mimari/00-BLUEPRINT.md` §4'te
yazılı), veya giren bir bileşenin Faz 4'te kendi başına test edilemediği
görülürse (AP7 kuralı 8).

## Bağlam

Yol haritası Faz 3'ün ilk maddesi 18 aday bileşen sayıyordu. ADR-000 K2
"her şeyi ekle" yasağını koyar: dört madde (çözdüğü problem / önlediği hata /
eklediği maliyet / kanıt) yazılamayan bileşen mimariye girmez.

Girdi, Faz 2'nin üç belgesidir: `docs/01-KARSILASTIRMA-MATRISI.md` (40 proje),
`docs/02-EN-IYI-FIKIRLER.md` (K2'yi geçen 13 desen + geçemeyen 7 aday) ve
`docs/03-ANTI-PATTERNLER.md` (11 anti-pattern + 12 bağlayıcı kural). Bu ADR,
18 adayın her birine K2'yi tek tek uygular.

## Seçenekler

### S1 — 18 bileşenin hepsini al, boş K2 maddelerini "Faz 4'te doldururuz" diye bırak
- Nasıl çalışır: yol haritasındaki liste doğrudan mimari olur.
- Görüldüğü yer: matriste genişletilebilirlik 5 alan çatılar (LangGraph, graphrag) — hepsi güvenlikte 2 alıyor.
- Artı: hiçbir ihtiyaç gözden kaçmaz; sonraki fazlarda "bu yok" sürprizi olmaz.
- Eksi: K2'nin varlık sebebini ortadan kaldırır; her bileşen bir arıza yüzeyi.
- Maliyet: 18 modülün bakımı, 18 arayüz, kanıtsız beşinin gerekçesi hiç yazılamaz.

### S2 — K2'yi harfiyen uygula; geçemeyeni "aday" listesine düşür
- Nasıl çalışır: her aday için dört madde yazılmaya çalışılır; biri boşsa bileşen girmez ama silinmez — hangi maddenin boş olduğu ve "ne olursa girer" kaydedilir.
- Görüldüğü yer: `docs/02-EN-IYI-FIKIRLER.md` §4 bu yöntemi desen düzeyinde zaten uyguladı (7 fikir elendi, ikisi iz özetlerinin "alınmalı" dediği fikirlerdi).
- Artı: her bileşenin varlık gerekçesi kayıtlı; dışarıda kalanın da geri dönüş yolu var.
- Eksi: mimari ilk bakışta eksik görünür (planlayıcısı olmayan bir ajan sistemi).
- Maliyet: her aday için ayrı gerekçe yazma yükü; bilinçli zayıflıkları kabul etme.

### S3 — Bileşen kümesini Faz 4'e ertele, blueprint'i yalnızca veri akışı olarak yaz
- Artı: karar geciktirilir, daha çok kanıt beklenir.
- Eksi: K1 sırasını bozar — Faz 4 "her çekirdek bileşen için arayüz" istiyor, bileşen listesi olmadan yazılamaz.
- Maliyet: bir tur kayıp, ve kararsızlık Faz 4'e taşınır.

## Karar

**S2.** Ölçüt K2'nin kendisidir ve ADR-000'de kabul edilmiştir; bu ADR onu
uygulamaktan ibarettir. S1, K2'yi yazılı ama uygulanmaz hâle getirirdi —
`docs/03-ANTI-PATTERNLER.md` AP3'ün ("beyan edilen garantinin kodda karşılığı
yok") kendimize dönük hâli olurdu. S3, K1 sırasını bozar.

**Giren 13:** Orchestrator, Task Manager, Agent Registry, Tool Registry,
Permission Manager, Memory Manager, Context Manager, Evaluator, Critic,
Recovery Manager, Model Router, Cost Manager, Observability.

**Girmeyen 5:** Planner (kanıt boş — ayrı planlayıcı bileşen için yinelenen
desen yok), Router/görev→ajan (İ1 D5 tam tersini söylüyor: yönlendirme adım
çıktısının bir alanı), Knowledge Layer (problem boş — 02 §4/A3), Security-
Guardrails ayrı motor olarak (maliyet ve kanıt boş — sandbox bu makinede
uygulanamaz, detektörlerde ikinci olgun kaynak yok), Learning Layer (kanıt boş —
İ6'nın K7 sonucu: üretimde çalışan tek örnek yok).

Gerekçelerin tamamı ve "ne olursa girer" maddeleri
`docs/mimari/00-BLUEPRINT.md` §2 ve §4'tedir.

## Dahil etme ölçütü (ADR-000 K2)

Bu ADR bir bileşen eklemiyor; **bileşen ekleme kuralını uyguluyor.** Yine de
kendi K2'si:

| | |
|---|---|
| Çözdüğü problem | 18 aday bileşenin hangilerinin gerçekten gerekli olduğunun kararsız kalması; Faz 4 arayüz yazamaz. |
| Önlediği hata | *Kanıtsız bileşen şişmesi* — matrisin en net çelişkisi (genişletilebilirlik ↔ güvenlik: LangGraph 5/2, Mastra 4/2, graphrag 5/2) tam olarak bu hatanın ölçülmüş hâli. |
| Eklediği maliyet | Beş bilinçli zayıflık: hedef→görev dönüşümünü insan yapar, tek güvenlik sınırı Permission Manager'dır, graf sorgusu yoktur, öğrenme elle (`BILINEN-TUZAKLAR.md`) yürür. |
| Kanıt (≥2 olgun proje veya yaşadığımız arıza) | Yöntem kanıtı: 02 §4 aynı eleme desen düzeyinde uygulandı ve iki "alınmalı" denen fikri düşürdü. Arıza kanıtı: `BILINEN-TUZAKLAR.md` #15/#16/#18 — kapsamı daraltmayan her tur bütçeyi sonuna kadar kullandı. |

## Sonuçlar

**Olumlu:** Faz 4 tam olarak 13 arayüz yazar, ne eksik ne fazla. Her bileşenin
"bu neden var" cevabı bir K2 tablosudur. Dışarıda kalan beşi kaybolmadı; geri
dönüş şartı yazılı.

**Olumsuz / kabul edilen bedel:** Planner yokken görev dosyalarını insan yazar
(bugünkü `gorevler/bekleyen/` akışı zaten böyle). Guardrails yokken prompt
enjeksiyonuna karşı tek savunma Permission Manager'ın kapsam sınırlarıdır —
bu bilinçli bir zayıflıktır ve `docs/mimari/00-BLUEPRINT.md` §4.4'te kayıtlı.

**Etkilenen sözleşmeler:** `contracts/agent.schema.json` — değişmiyor; giren 13
bileşenin hiçbiri yeni bir zorunlu alan gerektirmedi. `task.schema.json`,
`message.schema.json`, `permission.schema.json` bu kümeden türeyecek.

**Etkilenen diğer ADR'ler:** ADR-002 … ADR-005 bu kümenin üstüne kurulur.
ADR-000 K2 ilk kez bileşen düzeyinde uygulandı; K7 (öğrenme döngüsü) bu ADR ile
**ertelendi**, çürütülmedi.

## Uygulama notu

Faz 4'te `src/` iskeleti tam 13 modül klasörü içerir; on dördüncü bir klasör
açmak bu ADR'yi yeniden açmayı gerektirir.

Test edilebilir ölçüt: "`src/` altındaki modül klasörü sayısı 13'tür ve her
birinin adı `docs/mimari/00-BLUEPRINT.md` §2'deki bir başlıkla birebir eşleşir"
geçiyorsa karar uygulanmıştır.
