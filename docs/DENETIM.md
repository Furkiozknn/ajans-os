# Denetim: ajans-os (30 Eylül 2026)

Yenilemeden önce `master` (`5684604`) üzerinde, taze `git clone` ile geçici klasörde, bu makinede (Windows 11, Git Bash, Node 24.19.0, npm 11.17.0; Node 22 için `npx -p node@22`) ölçüldü. Ölçülmeyen bir şey yazılmadı. Ham çıktılar depo dışında: `kanit/ajans-os/{once,sonra}/` (aynı 29 komut, iki sürüme karşı: `olc.py`; uzun çıktılar `ham/NN.txt`). "Yabancı makine" taklidi: `../turkce-ajanlar` yok, `AJANS_OS_KLONLAR`/`AJANS_OS_DEPOLAR` var olmayan klasöre gösteriyor (bu makinede `D:/Repolar` var).

## Temiz ortamda kurulum ve ilk sonuç

Kurulacak bir şey yok (bağımlılık: 0); "kurulum" `git clone`. Süreler tek koşudur; makine başka işlerle paylaşıldığı için aynı komutun koşuları arasında 5-7 s fark çıktı (`npm run kapi`: 21,9 s ve 14,3 s). Yeni testler `npm test`'e koşucu süresinde ~2 s ekliyor (4,5 s -> 6,6 s: çoğu test bir alt süreç başlatıyor).

