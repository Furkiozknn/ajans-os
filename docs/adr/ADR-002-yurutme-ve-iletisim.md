# ADR-002 — Yürütme modeli ve bileşenler arası iletişim

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ1 (birincil), İ4
**Yeniden açılma koşulu:** Bir bileşenin testi başka bir bileşeni başlatmadan
koşturulamıyorsa (kural 8 ihlali), veya paralel adımların aynı alana yazması
tek yürütücü modelinde çözülemezse.

## Bağlam

`docs/mimari/00-BLUEPRINT.md` 13 bileşen tanımlıyor. Bunların birbirini nasıl
çağıracağı ayrı bir karardır ve iki anti-pattern doğrudan buraya bakıyor:
AP7 (çekirdek tek dosyada birikir, 2 iz / 6 proje) ve AP2 (aynı kararın ikinci
uygulaması, 4 iz / 4 proje). İ1 §6'nın iki açık sorusu da burada: yürütme modeli
graf mı rol tabanlı mı (S1), paralel yazma çakışması nasıl çözülür (S3).

## Seçenekler

### S1 — Olay veriyolu (event bus): bileşenler olay yayınlar, ilgilenen dinler
- Nasıl çalışır: Orchestrator bir olay yayınlar; Permission Manager, Evaluator, Observability kendi ilgilerine göre tepki verir.
- Görüldüğü yer: Dapr Agents'ın pub/sub tabanlı mesajlaşması (`durable.py` activity sınırları), Mastra'nın workflow olayları.
- Artı: bileşenler birbirini hiç tanımaz; yeni dinleyici eklemek çekirdeğe dokunmaz.
- Eksi: akışın nerede olduğu hiçbir yerde yazmaz; "onay bekleniyor mu, bekleniyorsa kim bekliyor" sorusu izleri okumadan cevaplanamaz.
- Maliyet: veriyolu altyapısı + teslim garantisi + sıralama garantisi; Dapr yolunda sidecar ve state store (02 §4/A4'te maliyeti kabul edilemez bulundu).

### S2 — Tek yürütme döngüsü: Orchestrator çağırır, bileşenler birbirini çağırmaz
- Nasıl çalışır: adım döngüsünün sahibi tektir. Her bileşen saf bir fonksiyon gibi çağrılır (girdi sözleşmesi → çıktı sözleşmesi) ve başka bileşene erişimi yoktur. Observability tek yönlü dinleyicidir; ona yazmak akışı etkilemez.
- Görüldüğü yer: LangGraph Pregel superstep döngüsü (`pregel/_loop.py:599`), OpenAI Agents SDK `Runner` (`run.py`), Strands event loop. İ1'in yedi projesinden beşinde çekirdek tek bir döngü.
- Artı: akış tek yerde okunur; her bileşen tek başına test edilebilir (kural 8); AP2'nin "ikinci uygulama" tuzağı yapısal olarak imkânsızlaşır çünkü karar noktası tek.
- Eksi: Orchestrator büyür — AP7 riski tam burada.
- Maliyet: Orchestrator'ın satır sayısına bilinçli bir tavan koymak ve her yeni yeteneği bileşene, döngüye değil, eklemek.

### S3 — Ajan döngüsünü workflow motorunun bir örneği yap (Mastra yolu)
- Nasıl çalışır: ajan çalıştırma, genel workflow motorunun özel bir hâli olur; suspend/resume/retry/snapshot bedavaya gelir.
- Görüldüğü yer: Mastra (`loop/loop.ts`) — İ1 §3'ün tespiti: "B, suspend/resume/retry/snapshot'ı bedavaya alıyor; A daha basit ama aynı ilkelleri iki yerde yazmaya zorluyor".
- Artı: ilkeller tek yerde.
- Eksi: motoru karmaşıklaştırır; Mastra matriste olgunluk 3, mimari netlik 3 — İ1'in en düşük iki puanlı çatısı.
- Maliyet: genel bir workflow motoru yazmak, ajan çalıştırmaktan önce.

## Karar

**S2 — tek yürütme döngüsü, Orchestrator merkezli, bileşenler arası doğrudan
çağrı yok.**

Ölçüt kural 8'dir: *"bileşenin testi diğer bileşenleri başlatmadan koşar; modül
sınırının tek geçerli kanıtı budur."* S2 bunu yapısal olarak garanti eder;
S1'de Permission Manager'ı test etmek veriyolunu ayağa kaldırmayı gerektirir.
S1 ayrıca 02 §4/A4'te zaten elenmiş altyapı bağımlılığını geri getirirdi. S3
doğru bir fikir ama sırası yanlış: genel workflow motoru, 13 bileşen daha
yazılmamışken yazılacak en pahalı şey; ayrıca tek kanıtı matrisin en düşük
puanlı çatısı.

**Yürütme modeli (İ1 S1):** graf **ve** rol tabanlı arasında seçim yapılmaz —
görev grafı veridir, yürütücü tektir. Adımlar arasındaki bağ görev
sözleşmesinde (`task.schema.json`) yazılıdır; rol tabanlı akış, tek adımlı bir
graf olarak ifade edilir. Böylece İ1 §3'ün "graf: dallanma önceden
bilinebiliyorsa; rol: plan çalışma anında oluşuyorsa" ayrımı **veri düzeyinde**
kalır, iki ayrı yürütücü yazılmaz (AP2).

**Paralel yazma çakışması (İ1 S3):** iki adım aynı alana yazamaz. Her adımın
çıktısı kendi adım kaydına yazılır (ADR-003); birleştirme, okuyanın işidir.
LangGraph'ın kanal birleştiricisi (`channels/binop.py`) alınmadı — çünkü
birleştirici, çakışmayı çözmek yerine çakışmayı **normalleştirir** ve hangi
değerin nereden geldiğini kaybettirir (D5 ile çelişir).

**Orchestrator'ın AP7'ye karşı sınırı:** döngü yalnızca *sırayı* bilir; hiçbir
politika (retry kaç kez, hangi model, hangi izin) döngünün içinde yaşamaz —
hepsi çağrılan bileşenin ya da sözleşmenin alanıdır.

## Dahil etme ölçütü (ADR-000 K2)

| | |
|---|---|
| Çözdüğü problem | 13 bileşenin birbirini nasıl çağıracağının belirsizliği; akışın nerede olduğunun okunamaması. |
| Önlediği hata | *Dağıtık akış kontrolü* ve AP2 (*aynı kararın ikinci uygulaması*): tek karar noktası olduğu için sync/async ikinci bir yol açılamaz. |
| Eklediği maliyet | Orchestrator merkezî bir dosyadır ve AP7'nin doğal hedefidir; her turda "bu politika döngüye mi girdi" kontrolü gerekir. Ayrıca olay tabanlı genişletmenin (yeni dinleyici) kolaylığı feda edilir. |
| Kanıt (≥2 olgun proje veya yaşadığımız arıza) | LangGraph (olgunluk 5), OpenAI Agents SDK (5), Strands (4) — üçü de tek döngü; İ1'in yedi projesinden beşi. Karşıt kanıt (Dapr Agents) matriste olgunluk 2. |

## Sonuçlar

**Olumlu:** Her bileşen tek başına test edilebilir. Akış tek dosyadan okunur.
Yeni bileşen eklemek döngüye bir çağrı eklemektir, yeni bir iletişim kanalı
açmak değil.

**Olumsuz / kabul edilen bedel:** Orchestrator zamanla büyür; AP7 riski
kalıcıdır ve kod incelemesiyle karşılanır. Süreçler arası dağıtık çalışma bu
kararla dışarıda kalır — tek makine varsayımı mimariye girer.

**Etkilenen sözleşmeler:** `contracts/task.schema.json` — adımlar arası bağ
(sıra, bağımlılık, paralellik) burada tanımlanır. `contracts/message.schema.json`
— bileşen çağrılarının girdi/çıktı biçimi.

**Etkilenen diğer ADR'ler:** ADR-001 (bileşen kümesi) bunun girdisi;
ADR-003 (adım kaydı) bu döngünün sınırlarına yazılır.

## Uygulama notu

Faz 5'te `src/orchestrator/` yalnızca döngüyü içerir; içinde `retry`, `model`,
`permission` gibi bir kelime geçmez — hepsi çağrılan bileşenlerdedir.

Test edilebilir ölçüt: "her bileşenin birim testi yalnızca kendi modülünü import
ederek koşuyor" ve "`src/orchestrator/` içinde diğer 12 bileşenden hiçbirinin
politika sabiti geçmiyor" geçiyorsa karar uygulanmıştır.
