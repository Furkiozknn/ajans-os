# Bellek mimarisi — bağımsız inceleme

**Tarih:** 08.09.2026 14:45 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/mimari/03-BELLEK.md` (koşu 9505622)

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Alıntı izlenebilirliği | 11/11 birebir |
| Katman adları ↔ şema | Belgedeki beş katman `agent.schema.json` `$defs.memory_layer` enum'uyla birebir (`task`, `session`, `project`, `global`, `knowledge`) — belge enum'u değiştirmiyor, ona anlam veriyor |
| Saklama değerleri ↔ şema | `retention` enum'una oturuyor; `days-7` bilerek boşta bırakılmış ve nedeni yazılı |
| `arac/sema-dogrula.js --test` | Temiz (şemalar bozulmadı) |
| Faz 2 bağları | D5 (kaynak korunur), AP9 (bellekte gizlilik kararı yok) ve kural 10 (belleğe yazmak izin işlemidir) belge boyunca 11 yerde anılıyor |

## Değerlendirme

**Güçlü yan: "append-only yasak" kararı.** Belge D5'i körü körüne uygulamıyor;
mem0'ın hatasını (çelişen iki kaydı yan yana bırakıp okuma anında
çözmemek) açıkça karşı örnek olarak alıp her katmana **çelişki çözümü**
sütunu koymuş. Bu, Faz 2'nin "doğru ilke *her şeyi sakla* değil" cümlesinin
mimariye doğru inişi.

**Güçlü yan: terfi otomatik değil.** `task → session → project` yükselmesi
yalnızca açık yazma ile. "Sık tekrar eden bilgi kalıcı olur" gibi sessiz bir
mekanizma yok; gerekçe olarak AP6'nın kuralı (kapsam belirtilmemişse sonuç boş
kümedir) gösterilmiş. Bellek katmanı bu projede en kolay şişecek yerdi;
kapı burada.

**Not: `knowledge` katmanı kopya tutuyor.** Kaynağı dışarıda olan bir kopya,
kaynak değiştiğinde bayatlar. Belge §6'da RAG'in yerini tartışıyor ama
"kopya ne zaman tazelenir" sorusu Faz 4'e kalıyor — `docs/inceleme` tarafında
takip edilecek açık soru olarak işaretliyorum.

## Karar

Bellek mimarisi **kullanılabilir**. Şemayla tam uyumlu, Faz 2 kanıtlarına
bağlı, açık işi yok. Tek takip maddesi: `knowledge` katmanının tazeleme
politikası (Faz 4).