| Komut (README'deki) | Önce (`5684604`) | Sonra (`2243af7`) | Sonuç |
|---|---|---|---|
| `git clone https://github.com/Furkiozknn/ajans-os` | 2,26 s (`.git` 4,6 MB) | 1,76 s (`.git` 4,9 MB) | |
| `npm test` (komşu yok) | 7,02 s | 8,07 s | önce `tests 145 / pass 144 / skipped 1`; sonra `tests 179 / pass 178 / skipped 1` |
| `npm run yapi` | 1,95 s | 1,17 s | `YAPI DOGRULAMA: temiz. 13 modul ...` |
| `npm run sema` | 8,93 s | 6,70 s | `19/19 mutant oldu` |
| `npm run kapi` (komşu yok) | 21,92 s | 14,34 s | çıkış 0; son satırlar `5 gecti, 0 kaldi, 1 atlandi.` |
| `node --test src/kabul-kosusu.test.js` | 2,05 s | 1,60 s | 3/3 |
| `npx -p typescript@5.9.3 tsc -p .` | 16,76 s (soğuk: TypeScript iner) | 4,05 s (önbellekli) | çıkış 0 |
| `AJANS_OS_KOMSU=../komsu/turkce-ajanlar npm test` | 6,95 s | 7,85 s | önce `pass 145`, sonra `pass 179`, `skipped 0` |
| `AJANS_OS_KOMSU=... npm run kapi` | 20,77 s | 15,64 s | çıkış 0 |
| Node 22 (`npx -p node@22 node --test ...`, boruya) | 8,69 s | 10,83 s | TAP: `# tests`, `# pass`, `# skipped` |
| Windows PowerShell 5.1: `git clone ...; cd ajans-os; npm run kapi` | | 18,1 s | çıkış 0 |

"Tek komutla kur, bir dakikada ilk sonuç" tutuyor: klon + kapı, en kötü ölçümle 2,3 + 21,9 = ~24 s; en iyi ölçümle 1,8 + 14,3 = ~16 s. README'deki "16-24 s" bu iki uç. Kapının bitmesi klonlanan sürümden çok makine yüküne bağlı.

## README komutları ve sayıları

| README'deki iddia | Ölçüm | Sonuç |
|---|---|---|
| 145 test (rozet, durum kutusu, `npm test` yorumu) | komşuyla `pass 145`; komşusuz `pass 144` + `skipped 1` | tuttu (yenileme sonrası: 179) |
| `npm test` → `# pass 144`, `# skipped 1` | Node 24: `ℹ pass 144`, `ℹ skipped 1`; Node 22 (boruya): `# pass 144`, `# skipped 1`. CI günlüğü de aynı: `kapi (22)` `# pass`, `kapi (24)` `ℹ pass` | **düzeltildi**: önek yalnız Node 22'nin TAP çıktısında doğruydu; README artık ikisini de söylüyor |
| 13 modül | `src/` altında 13 klasör; `yapi-dogrula.js` "13 modul" | tuttu |
| ~2.848 satır kaynak (test hariç) | `src/**/*.js` içindeki test olmayan dosyalar 2848 satır | tuttu (birebir; `src/*/index.js` değişmedi) |
| 11 ADR | `docs/adr/ADR-000 ... ADR-010` | tuttu |
| 6 şema | `contracts/*.schema.json` = 6 | tuttu |
| "106 kontrollük bir öz-test var" | `sema-dogrula.js --test` bugün 127 `✓` satırı basıyor (19 örnek + 108 kontrol); 106, mutasyon aracı eklendiğindeki sayıydı (commit `4c398c6`: "106 -> 127 kontrol") | **düzeltildi**: "bugün 127; mutasyon aracı eklendiğinde 106'ydı" |
| mutasyon 19/19; ilk ölçümde 8 hayatta | 19/19 mutant öldü; "8 hayatta" `4c398c6` commit mesajında | tuttu |
| `npm run kapi` sonunda `5 gecti, 0 kaldi, 1 atlandi`; kapı yine 0 döner | aynen, çıkış 0 | tuttu |
| `npx -p typescript@5.9.3 tsc -p .` | çıkış 0 | tuttu |
| bağımlılık 0; Node ≥ 22; MIT | `package.json`'da bağımlılık yok, `engines.node >=22`; `LICENSE` MIT | tuttu |
| 40 ajan projesi (yalnızca `project-meta.json` ve GitHub `description`) | `node arac/matris-uret.js --kuru`: "proje: 40 · iz: 6" | tuttu |
| README'deki yerel bağlantılar (22 bağlantı) | hepsi diskte var | tuttu |

## `--help` ve hata mesajları

Sekiz betiğin hiçbiri `--help` bilmiyordu ve çıkış kodları büyük ölçüde doğruydu; sorun sözlerde ve sessizce yutulan bayraklardaydı.

| Girdi | Önce | Sorun | Sonra |
|---|---|---|---|
| `sema-dogrula.js --tset` (yazım hatası) | 19 örneği doğrular, `Sonuç: temiz.`, **çıkış 0** | **Hata.** Öz-test hiç koşmadan "temiz": sessizce geçen doğrulayıcı doğrulamıyor demektir (dosyanın kendi başlığı) | `hata: bilinmeyen bayrak '--tset' — --test mi demek istediniz?`, çıkış 2 |
| `sema-dogrula.js --help` | örnekleri doğrular (33 satır çıktı), çıkış 0 | yardım yok | kullanım, şemalar, çıkış kodları, örnek; çıkış 0 |
| `matris-uret.js --help` | `docs/01-matris.json` + `docs/01-KARSILASTIRMA-MATRISI.md` yeniden yazılır; `git status` kirli | **Hata.** Yardım isteyen ağacı bozuyor | yardım basar; `git status` boş |
| `sema-mutasyon.js --help` | 19 mutantı koşar (7,7 s) | yardım yok | yardım (0,2 s) |
| `yapi-dogrula-test.js --help` | ihlal dosyasını yazıp siler, sınar | yardım yok | yardım |
| `sema-dogrula.js --dosya yok.json --sema task.schema.json` | 21 satırlık yığın izi (`ENOENT`), çıkış 1 | ne olduğu ilk satırda değil | `hata: yok.json okunamadı — böyle bir dosya yok`, çıkış 2 |
| `... --dosya contracts ...` (klasör) | yığın izi (`EISDIR`), çıkış 1 | | `hata: contracts okunamadı — bu bir klasör, dosya değil`, çıkış 2 |
| `... --dosya bozuk.json ...` (geçerli JSON değil) | yığın izi (`SyntaxError`), çıkış 1 | doğrulama sonucu belli değil | `✗ bozuk.json — geçerli JSON değil: Unexpected end of JSON input`, çıkış 1 |
| `... --dosya --sema task.schema.json` (değer yok) | `--sema`'yı dosya sanır, yığın izi, çıkış 1 | | `hata: --dosya bir dosya yolu ister` + kullanım, çıkış 2 |
| `kanit-dogrula.js i1-orkestrasyon` (klon kökü yok) | `ENOENT scandir` yığın izi, çıkış 1 | **Hata.** README'nin önerdiği tek değişken (`AJANS_OS_KLONLAR`) yetmiyor: `AJANS_OS_DEPOLAR`'ın varsayılanı `D:/Repolar` başka makinede yok ve kodda korumasızdı | iki klasörü ve `AJANS_OS_KLONLAR=<klon-kök> node arac/kanit-dogrula.js <iz>` komutunu yazar, çıkış 2; yalnız biri varsa çalışır |
| `kanit-dogrula.js` / `... yok-iz` | kullanım / "iz klasörü yok", çıkış 2 | mevcut izler söylenmiyor | aynı + `izler: i1-orkestrasyon, i2-bellek, ...` |
| `iz-izle.js --help` | kullanım satırı, çıkış 2 | yardım isteği hata sayılıyor | yardım, çıkış 0 |

Doğru kalanlar (aynen korundu): geçerli belge 0, sözleşmeye uymayan belge 1 (beş hata satırı), bilinmeyen `--sema` değeri ve `--dosya` yalnız 2, `iz-izle.js yok.md` 2.

Önce/sonra metinleri: `kanit/ajans-os/once/komutlar.txt`, `sonra/komutlar.txt`.

## README bulguları

- **İlk ekran.** Banner, altı statik rozet, 15 sn'lik "sesli MP4" reel (GIF), "Bir AI Agency Operating System" paragrafı, durum kutusu; komutlar ikinci ekranda ve dörde bölünmüştü, tek komutlu ilk koşu yoktu. Şimdi: tanım, tek komut, süre, demo, kullanılır/kullanılmaz.
- **`docs/reel/reel.{gif,mp4}`**: 1280x720, 15 sn, H.264 + AAC (`Lavf 60.16.100`), 28 Eylül'de eklendi; **üreticisi depoda da makinede de yok**. Yeniden üretilemediği için README'den ve depodan çıkarıldı (git geçmişinde duruyor).
- **`assets/kabul-kosusu.svg`**: "Gerçek bir koşu, üç komut" diyordu ama elle kısaltılmış bir SVG'ydi (Node'un TAP özetinden `# suites`, `# cancelled`, `# skipped`, `# todo`, `# duration_ms` satırları atılmış) ve `npm test` için `145/145` gösteriyordu; komşusuz ilk koşuda 144 + 1 atlanan çıkar. Üreticisi yok → çıkarıldı. Yerine `docs/demo/` geldi.
- **Rozetler:** test/ADR/şema rozetleri elle yazılmış statik sayılardı, CI rozeti yoktu. CI rozeti eklendi; sayıların sapmaması için iki kilit kondu (aşağıda).
- **Windows PowerShell 5.1:** ilk komutun `&&` biçimi ayrıştırma hatası verir (`The token '&&' is not a valid statement separator`, ölçüldü). README artık `;` biçimini ve PowerShell'in ortam değişkeni sözdizimini söylüyor (PowerShell 5.1'de denendi: klon + `npm run kapi` 18,1 s, çıkış 0).
- **`assets/banner.svg`:** profil deposundaki üreticiden geliyor (ilk satır: `generated by github.com/Furkiozknn/Furkiozknn assets/banner/banner.py; edit banners.json there`), GitHub-koyu paleti kullanıyor, FRK-OS değil. Üreticisi bu depoda olmadığı için **dokunulmadı**.
- MCP sunucusu değil; `mcp-vet` araç açıklaması denetimi uygulanmadı.

