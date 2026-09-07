# Bilinen tuzaklar

Bu makinede **gerçekten yaşanmış** ve her biri en az bir görevi bozmuş
hatalar. Her otonom göreve otomatik eklenir. Yeni bir tuzak yaşarsan
buraya ekle — bir daha kimse aynı deliğe düşmesin.

Kural: bir şeyi düzeltmekle yetinme, **neden olduğunu buraya yaz.**

---

> Bu liste `turkce-ajanlar` deposundaki evrensel maddelerden türetildi;
> yalnızca o depoya özgü olanlar çıkarıldı. Kaynak: 6–7 Eylül 2026 koşuları.


## 1. Ters bölü ve kontrol karakterleri (3 kez yaşandı)

Bash heredoc ve `node -e` içinde ters bölü ya kayboluyor ya da kaçış
dizisine dönüşüyor: `\v` → 0x0B, `\b` → 0x08, `\f` → 0x0C.
`otomasyon\bildir.ps1` yazdın, dosyada `otomasyonildir.ps1` + görünmez
bayt var. **`grep` bulamaz**, çünkü görünen metin ile bayt farklı.

- Windows yolu içeren içeriği heredoc ile yazma; Write aracıyla dosya yaz.
- Ters bölü gerekiyorsa `String.fromCharCode(92)`.
- Tuhaf bir eşleşmeme görürsen `od -c` ile bayta bak.
- Temizlik: `/[\x08\x0B\x0C]/g`.

## 2. PowerShell 5.1 ve BOM

BOM'suz `.ps1` dosyası **cp1254** (Türkçe ANSI) olarak okunur. İçindeki
em-dash (—) veya Türkçe karakter parse hatası verir ve script hiç
çalışmaz. Tüm `.ps1` dosyaları UTF-8 **BOM ile** kaydedilir.
Doğrulama: `[System.Management.Automation.PSParser]::Tokenize`.

## 3. PowerShell 5.1 sözdizimi

`&&`, `||`, ternary `?:`, `??`, `?.` **yok**. Görürsen hata.
`A; if ($?) { B }` kullan.

## 4. Türkçe yerel ayar sayıları yanlış okutur

`[double]::TryParse("0.5742")` Türkçe kültürde noktayı **binlik
ayırıcı** sayar → 5742. Bütçe sayacı 14.881 USD hesapladı, döngü kendini
durdurdu. Sayı parse ederken **her zaman**
`[Globalization.CultureInfo]::InvariantCulture` ver.

## 5. Python çıktısı cp1254

Türkçe Windows'ta Python stdout cp1254. Unicode basan araç
(`litellm`, `rich` kullanan her şey) `UnicodeEncodeError` ile **hiç
başlamaz** ve hata mesajı aracın kendisini suçlar gibi görünür.
Başlatmadan önce: `$env:PYTHONIOENCODING = "utf-8"; $env:PYTHONUTF8 = "1"`.

## 6. Python PATH'te yok

`python script.py` çalışmaz. `uv run` / `uvx` var, onları kullan.

## 7. Bütçe duvarı (5 görev yarıda kesildi)

`--max-budget-usd` dolunca süreç **anında** ölür; toparlanma şansı yok.
Görev "bitti" işaretini koyup doğrulamayı yapamadan kesilebilir.

- **Sıra:** önce doğrula, **en son** işaretle. Tersini yapma.
- Büyük bir işe girmeden önce kendine sor: bütçenin yarısı gitti mi?
  Gittiyse kalan işi günlüğe yaz, kutucuğu **boş bırak**, dur.
- Paralel alt-ajan açarken `sonnet` kullan; beş paralel `opus` bir turda
  2,56 USD yaktı ve hiç çıktı bırakmadı.

## 8. Deny kuralı sözdizimi

Windows'ta `Read()` deny sadece şu biçimde tutar:
`Read(C:/Users/furki/Desktop/dosya.txt)` — düz bölü, önek yok, tam yol.
Ters bölü, `//` öneki, `**/` ve joker **sessizce geçer**. Yazdığın
kuralı yem dosyayla test etmeden güvenme.

## 9. `--disable-slash-commands` ucuzlatmaz, pahalılaştırır

Skill listesini kaldırır ama prompt cache önekini bozar; maliyet **üçe**
katlandı (13.889 → 51.709 token). Token tasarrufu için kullanma.

## 10. İç içe kaçış katmanları (yama script'i çöktü)

JS template literal içinde PowerShell here-string üretirken içindeki
markdown çift backtick'leri template literal'ı kapattı; script
"X is not a function" ile çöktü ve **dosya hiç değişmedi** — parse
kontrolü "temiz" dedi çünkü eski hâline bakıyordu.

- Bir dilin kaynak kodunu başka bir dilin string'i içinde üretmek
  zorundaysan, çakışan karakter için **yer tutucu** kullan (ör. `¤`),
  en sonda tek seferde çevir. İki kaçış sistemi hiç yan yana gelmesin.
- Yama uyguladıktan sonra "parse temiz" yetmez; **değişikliğin gerçekten
  dosyaya girdiğini** kontrol et (`grep` ile yeni bir satırı ara).

## 11. Satır içi `node -e '...'` ve kesme işareti (3. kez)

Bash tek tırnak içindeki `node -e` gövdesinde bir kesme işareti
(`script'i`) shell string'ini kapatır; bash **hiçbir şeyi çalıştırmadan**
parse hatasıyla düşer. Türkçe metinde kesme işareti kaçınılmazdır.

Kural mutlaktır, "küçük düzenleme" istisnası yoktur: içinde Türkçe
metin, tırnak, backtick veya ters bölü olan her içerik önce Write ile
`.js` dosyasına yazılır, sonra `node dosya.js` ile çalıştırılır.

## 12. Canlı kuyruğu zamanlayıcı çalışırken elle kurcalama

`gorevler\bekleyen\` klasörünü test amacıyla boşaltırken zamanlayıcı
(15 dk'da bir) o sırada bir görevi kapmış ve çalıştırıyordu. Görev
dosyası çalışma ortasında silindi; yarı bitmiş çıktısı bir sonraki
elle commit'e süpürüldü; aynı iş 15 dk sonra ikinci kez üretilecekti.

- Kuyruğa elle dokunmadan önce `loglar\.calisiyor.lock` var mı bak.
  Varsa bekle.
- Üretici/çalıştırıcı testi için canlı kuyruğu kullanma; kilit varsa
  zamanlayıcıyı geçici durdur (`Disable-ScheduledTask Claude-GorevKuyrugu`)
  veya çıktıyı yalnızca ekrana bas.
- Elle commit atmadan önce `git status` — başkasının yarım işini
  süpürme.
