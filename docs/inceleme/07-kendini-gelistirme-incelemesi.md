# Kendini geliştirme mimarisi — bağımsız inceleme

**Tarih:** 08.09.2026 15:42 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/mimari/07-KENDINI-GELISTIRME.md`, `contracts/proposal.schema.json` (koşu 3024e14)

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Alıntı izlenebilirliği | 6/6 birebir |
| `contracts/proposal.schema.json` | Geçerli JSON; `gates`, `threshold`, üç değerli `gecti`/`kaldi`/`calistirilmadi` şemada |
| `arac/sema-dogrula.js --test` | Altı şemayla birlikte temiz |
| ADR-001 ile tutarlılık | Belge §2 **bileşen eklemiyor** — Learning Layer mimariye girmemişti; bu belge onun yerine "öneri veridir" kuralını yazıyor. ADR-001'in 13 modül ölçütü bozulmuyor |
| AP1 ile tutarlılık | Üçüncü kapı insan; "çalıştırılmamış kapıyla uygulama yapılamaz" kuralı `05-GUVENLIK.md` §2.5'e bağlanmış |

## Değerlendirme

**Güçlü yan: en riskli konuda en dar karar.** Kendini değiştiren sistemler
İ6'da tam olarak insan kapısının kaybolduğu yerdi (DGM ve OpenEvolve kabul
kararını tamamen metriğe bırakıyor). Bu belge tersini yapıyor: öneri bir
**veri kaydı**, uygulama ayrı bir eylem ve üçüncü kapı insan. K7'nin
ADR-000'deki hâli korunmuş, genişletilmemiş.

**Güçlü yan: iki makine kapısı birleştirilemez.** "Geçerli mi" ile "yeterince
iyi mi" ayrı alanlar ve şemanın öz-testi tek bayrağa indirgemeyi **reddediyor**.
Bu, D3'ün ve 04-DEGERLENDIRME §5.1'in üçüncü kez tekrarlanan uygulaması;
üç belge aynı kuralı aynı biçimde söylüyor, çelişki yok.

**Güçlü yan: karşıt kanıt yazılı.** TextGrad'ın aynı deseni ihlal ettiği ve
"üretimde savunulamaz" olduğu belgede duruyor — desen "herkes böyle yapıyor"
diye değil, "yapmayan savunulamıyor" diye alınmış.

**Not: sürüklenme tespiti ölçüm gerektiriyor.** §8 sürüklenmeyi (drift)
tanımlıyor ama eşikleri Faz 4'te gerçek koşu verisiyle kalibre edilecek.
Gözlem belgesinin sekiz sayacı bu verinin kaynağı; bağ kurulmuş.

## Karar

Kendini geliştirme mimarisi **kullanılabilir**. **Faz 3 tamamlandı:** yedi
mimari belgesi, altı sözleşme şeması, ADR-001…006 — hepsi üreten koşudan
farklı bir oturumca denetlendi ve bulunan tek tutarsızlık (durum adı)
kapatıldı.
