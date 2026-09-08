# U1 — `src/task-manager/` — bağımsız inceleme

**Tarih:** 08.09.2026 16:18 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/task-manager/index.js` (176 satır) + `index.test.js` (163 satır) (koşu 02d6c04)

## Kapı yeniden koşuldu

`npm test` → 8 test, 8 geçti. `npm run kapi` → temiz. Testlerin altısı mimari
kısıt sınıyor (bağımlılık sırası, ADR-003 iki yazma, D11 `DEGERLENDIRILMEDI`,
deneme hakkı, bekleme durumu, `task.schema.json` uyumu) — "mutlu yol" testi
yalnızca ikisi.

## Bağımsız senaryo (bu incelemede elle koşuldu)

Testlere güvenmeyip davranışı geçici bir klasörde doğrudan sınadım:

1. Şemaya uygun bir görev kaydı `olustur`uldu, `sonraki_adim` → `a1`.
2. `basladi_yaz(a1)` — **birinci yazma**.
3. Süreç "öldürüldü": yeni bir `gorevYoneticisi` örneği aynı dizinden yükledi.
4. Sonuç: `a1` durumu **`BASLADI`**, `tamamlandi_mi` **false**, `sonraki_adim`
   yine `a1` veriyor.

Yani ADR-003'ün "başladı kaydı" ilkesi kâğıtta değil, çalışan kodda: iki yazma
arasında ölen süreç adımı tamamlanmış saymıyor ve iş yeniden veriliyor. D1'in
(*ilerleme adım sınırında kalıcılaştırılan kayıttır*) ilk somut karşılığı.

## Bulgu (küçük, Faz 5 içinde kapatılmalı)

`olustur(gorev)` girdiyi doğrulamadan `gorev.task.id` okuyor; şemaya uymayan
bir nesne verilince ham `TypeError` fırlıyor. Mimari, hata **türünün**
makine-okur bir alan olmasını istiyor (D7, `hata_turu: SEMA_IHLALI`). Modülün
kendi testleri şema uyumunu üretilen kayıt üzerinden kanıtlıyor ama **girdi
tarafında** doğrulama yok. Öneri: `olustur` ve `yukle` girişinde
`arac/sema-dogrula.js` çağrısı ya da en azından tipli bir hata. U13
(Orchestrator) bu modülü çağıran taraf olduğu için orada da yakalanabilir;
takip maddesi olarak işaretliyorum.

## Karar

U1 **bitti sayılabilir**: ölçütü geçiyor, davranışı bağımsız senaryoyla
doğrulandı. Bir küçük sağlamlaştırma notu bırakıldı.
