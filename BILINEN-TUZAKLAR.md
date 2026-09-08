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

## 13. Değerlendirme adımı bulguyu yakaladıktan sonra sorun kendi kendine kapanabilir

Değerlendirme adımı "2 commit'lenmemiş dosya var" diye bir düzeltme
görevi yazdı (12:27), ama önceki koşu 4 dakika sonra (12:31) zaten
commit atıp kendi geliştirme günlüğü kaydını da düşmüştü. Düzeltme
görevi çalıştığında depo zaten temizdi — anlık görüntü (snapshot) ile
düzeltme görevinin çalışma anı arasında yarış vardı.

- Bir düzeltme görevine başlamadan önce **önce `git status` / ilgili
  kontrolü çalıştır**, göreve güvenip doğrudan "geri al" ya da "elle
  düzelt" moduna geçme. Sorun hâlâ var mı diye doğrula.
- Zaten çözülmüşse düzeltme yapma; sadece doğrula ve günlüğe neden
  hâlâ görev kuyruğunda göründüğünü yaz (yarış durumu, gecikmeli
  değerlendirme vb.).

## 14. Git kimliğini `-c user.email` ile ezme — push reddedilir

Makinede global kimlik zaten hesabın **noreply** adresi
(`121863222+Furkiozknn@users.noreply.github.com`). Commit atarken
`-c user.name=... -c user.email=ornek@example.com` vermek o commit'i
hesabın **gizli** e-postasıyla imzalar; GitHub'ın "e-postamı açığa çıkaran
push'ları engelle" ayarı push'u reddeder:
`! [remote rejected] HEAD -> master (push declined due to email privacy restrictions)`.
7 Eylül'de `ajans-os`'un ilk push'u böyle düştü; 8 commit gizli e-postayla
atılmıştı.

- `git commit` çağrısına **hiçbir zaman** `-c user.*` ekleme; global config
  doğru. Emin değilsen önce `git config --global user.email` bak.
- Reddedilen commit'ler yalnızca yeniden yazarak (yazar e-postası) ya da
  GitHub ayarını geçici kapatarak push edilebilir — ikisi de kullanıcının
  kararı.

## 15. Dört paralel alt ajan bütçeyi tek turda bitirir

İ3 araştırma turu dört paralel `opus` alt ajan açtı; 8,6 dakikada 6 USD
bütçenin tamamı gitti, özet yazılamadı, tur yarım kaldı. Alt ajanlar
bütçe dolduğunda hâlâ çalışıyordu — yazamadıkları her şey kayboldu.

- Aynı anda en fazla **iki** alt ajan, alt ajanlar `sonnet`.
- İki proje bitir → dosyaya yaz → commit → sonraki iki. Yazılmamış iş,
  bütçe dolunca yok olur; sık commit at.
- Bütçenin yarısı gittiyse yeni proje açma.

## 16. İki `sonnet` alt ajan da bütçenin yarısını yiyebilir (#15'in devamı)

#15'ten sonra kural "aynı anda en fazla iki, `sonnet` ile" oldu. İ4 turu
tam olarak buna uydu — ve yine yarım kaldı. İki alt ajan (langgraph ve
temporal derin kod okuması) tek turda **~3,3 USD** yaktı: 6 USD bütçenin
%55'i, ~6-7 dakikada, 77 ve 85 araç çağrısı, 135k ve 132k token. Yedi
projelik izin ikisi bitti.

Yanlış olan kural değil, ölçü birimi: maliyeti belirleyen alt ajan
**sayısı** değil, her birinin ne kadar kod okuduğu. Bir spec belgesi
okuyan `sonnet` ile 40 bin satırlık bir motoru gezen `sonnet` aynı şey
değil.

- Derin kod okuması yapan alt ajan turu başına **iki** demek, tur başına
  **~3,5 USD** demek. 6 USD bütçede bu, bir izde en fazla **iki** proje
  eder — altı-on projelik iz üç-dört tura yayılır. Bunu baştan kabul et,
  tek turda bitirmeye çalışma.
- Alt ajanı açmadan önce ona **kapsam sınırı** ver: hangi klasörler,
  hangi dosyalar. "Depoyu incele" açık uçludur ve açık uçlu her görev
  bütçeyi sonuna kadar kullanır.