## Testler ve CI

- Önce: 145 test (komşusuz 144 geçen + 1 atlanan; komşuyla 145/145), `npm run kapi` yeşil. `master`'daki son CI ve CodeQL koşuları yeşil (`36449713888`, `36449713502`). Açık Dependabot PR'ı #3 (actions grubu) bu görevin kapsamı dışı, dokunulmadı.
- Sonra: 179 test. Yeni: `src/arac-cli.test.js` 32 test (sekiz betik için `--help`/`-h` ve bilinmeyen bayrak, `--dosya` hata yolları, `kanit-dogrula.js` klon kökleri, `matris-uret.js --help`'in belge yazmaması) ve `src/belge-sayilari.test.js` 2 test (README modül/ADR/şema/satır sayıları, README komutları ve yerel bağlantıları). Yeni testler eski araçlara karşı koşulduğunda 31 testlik ilk sürümden 29'u düşüyor; düşmeyen iki test "davranış değişmedi" testleridir (geçerli belge 0, sözleşmeye uymayan belge 1).
- CI: `ci.yml`'e "Test sayısı README ve project-meta ile aynı mı" adımı eklendi; koşunun `tests N` satırını (Node 22 `# tests N`, Node 24 `ℹ tests N`: önek değil satırın kendisi) README'deki "N test" ve `project-meta.json`'daki `tests.count` ile karşılaştırır. `kapi (22)` ve `kapi (24)` bacaklarının ikisinde de "Test sayisi tutarli: 179". CI adımları yerelde de (Node 22 ve 24) adım adım koşturuldu.
- Yerel doğrulama: `python schema/dogrula.py ajans-os` → `TAMAM`.

## Günlük "Ekosistem denetimi" (#19, profil deposu)

Bu depoya ait üç açık bulgu var ve üçü de profil deposundaki meta-source ayrışmasının parçası: `project-meta.json` 145 ↔ `meta-source.json` 142; `summary` ↔ GitHub `description` ("142 tests" hâlâ); profil README tablosunda ajans-os için 142. Furki'nin kararı beklendiği için (`/meta` birleşmiş içeriği geri alır) **kapatılmadı**. Bu dalda `project-meta.json`'a yalnızca gerçekten değişen alanlar işlendi: `tests` (179, kaynak, tarih), `summary`'deki test sayısı ve `media.gifs`.

## Çözülmeyenler

- GitHub `description` ("142 tests") ve `meta-source.json` (142) bayat; düzeltme ana oturumda onay bekliyor.
- Banner FRK-OS değil (profil deposundaki üretici).
- `kanit-dogrula-test.js`'in uçtan uca bölümü incelenen projelerin yerel klonlarını ister; yabancı makinede her zaman atlanır (bilinçli, README anlatıyor).
- Node 22'nin `#` önekini yalnız boruya yazılan çıktıda ölçtüm (TTY'de ölçülmedi).
- `npx tsc` ilk çalışmada TypeScript indirdiği için soğuk süre (16,8 s) bir ağ ölçümüdür.
