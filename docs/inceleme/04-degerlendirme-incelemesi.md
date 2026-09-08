# Değerlendirme mimarisi — bağımsız inceleme

**Tarih:** 08.09.2026 14:56 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/mimari/04-DEGERLENDIRME.md` (koşu 607faa6)

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Şema ↔ belge sözlüğü | `GECTI`, `KALDI`, `DEGERLENDIRILMEDI`, `deterministic`, `human-gate`, `evaluation_result` — altısı da hem belgede hem `contracts/task.schema.json` içinde |
| `arac/sema-dogrula.js --test` | Temiz |
| ADR-004 ile tutarlılık | Evaluator/Critic ayrımı belge boyunca 17 yerde korunuyor; karar veren Evaluator, yazan Critic |
| Alıntı izlenebilirliği | Kod alıntısı yok (tasarım belgesi) — beklenen; iddialar Faz 2 desen numaralarına bağlı |

## Değerlendirme

**Güçlü yan: iki fonksiyon sıralı.** `gecerli_mi()` düştüyse
`esigi_asti_mi()` sorulmuyor. Bu, D3'ün ("yargı deterministik kaynaktan")
ve D7'nin (hata türü ayrı alan) birlikte uygulanması; ayrıca "biçimi bozuk
ama puanı yüksek" gibi anlamsız sonucu yapısal olarak imkânsız kılıyor.

**Güçlü yan: kapının kendisi ölçülüyor.** Dört sayaç (değerlendirilmedi
oranı, mutant yakalama, retry sonrası geçme, kapı maliyeti) ve **her birinin
tüketicisi adlandırılmış**. Bu, AP5'in ("sinyal ile karar arasındaki bağ ters
kurulur") ve kural 6'nın doğrudan uygulaması: ölçülmeyen kapı, olmayan
kapıdır. `mutant_yakalama_orani < 1,0` bir arıza sayılıyor — sahte yeşile
karşı somut savunma.

**Güçlü yan: `DEGERLENDIRILMEDI` üçüncü değer olarak var.** D11'in
("denetlenmedi ≠ temiz") sözleşme düzeyindeki karşılığı; ADR-004'ün yeniden
açılma koşulu da bu sayaca bağlanmış.

**Not: benchmark seti henüz yok.** §7 kapıyı denetleyecek mutasyon setini
tarif ediyor ama set Faz 4'te yazılacak. O yazılana kadar
`mutant_yakalama_orani` ölçülemez; yani §8'in dört sayacından biri şimdilik
boş kalır. Belge bunu §10'da kabul ediyor.

## Karar

Değerlendirme mimarisi **kullanılabilir**. Açık iş yok; benchmark seti Faz 4
kuyruğunda ve belgede işaretli.
