# Orkestrasyon mimarisi — bağımsız inceleme

**Tarih:** 08.09.2026 14:35 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `docs/mimari/02-ORKESTRASYON.md`, `contracts/task.schema.json`,
`contracts/message.schema.json`, ADR-006 (koşu 6122f9a + 7353fd2)

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Üç şema geçerli JSON, `additionalProperties: false` | ✓ (agent 18/17, task 4 üst alan + 5 `$defs`, message 9/8) |
| `arac/sema-dogrula.js --test` | Çıkış 0, temiz |
| Alıntı izlenebilirliği | `02-ORKESTRASYON.md` 2/2 birebir |
| Durum makinesi adları | **Tutarsızlık bulundu ve düzeltildi** (aşağıda) |
| Hata türü kümesi | `$defs.hata_turu` dokuz değer (`SEMA_IHLALI`…`BILINMEYEN`) — D7'nin ("hata türü makine-okur alandır") doğrudan uygulaması, `BILINMEYEN` ayrı değer olarak var (AP10'un `null` kuralı) |
| Retry modları | `duzelt` / `temiz-sayfa` — D13'ün iki modu şemada birebir |

## Bulunan tutarsızlık (düzeltildi)

`00-BLUEPRINT.md` §2.2 durum makinesini `PLANLANDI → CALISIYOR → …` diye
yazıyordu; `contracts/task.schema.json` (`$defs.step_record.status`) ve
`02-ORKESTRASYON.md` §4 ise `BASLADI` kullanıyor. Aynı kavramın iki adı —
belgelerin kendi AP2'si ("aynı kararın ikinci uygulaması"). Şema ve
orkestrasyon belgesi doğru olan: ad, ADR-003'ün "başladı kaydı"na bağlı.
Blueprint bu incelemede **şemaya hizalandı** ve neden değiştiği not olarak
yazıldı. Depoda başka `CALISIYOR` geçişi kalmadı (`grep -rn`).

## Değerlendirme

**Güçlü yan: konsensüs kararı israfa karşı savunuldu.** §6 konsensüsün ne
zaman gerekli olmadığını da yazıyor; İ1'in çoklu-ajan oylama desenini
"varsayılan açık" yapmıyor. Bu, K2'nin maliyet maddesinin ciddiye alındığını
gösteriyor.

**Güçlü yan: mesaj sözleşmesi dar.** Dokuz alan, sekizi zorunlu; ajanlar
birbirini doğrudan çağırmıyor (ADR-002), her mesaj `run_id`/`step_id`
taşıyor — gözlem ve kurtarma bu iki alana bağlanabiliyor.

**Not: planlayıcı yok ama "Planlayıcı" başlığı var.** §2 hedef → görev grafı
dönüşümünü anlatıyor; ADR-001 Planner'ı **mimariye almadı** (kanıt boş).
Belge bunu §7'de "insan yazar" diye söylüyor ama başlık tek başına
okunduğunda bileşen varmış gibi duruyor. Faz 4'te `src/` altında planner
modülü **açılmamalı** — ADR-001'in 13 modül ölçütü bunu zaten yakalar.

## Karar

Orkestrasyon mimarisi ve iki yeni sözleşme **kullanılabilir**. Bir
tutarsızlık bulundu ve kapatıldı; başka açık iş yok.