- İz yarım kalacaksa `docs/arastirma/<iz>/DURUM.md` yaz: bitenler,
  hazır klonlar, kalanların odak soruları, aday dışı bırakılanlar ve
  nedeni. Sonraki tur bunu okur ve incelenmişi tekrar incelemez.

## 17. Kapsam sınırı işe yarıyor — ölçüldü (#16'nın doğrulaması)

#16 "alt ajanın maliyetini sayısı değil, ne kadar kod okuduğu belirler; ona
kapsam sınırı ver" diyordu. 8 Eylül İ4 turu bunu ölçtü: iki `sonnet` alt ajan,
prompt'larında **hangi klasörlere girecekleri ve hangilerine girmeyecekleri**
açıkça yazılı ("`src/providers/` klasörüne GİRME", "`tests/`, `docs/`,
`examples/` klasörlerine girme", "toplam 25 araç çağrısını aşma", "dosyayı
baştan sona okuma; `grep -n` ile satırı bul, o civarı oku").

Sonuç: 26 ve 25 araç çağrısı, 62k ve 69k token, toplam **~1,3 USD**. #16'daki
açık uçlu turda aynı iki-ajan yapısı **~3,3 USD** yakmıştı. Yaklaşık **2,5 kat**
fark, ve çıktı kalitesi düşmedi — iki ajan da kapsam dışı bıraktıkları şeyi
raporda açıkça yazdı, bu da dürüstlük açısından artı.

- Alt ajan prompt'una üç şeyi **her zaman** yaz: (1) okunacak klasörlerin
  listesi, (2) **girilmeyecek** klasörlerin listesi, (3) araç çağrısı tavanı.
- "Depoyu incele" yasak. Açık uçlu her görev bütçeyi sonuna kadar kullanır.
- Ajanın kapsam dışına çıkması gerekirse bunu raporda gerekçesiyle yazmasını
  iste — sessizce genişletmesindense.

## 18. Alt ajan kontrol altına alınınca darboğaz ana ajana kayıyor

#17 kapsam sınırının işe yaradığını ölçmüştü (iki `sonnet` alt ajan
~1,3 USD). 8 Eylül İ5 turu aynı disiplini uyguladı ve alt ajanlar yine
ucuz kaldı — ama tur yine yarım bitti. Bu kez parayı yiyen alt ajanlar
değildi: **ana ajanın kendi yazdığı iki analiz dosyası** (~15 KB Türkçe
metin, yaklaşık 2,0 USD) alt ajanların toplamından pahalıya geldi.

Uzun Türkçe markdown, çıktı token'ı olarak pahalıdır ve ana ajanın
bağlamında üretildiği için alt ajan bütçe muhasebesine hiç girmez.
"İki alt ajan açtım, ucuz kaldı" hissi yanıltıcı.

- Küçük ve yerel bir depoyu "ben okurum, alt ajana gerek yok" diye
  almak **tasarruf değil**: okuma ucuz, ama arkasından gelen 15 KB'lık
  analiz dosyası pahalı. Yazma işini de alt ajana ver.
- Tur planlarken "kaç alt ajan" değil **"kaç analiz dosyası yazılacak"**
  diye say. Bu makinede bir analiz dosyası ≈ 1 USD, kim yazarsa yazsın.
- 6 USD bütçe pratikte **dört analiz dosyası + bir DURUM.md** demek.
  Altı projelik iz iki tur sürer. Baştan böyle planla.

## 19. Heredoc'ta tek tırnaklı sınırlayıcı da Türkçe kesme işaretini kurtarmıyor

Tuzak #11 `node -e '...'` içindeki kesme işaretini anlatıyordu ve çözüm olarak
"heredoc kullan" akla geliyor. 8 Eylül İ5 turunda 9 KB'lık Türkçe bir markdown
bölümü `cat >> dosya.md << 'MDEOF'` ile — yani **tek tırnaklı, kaçışsız**
sınırlayıcıyla — eklenmeye çalışıldı. Bash şu hatayla düştü:
`unexpected EOF while looking for matching \`''` ve **hiçbir şey yazılmadı**.

