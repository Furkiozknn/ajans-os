# Tasarım: ajans-os ilk kullanım ve README yenilemesi (30 Eylül 2026)

## Hedef

Videodan ya da profilden gelen biri ilk dakikada şunu yapabilmeli: deponun ne olduğunu tek cümlede anlamak, tek komutla kapıyı koşturup yeşil çıktığını görmek, "bana göre mi?" sorusuna tablodan cevap almak; bir araca yanlış bayrak verirse doğrusunu ekranda görmek. Çekirdek (`src/*/index.js`), ADR'ler, sözleşme şemaları ve ADR-000 K1 sırası değişmedi; kapı yeşil kaldı, mutasyon ölçümü 19/19; mevcut 145 testin hiçbiri gevşetilmedi; sürüm numarası yok (`package.json` `private: true`, `0.0.0`).

Depo bir CLI değil, bir **referans çekirdek**; bu yüzden "CLI akışı" iki yüzeyden oluşuyor: `npm run` komutları ve `arac/*.js` betikleri.

## Önce / sonra

| Konu | Önce | Sonra |
|---|---|---|
| README ilk ekranı | banner, altı statik rozet, kaynağı depoda olmayan 15 sn'lik sesli reel, "Bir AI Agency Operating System" paragrafı, durum kutusu; komutlar ikinci ekranda ve dört ayrı komut | banner, tek cümlelik tanım (EN + TR), **tek komut** (`git clone ... && npm run kapi`) ve ölçülmüş süresi, ~20 sn gerçek çıktılı demo, "ne zaman kullanılır / kullanılmaz" tablosu; rozetler (CI dahil) ve eski gövde ondan sonra |
| Demo | `docs/reel/reel.{gif,mp4}` (üretici yok) ve elle kısaltılmış `assets/kabul-kosusu.svg` ("gerçek bir koşu", ama `npm test` için `145/145` gösteriyor; ilk koşuda 144 + 1 atlanan) | `docs/demo/kaydet.js` beş komutu gerçekten koşar, `komutlar.txt` kayıttır, `uret.py` o kayıttan çizer; hiçbir satır elle yazılmaz |
| Test sayısı, rozet ve metin | `test-145 geçiyor` elle yazılmış statik rozet; GitHub `description` "142" | 179; CI'daki yeni adım README ve `project-meta.json` sayısını koşunun `tests N` satırıyla karşılaştırır; `src/belge-sayilari.test.js` modül/ADR/şema/satır sayılarını ve README komut/bağlantılarını diskle karşılaştırır |
| `--help` | sekiz betiğin hiçbirinde yardım yoktu: `iz-izle.js` bir kullanım satırı basıp 2 ile çıkıyor, `kanit-dogrula.js` "iz klasörü yok: .../--help" (2) diyor, kalan altısı bayrağı yutup işini yapıyordu (`sema-mutasyon.js` 8 sn'lik ölçümü, `yapi-dogrula-test.js` ihlal dosyasını yazıp silmeyi, `matris-uret.js` iki belgeyi yeniden yazmayı) | sekiz betiğin hepsi `--help`/`-h` bilir: kullanım, bayraklar, ortam değişkenleri, çıkış kodları, örnek; `--help` başka hiçbir şey yapmaz |
| Yanlış yazılmış bayrak | sessizce yutulur: `sema-dogrula.js --tset` → öz-testi koşmadan "Sonuç: temiz.", çıkış 0 | `hata: bilinmeyen bayrak '--tset' — --test mi demek istediniz?` + `Yardım: ...`, çıkış 2 |
| `matris-uret.js --help` | `docs/01-matris.json` ve `docs/01-KARSILASTIRMA-MATRISI.md` yeniden yazılır (ağaç kirlenir) | yardım basar, dosyaya dokunmaz |
| Okunamayan girdi (`sema-dogrula.js --dosya`) | olmayan dosya, klasör, bozuk JSON, değeri eksik `--dosya`: yakalanmamış istisna, ~10 satır yığın izi, çıkış 1 | tek satır: `hata: yok.json okunamadı — böyle bir dosya yok` (2); bozuk JSON `✗ ... geçerli JSON değil: ...` (1) |
| `kanit-dogrula.js`, klon kökü yok | `AJANS_OS_DEPOLAR` varsayılanı (`D:/Repolar`) başka makinede yok → ENOENT yığın izi; README'nin önerdiği tek değişken (`AJANS_OS_KLONLAR`) yetmiyor | hangi iki klasörün yok olduğunu ve `AJANS_OS_KLONLAR=<klon-kök> node arac/kanit-dogrula.js <iz>` komutunu söyler (2); yalnız biri varsa çalışır |
| Windows PowerShell 5.1 | tek satırlık komut zinciri (`&&`) ayrıştırma hatası verir; README söylemiyor | README `;` biçimini ve `$env:AJANS_OS_KOMSU=...` sözdizimini söylüyor (PowerShell 5.1'de denendi) |
| Test | 145 (144 geçen + komşusuz 1 atlanan) | 179 (+31 `arac-cli`, +1 iz-izle, +2 `belge-sayilari`) |

## CLI akışı

```
ilk koşu        git clone https://github.com/Furkiozknn/ajans-os && cd ajans-os && npm run kapi
                (PowerShell 5.1: komutları `;` ile ayır)        çıkış 0 = kapı yeşil; sonda "1 atlandı" normal
parça parça     npm test | npm run yapi | npm run sema          testler | yapı | sözleşmeler + mutasyon
tek kanıt       node --test src/kabul-kosusu.test.js            öldürülüp diskten sürdürülen koşu, 3 test
yardım          node arac/<betik>.js --help                     kullanım, bayraklar, ortam değişkeni, çıkış kodları
yanlış bayrak   hata: bilinmeyen bayrak '--tset' — --test mi demek istediniz?    çıkış 2
tek belge       node arac/sema-dogrula.js --dosya <yol.json> --sema task.schema.json
                0 geçerli · 1 sözleşmeye/JSON'a uymuyor · 2 dosya okunamadı ya da kullanım hatası
```

Çıkış kodu sözleşmesi tek satırda: **0 temiz, 1 doğrulama hatası, 2 kullanım hatası ya da girdi okunamadı (doğrulama yapılamadı)**. Değişen tek şey daha önce yakalanmamış istisna olan yollar (kod 1 → 2: olmayan dosya, klasör, değeri eksik `--dosya`, klon kökü yok) ve sessizce yutulan bayraklar (kod 0 → 2). Geçerli belge 0, sözleşmeye uymayan belge 1, geçerli JSON olmayan belge 1 aynen kaldı; `src/arac-cli.test.js` bunları kilitler. Nedeni: bir CI betiği "belge geçersiz" ile "belgeye bakılamadı"yı ayırt edebilmeli; ikisinin de 1 olması bir bakılamamayı sözleşme ihlali gibi gösterirdi. Bu, `kanit-dogrula.js` ("iz klasörü yok" → 2) ve `iz-izle.js` ("Belge yok" → 2) betiklerinin zaten izlediği kuraldır.

Bayrak kapısı tek yerde (`arac/_cli.js`, 61 satır, bağımlılık yok): `--help`/`-h` yardımı basıp 0 ile çıkar, tanımadığı `-`/`--` bayrağında en yakın tanınan bayrağı (Levenshtein ≤ 2) önererek 2 ile çıkar. Sekiz betik ona bağlı; her betiğin kendi `--help` metni kendi dosyasında. `_cli.js` sözleşme doğrulayıcısını (`sema-dogrula.js`) etkilemez: mutasyon aracı doğrulayıcının 19 zorlama noktasını aynen mutasyona uğratır ve 19/19 ölür.

## Görsel dil (video sisteminden alınanlar)

README görselleri FRK-OS klasik temasında (`D:\Claude Projeleri\sosyal\uret\tema.mjs`, tema `klasik`); ürünün kendi kimliği (araştırma-önce bir çekirdek, terminal ağırlıklı) bu dille çelişmediği için ortak palet olduğu gibi kullanıldı.

| Ne | Nereden | Nerede |
|---|---|---|
| zemin `#0e0d0b`, krem `#f1ece2` (yazı), sarı `#ffc21a` (vurgu) | `tema.mjs` `klasik.akis` (`zeminler`, `yazilar`, `vurgular[0]`) | GIF/klip zemini, metin, `$` istemi + imleç + `Yardım:` satırı + "ajans-os" etiketi |
| camgöbeği `#19d3e6`, turuncu `#ff7a1a`, mercan `#ff4d6d` | `tema.mjs` `klasik.akis.vurgular` | geçen satırlar (`✔`, `oldu`, `temiz`), atlanan satırlar (`﹣`, `ATLANDI`), hata (`hata:`, sıfırdan farklı çıkış). Yalnızca boyama; metin değişmez |
| sönük krem `#9a958b` | `tema.mjs`'in `soluk` kavramı (yazı ile zeminin karışımı; kontrast eşiği geçilmek şartıyla). Sabit değer krem ile zeminin ~%60 karışımı; `repo-ratchet` yenilemesindeki demoyla aynı tutuldu | `ℹ` özet satırları ve `[çıkış N]` etiketi |
| JetBrains Mono (mono etiket) | `tema.mjs` `F.jb` | tüm terminal metni; SIL OFL 1.1 (`docs/demo/fonts/`), tam kümeden (`─`, `§`, Türkçe harfler) |
| `terminal: "koyu"` sahnesi, harf harf yazma (~40 karakter/sn), satır satır çıktı | `tema.mjs` `tercih.terminal`, `sahne.js` terminal tekniği | `docs/demo/uret.py` zaman çizelgesi |

Kontrast (WCAG göreli parlaklık, zemin `#0e0d0b` üstünde; `python docs/demo/uret.py kontrast` ile hesaplanır): krem 16,5:1, sarı 12,0:1, sönük 6,5:1, camgöbeği 10,6:1, turuncu 7,5:1, mercan 6,0:1; hepsi ≥ 4,5:1.

JetBrains Mono'da `✔ ✓ ✗ ℹ ﹣` yok (Node'un test raporcusu ve `sema-dogrula.js` bunları basıyor). Bu beş karakter hücre içinde çizgiyle çizilir (`uret.py` `cizgili()`), başka yazı tipi kullanılmadı; çıktının metni aynen korunur.

Bilerek alınmayanlar: League Gothic başlık (README'nin görsel başlığı yok; banner profil üreticisinden), geçiş aileleri (iris, glitch, flaş...): bir doğrulama aracının demosunda çıktının kendisi okunmalı, sahne geçişleri dikkat dağıtır; sahneler sert kesilir (GIF'te ekran temizlenir, dikey klipte birikir). Izgara dokusu (`doku: "izgara"`) çizilmedi: sabit çizgiler GIF paletini şişirirdi.

## Kararlar ve sınırlar

- **Banner değişmedi.** `assets/banner.svg` profil deposundaki üreticiden geliyor (dosyanın ilk satırı: `generated by github.com/Furkiozknn/Furkiozknn assets/banner/banner.py; edit banners.json there`); GitHub-koyu paleti (`#0d1117`, `#e3b341`) kullanıyor, FRK-OS değil. Bu depoda elle değiştirmek üreticinin sonraki çıktısında silinir; FRK-OS'a geçiş profil deposundaki `banners.json`/`banner.py` işidir.
- **Reel ve `kabul-kosusu.svg` çıkarıldı.** İkisinin de üreticisi depoda (ve makinede) yoktu, yeniden üretilemiyordu; `git` geçmişinde duruyorlar. Yerine yeniden üretilebilir demo geldi.
- **Dikey klip depoya girmedi.** 1080x1920 sessiz `terminal.mp4` günlük video hattı içindir: `sosyal/medya/projeler/ajans-os/terminal.mp4` (aynı kayıttan, `uret.py mp4`). Depoda yalnız README'nin gösterdiği GIF var.
- **Demo yabancı makine taklidi yapar.** Komşu doğrulayıcı ve klon kökleri olmadan koşar; yani ilk koşuda gerçekten görülen şey (1 atlanan test, "klon klasoru yok: /yok") ekranda. Tam 179/179 için komşu yanında olmalı; CI bunu pinli SHA ile yapar.
- **Kanıt zinciri.** `kaydet.js` kaydın commit'ini `komutlar.txt` başına yazar; kayıt o commit'in temiz ağacında alındı.
- **CI'a bir adım eklendi.** "Test sayısı README ve project-meta ile aynı mı": Node 22'nin `# tests N` ve Node 24'ün `ℹ tests N` satırı arasındaki önek farkına (bu depoda 21 Eylül'de bir kez yanlış kırmızı üretmişti) satırın kendisine bakarak dayanır. Eklenen adım başka bir adımı gevşetmez.
- **Yapılmadı (onay kapısı).** Birleştirme, sürüm/etiket, npm, Pages, dizin/awesome-list başvurusu, GitHub `description`/`homepage` değişikliği. `description` hâlâ "142 tests" diyor; düzeltme `gh repo edit` ile ana oturumda onay bekliyor.
