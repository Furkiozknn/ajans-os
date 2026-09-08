# ADR-003 — İlerleme kaydı: adım-sonucu tablosu ve "başladı" kaydı

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ4 (birincil), İ1, İ6
**Yeniden açılma koşulu:** Adım başına iki yazmanın gecikmesi ölçülür ve adım
süresinin %5'ini aşarsa; veya denetim izi (kim ne zaman neyi değiştirdi)
ihtiyacı doğar ve adım-sonucu tablosu bunu karşılayamazsa → event log yeniden
değerlendirilir.

## Bağlam

`docs/02-EN-IYI-FIKIRLER.md` §7'nin ilk üç açık sorusu tek bir mekanizmaya
bakıyor:

1. Kayıt birimi adım-sonucu tablosu mu, event log mu? (İ4 Ö1 tabloyu öneriyor;
   İ6'nın dört projesi event log kullanıyor.)
2. "Başladı" checkpoint'inin maliyeti (her adımda iki yazma) kabul edilecek mi?
3. Onay sonrası yan etki tekrarı nasıl önlenecek? (LangGraph'ın kusuru
   `types.py:864` bizde tekrarlanmamalı.)

D1 bu izin en güçlü sinyali: 12 olgun proje, 4 bağımsız iz. Ama İ4'ün bulgusu
daha ince — durum modeli üç yola ayrılıyor: tam snapshot, event log + replay,
adım-sonucu tablosu. Ve 02 §5/K1: ekosistemin **hiçbirinde** "bu adım başlamıştı,
yarım kaldı" ayrımı yok; çökme sonrası "hiç başlamadı" ile "başladı, bitmedi"
aynı görünüyor.

## Seçenekler

### S1 — Tam snapshot
- Nasıl çalışır: her adım sınırında yürütme durumunun tamamı serileştirilip yazılır.
- Görüldüğü yer: LangGraph `BaseCheckpointSaver` (`libs/checkpoint/langgraph/checkpoint/base/__init__.py:177`), Mastra workflow snapshot, OpenAI Agents SDK `RunState` (`run_state.py:1776-2256`).
- Artı: devam etmek için tek kayıt yeter; en basit geri yükleme.
- Eksi: durumun tamamı her adımda yazılır; asıl durumumuz (görev grafı, ajan çıktıları) zaten kalıcı dosyalarda yaşadığı için çoğu yazma tekrar.
- Maliyet: yazma boyutu adım sayısıyla değil durum boyutuyla büyür.

### S2 — Event log + deterministik replay
- Nasıl çalışır: her olay yazılır, durum olayların yeniden oynatılmasıyla kurulur.
- Görüldüğü yer: Temporal (`_workflow_instance.py:875-921`), Dapr Agents (`strategy.py:20`), İ6'nın dört projesi.
- Artı: tam denetim izi; "hangi karar hangi anda" sorusu bedavaya cevaplanır.
- Eksi: kullanıcı koduna **determinizm yükümlülüğü** bindirir — bir LLM ajanı doğası gereği deterministik değildir. Bu gerekçeyle `docs/02-EN-IYI-FIKIRLER.md` §4/A4 zaten elendi.
- Maliyet: replay motoru + determinizm ihlallerinin tespiti (DBOS ihlali yalnızca adım *adı* değişirse yakalıyor — 03 §4'ün "sessizlik" eleştirisi).

### S3 — Adım-sonucu tablosu (birincil anahtar = çalıştırma_id + adım_id)
- Nasıl çalışır: her adım için tek satır; adım başlarken yazılır, biterken güncellenir. Devam ederken tamamlanmış adımlar atlanır.
- Görüldüğü yer: DBOS (`_core.py:2551-2567` — tek upsert + tek SELECT), LangGraph'ın `put_writes()` tarafı (`_runner.py:608-611`).
- Artı: en ucuzu; asıl durum zaten dosyalarda yaşadığı için yeterli.
- Eksi: tam denetim izi vermez (yalnızca son hâl); gövdenin yeniden çağrılabilir olmasını gerektirir.
- Maliyet: adım başına bir (veya "başladı" ile iki) yazma.

## Karar

**S3 — adım-sonucu tablosu**, İ4 Ö1'in önerisi doğrudan alınarak. Ölçüt:
asıl durumumuz (görev grafı, ajan çıktıları, üretilen belgeler) zaten kalıcı
dosyalarda yaşıyor; tekrar kalıcılaştırılması gereken tek şey **hangi adımın
tamamlandığı**. S1 aynı bilgiyi çok daha pahalı yazar; S2'nin bedeli olan
determinizm yükümlülüğü 02 §4/A4'te zaten kabul edilemez bulundu.

**LangGraph'ın `put()` / `put_writes()` ayrımı korunur:** görev durumu ile adım
bazlı ilerleme **ayrı** yazılır (`_runner.py:608-611`). Birini güncellemek
diğerini kilitlemez.

**Soru 2 — "başladı" kaydı: maliyet kabul edilir.** Her adım sınırında iki
yazma yapılır (`BASLADI` → `BITTI`). Gerekçe oran: ajan adımlarımız pahalı
(LLM tokenı) ve yan etkili (dosya yazma); bir disk yazması bunun yanında
ölçülemeyecek kadar ucuz. `BASLADI` kaydı **yan etkiden önce** yazılır; aksi
hâlde kaydın hiçbir anlamı kalmaz. Kanıt ikinci daldan: `BILINEN-TUZAKLAR.md`
#7 (bütçe duvarı, beş görev), #13 (yarış durumu), #20 (kapanışta başkasının
yarım işini süpürme) — üçü de bu ayrımın yokluğundan doğdu.

**Soru 3 — onay sonrası yan etki tekrarı.** `ONAY_BEKLIYOR`, `BASLADI` kaydı
yazıldıktan **sonra** girilen bir durumdur. Onay geldiğinde adım baştan
çalıştırılmaz; kayıttaki `BASLADI` görülür ve yalnızca onaya bağlı eylem
yürütülür. Bu, LangGraph'ın `interrupt()` sonrası düğümü baştan çalıştırma
kusurunun (`types.py:864`) doğrudan çaresidir. Somut kural: **onay kapısından
geçen bir çağrı, kapıdan önce yapılmış hiçbir yan etkiyi tekrarlamaz.**

Kayıttaki durum kümesi: `PLANLANDI`, `BASLADI`, `GIRDI_BEKLIYOR`,
`ONAY_BEKLIYOR`, `BITTI`, `BASARISIZ`. `GIRDI_BEKLIYOR` ile `ONAY_BEKLIYOR`
ayrı tutulur (A2A `a2a.proto:206-207`); ikisi de **kesintilidir** — süreç
ölebilir, akış olayla canlanır.

## Dahil etme ölçütü (ADR-000 K2)

| | |
|---|---|
| Çözdüğü problem | Süreç ortada ölünce yapılan işin yok olması; ve kesilen bir adımın yan etki bırakıp bırakmadığının bilinmemesi. Somut: bütçe duvarı bir ajan çağrısının ortasında vurursa, o çağrının dosya yazıp yazmadığı bugün kayıtta yok. |
| Önlediği hata | *Yeniden başlatma amnezisi* (tamamlanmış token maliyetinin ikinci kez ödenmesi) ve *yan etkinin sessiz tekrarı* (yarım kalmış işlemin ikinci kez yapılması). |
| Eklediği maliyet | Adım başına iki yazma (I/O + gecikme); adım gövdesinin yeniden çağrılabilir olması şartı; tam denetim izinden feragat — "hangi karar hangi anda" sorusu ancak Observability izlerinden cevaplanır. |
| Kanıt (≥2 olgun proje veya yaşadığımız arıza) | D1: 12 olgun proje, 4 iz; tablo yolu için DBOS (olgunluk 5) ve LangGraph (5). "Başladı" kaydı için ekosistemde **sıfır** örnek — ikinci dal kullanıldı: `BILINEN-TUZAKLAR.md` #7, #13, #20. |

## Sonuçlar

**Olumlu:** Kesilen bir koşu, tamamlanmış adımları tekrar ödemeden devam eder.
Yarım kalmış adım görünür olur ve elle incelenebilir. Onay bekleyen akış süreci
canlı tutmaz — gece otonomisi için belirleyici.

**Olumsuz / kabul edilen bedel:** Tam denetim izi yok. Adım gövdesi yeniden
çağrılabilir yazılmak zorunda; bu, bileşen yazarına düşen bir yükümlülüktür ve
03 §4'ün "sessizlik" eleştirisine düşmemek için **açıkça** belgelenir.

**Etkilenen sözleşmeler:** `contracts/task.schema.json` — durum kümesi, adım
kaydı alanları (`calistirma_id`, `adim_id`, `durum`, `baslama`, `bitis`,
`sonuc_ozeti`, `hata_turu`). `hata_turu` D7 gereği serbest metinden ayrı,
makine-okur bir alandır.

**Etkilenen diğer ADR'ler:** ADR-002 (döngü sınırları burada yazılır),
ADR-004 (Evaluator sonucu adım kaydına düşer), ADR-005 (`ONAY_BEKLIYOR`
kapısının karşı tarafı).

## Uygulama notu

Faz 5'te `src/task_manager/`; kayıt tek bir SQLite tablosu veya JSONL dosyası
(seçim Faz 4'ün işi, bu ADR biçimi değil **birimi** sabitler).

Test edilebilir ölçüt: "bir adımın ortasında süreç öldürülür; yeniden
başlatıldığında o adım `BASLADI` durumunda bulunur, tamamlanmış önceki adımlar
tekrar çalıştırılmaz ve onay kapısından geçen çağrı önceki yan etkisini
tekrarlamaz" testi geçiyorsa karar uygulanmıştır.