İçerikte `spec'in`, `DURUM.md'nin`, `İ5'in` gibi onlarca kesme işareti vardı.
Saf bash'te tek tırnaklı sınırlayıcı bunları literal almalıydı; demek ki komut
bash'e ulaşmadan önce bir katman daha ayrıştırıyor. Sebep ne olursa olsun sonuç
aynı: 9 KB'lık çıktı token'ı boşa gitti ve yeniden üretmek gerekti — bu turda
yaklaşık 0,4 USD.

Kural, #11'in genişletilmiş hâli: **içinde Türkçe düzyazı olan hiçbir içerik
kabuk komutunun gövdesine yazılmaz** — heredoc dahil, sınırlayıcı tırnaklı
olsa bile.

- Uzun Türkçe metni `Write` aracıyla yaz. Hedef dosyanın sonuna ekleyeceksen
  önce `D:/Repolar/_inceleme/_tmp-*.md` gibi geçici bir dosyaya yaz, sonra
  `cat gecici >> hedef` ile ekle, sonra geçiciyi sil. Bu üç adım güvenli.
- `git commit -F-` ile heredoc'tan commit mesajı okumak da aynı riski taşır;
  commit mesajını Türkçe kesme işareti içermeyecek şekilde yaz ya da
  `-F dosya` kullan.
- Yazdıktan sonra **doğrula**: `grep -c ''` ile satır sayısı, `grep -n` ile
  yeni başlığın gerçekten dosyada olduğu. Komut hata verdiyse dosya hiç
  değişmemiştir; "herhalde yazıldı" varsayma.


## 20. Kapanışta `git add -A` eş zamanlı oturumun işini süpürür

Tuzak #12 "elle commit atmadan önce `git status`" diyordu; İ6 turu bunu **tur
başında** yaptı (depo temizdi) ve kapanışta `git add -A` çalıştırdı. Aradaki
~20 dakikada eş zamanlı çalışan başka bir oturum İ5 izinde dört dosya
değiştirmişti (`i5-gozlem-ekonomi/DENETIM.md` dahil, yeni dosya). Hepsi
"I6 izi tamamlandi" commit'ine karıştı.

Kontrolün **başta** yapılması yetmiyor: bu makinede oturumlar paralel koşuyor,
depo tur ortasında kirlenebilir.

- Kapanış commit'inde `git add -A` / `git add .` **kullanma**. Turun kendi
  ürettiği dosyaları **adıyla** ekle (`git add docs/arastirma/i6-.../OZET.md ...`).
- Yol haritası gibi ortak dosyaları eklerken bile önce `git status --short`
  çalıştır ve çıktıda **tanımadığın bir yol varsa ekleme** — o başka bir
  oturumun yarım işidir.
- Karıştıysa geri almaya çalışma: diğer oturum hâlâ çalışıyor olabilir.
  `raporlar/ONAY-BEKLEYENLER.md` içine yaz, kullanıcı karar versin.


## 21. Tablo ayrıştırıcısı "ilk veri satırından" şema tahmin ederse tek bir tire tüm izi sessizce düşürür

`matris-uret.js` puan sütunlarını ilk veri satırında 1–5 arası tamsayı arayarak
buluyordu ve puan tablosunu "Proje başlığı + içinde .md bağlantısı olan" ilk tablo
diye seçiyordu. 8 Eylül matris turunda altı izin **dördü** bu yüzden düştü:
i3 başlığı `Kaynak` yazdığı için, i5/i6 proje sütununda bağlantı yerine düz dosya
adı olduğu için, i4 ise iki tablosu olduğu için (araç kimlik tablosunu puan tablosu
sandı). Sonuç: matris 40 proje yerine 20 proje ile üretildi ve **hata vermedi** —
yalnızca uyarı listesine satır düştü. Uyarıları okumayan biri eksik matrisi doğru
sanardı.

- Şemayı veriden tahmin etme, **başlıktan** tanı. Sütun adı sabit bir sözlükten
  eşleştirilir (kısaltmalar dahil: `Güv.ilk.` → `guvilk`), veri hücresinden değil.
