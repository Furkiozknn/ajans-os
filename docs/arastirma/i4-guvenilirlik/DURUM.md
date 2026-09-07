# İ4 — durum: YARIM (bütçe)

*7 Eylül 2026, 22:15 · koşu bütçesi 6 USD, ~4,2 USD harcandığında durduruldu*

Bu iz **bitmedi**. Yol haritasındaki kutucuk bilerek boş bırakıldı.
Sonraki tur bu dosyayı ilk okusun; **aşağıdaki iki projeyi tekrar incelemesin.**

## Bitmiş olanlar

| Proje | Dosya | Alıntı | Otomatik doğrulama |
|---|---|---|---|
| langchain-ai/langgraph | [langgraph.md](langgraph.md) | 72 | 51 TAM · 7 YAKIN · 10 VAR · 4 şüpheli |
| temporalio/sdk-python | [temporal.md](temporal.md) | 59 | 50 TAM · 0 YAKIN · 9 VAR · 0 şüpheli |

Toplam %96 (112 doğrulanabilir alıntının 108'i). Rapor:
[DENETIM-otomatik.md](DENETIM-otomatik.md).

Dört "şüpheli"nin ikisi elle kontrol edildi ve **doğru çıktı** — aracın
Türkçe düzyazıyı token sanmasından kaynaklanan yanlış alarm:

- `_loop.py:960-971` → `self._put_checkpoint({"source": "fork"})` satır 971'de,
  "zaman yolculuğu yeni dal yazar, eskisini silmez" iddiası doğrulandı.
- `main.py:2968` → `[t for t in loop.tasks.values() if not t.writes]`,
  "yazması olan görev yeniden çalıştırılmaz" iddiası doğrulandı.

Kalan iki şüpheli (`_loop.py:687`, `_loop.py:733-745`) elle bakılmadı.

## Yapılacaklar (sonraki tur)

Klonlar **hazır**, `D:/Repolar/_inceleme/` altında; yeniden klonlama:

1. `dbos-transact-py` — DBOS Transact (1.563 yıldız, MIT, son push 2026-09-04).
   Tohum listesinde **olmayan** aday. Odak: Postgres tablosunda tutulan
   adım-bazlı checkpoint (`workflow_status` / `operation_outputs`), "her
   adım en az bir kez" garantisi, recovery sırasında tamamlanmış adımın
   sonucunun tablodan okunması. LangGraph'ın snapshot'ı ve Temporal'ın
   event log'u ile üçüncü bir nokta: **kalıcı adım-sonucu tablosu**.
2. `dspy` (37.833 yıldız, MIT) — `Refine` / `BestOfN` modülleri, eski
   `Assert`/`Suggest` mekanizmasının kaldırılma gerekçesi, ödül fonksiyonu
   ile öz-düzeltme. Değerlendirici/eleştirmen ekseninin ana kanıtı.
3. `instructor` (13.836 yıldız, MIT) — Pydantic doğrulama hatasını modele
   geri besleyen retry döngüsü (`max_retries`), doğrulama hatası
   mesajının prompt'a nasıl girdiği.
4. `reflexion` (3.262 yıldız, MIT, son push 2025-01-14 → **tarihî
   referans**, canlılık kuralını geçmez) — sözlü öz-eleştirinin epizodik
   belleğe yazılması; fikrin kökeni olarak, canlı aday olarak değil.
5. `portkey-gateway` (12.922 yıldız, MIT, son push 2026-05-25 → 105 gün,
   **tarihî referans**) — tohum listesinde olmayan ikinci aday. Fallback
   zinciri, koşullu yönlendirme, devre kesici (circuit breaker).
6. Hepsi bitince `OZET.md` (protokol §4: yedi başlık) ve ardından
   **ayrı bir koşuda** `DENETIM.md`.

## İncelenmeyenler ve nedeni

- **restatedev/restate** — canlı (son push 2026-09-07) ve event-log/journal
  durum modeli için çok uygun, ama lisansı OSI değil (GitHub API
  `NOASSERTION`, BUSL). Protokol §1 canlılık kuralı OSI lisansı şart
  koşuyor → aday dışı.
- **microsoft/autogen** — son push 2026-04-15 (145 gün), canlılık kuralını
  geçmiyor; ayrıca depo lisansı `CC-BY-4.0` görünüyor. Eleştirmen deseni
  için istenirse tarihî referans olarak açılabilir.
- **Self-Refine, LATS** — bütçe; Reflexion ile aynı aileden, sonraki turda
  Reflexion'la birlikte tek dosyada karşılaştırmalı ele alınabilir.

## Bu turda öğrenilen (özete girecek çekirdek)

İki proje bile şu ayrımı net gösterdi — İ4'ün ana sorusunun cevabı:

- **Durum modeli iki farklı yola ayrılıyor.** LangGraph superstep sonunda
  kanalların **tam kopyasını** yazıyor (`base/__init__.py:278`), depolamada
  kanal-versiyon blob'larıyla sıkıştırıyor; Temporal hiç snapshot almıyor,
  **event history'yi yeniden oynatıyor** ve tamamlanmış aktivitenin
  sonucunu tekrar hesaplamak yerine geçmişten okuyup future'a enjekte
  ediyor (`_workflow_instance.py:875`). Aynı problemin iki zıt çözümü.
- **Hiçbiri gerçekten "geri almıyor".** LangGraph zaman yolculuğunda eski
  checkpoint'i silmiyor, yeni bir **dal** açıyor (`_loop.py:971`,
  `{"source": "fork"}`); yan etki telafisi yok (`grep -rn compensat` →
  sıfır). Temporal'da da telafi motorun değil geliştiricinin işi (saga
  deseni SDK'da yok). Yani ikisinde de **rollback = durumu geri sar +
  yeniden dene**, dünyayı geri alma değil. Bu, mimarimizde "rollback"
  kelimesini kullanmadan önce karara bağlanmalı.
- **Kısmi ilerlemeyi kaybetmemek ayrı bir mekanizma istiyor.** LangGraph
  `put_writes()` ile her görev biter bitmez yazıyor, resume'de yazması
  olan görevi atlıyor (`main.py:2968`); Temporal aynı ihtiyacı
  `heartbeat_details` ile aktivite **içinde** çözüyor
  (`_activity.py:583-594`). İkisi de "adım tamamlandı" bilgisini adım
  sınırından daha ince bir granülerlikte saklıyor.