- "İlk eşleşen tabloyu al" yanlış seçim yapabilir; seçim ölçütü aranan sütunların
  **hepsinin** başlıkta bulunması olmalı.
- `parseInt("incelenmedi")` → NaN, ve NaN JSON'da `null`, markdown'da `NaN` olarak
  görünür. Sayı beklenen her hücrede aralık kontrolü yap, sonucu null'a düşür.
- Kaynak belgeler elle yazılıyorsa biçim mutlaka **sıfır uyarı** ile doğrulanmalı;
  uyarı listesi boş değilse çıktı yayımlanmaz.
---

## 22. Belgenin kendi metni hakkındaki iddia da bir iddiadır

`docs/mimari/00-BLUEPRINT.md` §5'in 9. satırına *"'rollback' kelimesi mimariye
girmez — **bu belgede o kelime hiç kullanılmadı**"* yazıldı. Oysa kelime aynı
belgede iki kez geçiyordu: yasağı ifade eden cümlenin kendisinde ve o satırda.
Yani belge, kendi hakkında yanlış bir garanti veriyordu — tam olarak
`docs/03-ANTI-PATTERNLER.md` AP3'ün ("beyan edilen garantinin kodda karşılığı
yok") kendimize dönük hâli. `grep -i rollback` ile kapanış doğrulamasında
yakalandı; yakalanmasaydı bir sonraki tur belgeye güvenip aynı cümleyi
alıntılayacaktı.

Kaynak koddaki iddiaları doğrulamak için üç araç var (`kanit-dogrula.js`,
`iz-izle.js`, `matris-uret.js`), ama **belgenin kendi metni hakkındaki**
iddiayı hiçbiri kontrol etmiyor — çünkü kanıt zinciri dışarıyı gösteriyor,
içeriyi değil.

- "Bu belgede X yok", "hiçbir yerde geçmiyor", "tek bir istisna yok" gibi her
  cümle **yazıldığı anda kendi dosyasında aranır** (`grep -n`). Aramadan
  yazma.
- Bir kelimeyi yasaklayan cümle, o kelimeyi kaçınılmaz olarak içerir. Yasağı
  "kullanılmaz" diye yaz, "kullanılmadı" diye değil — biri kural, öbürü
  doğrulanabilir (ve çoğu zaman yanlış) bir olgu iddiası.
- Kapanış doğrulamasına şunu ekle: belgede geçen her "hiç / sıfır / yok"
  ifadesi için bir `grep`.


---

## 23. Kök `package.json` yoktan var olan bir karardır: `"type": "module"` mevcut CommonJS araçlarını kırar

`ajans-os` U0'da kök `package.json` yazıldı (`"type": "module"`, ADR-009).
Depoda o güne kadar `package.json` **hiç yoktu**; `arac/*.js` araçlarının
altısı da `require()` ile yazılmıştı ve `node arac/sema-dogrula.js` diye
sorunsuz çalışıyordu — çünkü `package.json` yokken Node `.js`'i CommonJS
sayar. Kök dosya yazıldığı anda aynı komut
`ReferenceError: require is not defined in ES module scope` ile düşerdi:
tek bir yeni dosya, hiç dokunulmamış altı aracı birden kırar.

Çözüm altı aracı ESM'e çevirmek değil, **kapsamı daraltmak**: `arac/`
klasörüne `{ "type": "commonjs" }` içeren iki satırlık bir `package.json`.
Node en yakın `package.json`'a baktığı için `arac/*.js` CommonJS kalır,
`src/*.js` ESM olur. Araç dosyalarının hiçbiri değişmedi.

- Bir depoya **ilk kez** `package.json` eklerken önce
  `grep -l "require(" **/*.js` çalıştır. Çıkan her klasör ya çevrilecek ya da
  kendi `{"type":"commonjs"}` dosyasıyla korunacaktır.
- `"type"` alanı dosya başına değil **klasör ağacına** uygulanır; iki kipi
  ayırmanın maliyeti bir dosyadır, karışık depoda bunu ödemek normaldir.
- Aynı turda ikinci tuzak: `node --test src/` (klasör argümanı) Node
  v24.19.0'da klasörü **modül yolu** sanıp
  `Cannot find module 'D:\...\src'` ile düşüyor. Çalışan biçim glob:
  `node --test src/**/*.test.js` — ve hiç eşleşme olmasa bile çıkış kodu 0
  döner, yani "sıfır test bile olsa koşucu ayakta" ölçütü bu biçimle
  sağlanır. `npm test`'i yazdıktan sonra **bir kez koştur**; koşucunun
  ayakta olduğu varsayılmaz, görülür.


---

## 24. Türkçe yerel vermek metin karşılaştırmasını **bozar** (#4'ün tersi)

Tuzak #4 sayı ayrıştırmada "her zaman `InvariantCulture` ver" diyordu. Metin
karşılaştırmasında aynı refleks tersine çalışır ve U5'te bir testi düşürdü.

`memory-manager` metin süzgeci iki tarafı `toLocaleLowerCase("tr")` ile
küçültüyordu. Türkçe yerelde `"ISTANBUL"` → `"ıstanbul"` (noktasız ı) olur;
sorgudaki `"istanbul"` ise zaten küçük olduğu için `"istanbul"` kalır. İki
taraf da "doğru" küçültüldü ve **aynı kelime eşleşmedi**. Yerel vermek burada
doğruluğu artırmıyor, azaltıyor: `toLowerCase()` iki tarafı da `i`'ye indirir
ve eşleşme olur.

- Kural tek yönlüdür: **sayı ayrıştırmada yerel ver** (`InvariantCulture`),
  **metin katlamada yerel verme**. Karşılaştırmanın iki tarafı da aynı
  fonksiyondan geçse bile Türkçe `I`/`i` haritası tek yönlü olmadığı için
  simetri korunmaz.
- Kalan sınır kabul edilir ve yazılır: noktalı `İ` ile noktasız `I` hâlâ ayrı
  harftir. Tam çözüm metin normalizasyonu ister; gerekmedikçe açma.
- Bir eşleşme testi "aynı görünen iki metin eşleşmiyor" diyorsa önce
  küçültmeye bak, sorguya değil.

---

## 25. `JSON.stringify` ile yazılan frontmatter, içindeki tırnağı okunmaz yapar

U15'te türetici `description` alanına tetikleyici ifadeleri **çift tırnak
içinde** koydu — çünkü ev sahibinin doğrulayıcısı tam olarak bunu arıyor.
Değer `JSON.stringify` ile yazılınca satır şöyle çıktı:

```yaml
description: "... Kullanici \"şu kodu incele\" dediginde kullan."
```

Bu geçerli YAML'dır ve gerçek bir ayrıştırıcı doğru çözer. Ama ev sahiplerinin
frontmatter ayrıştırıcıları çoğunlukla naiftir (ölçülen örnek:
`turkce-ajanlar/arac/dogrula.js`, `.replace(/^["']|["']$/g, "")`): yalnızca
baştaki ve sondaki tırnağı atarlar, ters bölülü kaçışı **çözmezler**. Sonuç:
tırnak içindeki ifade tırnak içinde görünmez, doğrulayıcı "tetikleyici ifade
yok" der ve türetilen dosyayı reddeder. Üretici tarafta her şey doğrudur;
hata yalnızca tüketici tarafında görünür.

- Bir ev sahibi biçimi üretiyorsan çıktıyı **o ev sahibinin kendi
  doğrulayıcısından geçir**. "Geçerli YAML üretiyorum" yeterli değil; kabul
  ölçütü tüketicinin ayrıştırıcısıdır.
- İçinde çift tırnak olan değeri YAML'ın **tek tırnaklı** biçimiyle yaz
  (`'...'`, tek kaçış kuralı `'` → `''`). İçerideki çift tırnak olduğu gibi
  kalır ve naif ayrıştırıcı da doğru okur.
- Kalan sınır kabul edilir ve yazılır: naif ayrıştırıcı `''` çiftini tek
  tırnağa geri çevirmez, yani kesme işaretli metin (`PATH'te` → `PATH''te`)
  onun gözünde çift görünür. Türkçe metinde bu sık olur; kabulü etkilemiyorsa
  bırakılır, etkilediği gün çözüm ayrıştırıcı tarafındadır.
