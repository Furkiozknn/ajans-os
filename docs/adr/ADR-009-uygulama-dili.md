# ADR-009 — Uygulama dili: Node ESM, test koşucusu `node:test`

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ1 (ajan çatıları), İ4 (yürütme motorları) — ikisinde de
çalıştırma zinciri ile doğrulama zincirinin aynı çalışma zamanında olması
tekrarlayan bir bulguydu
**Yeniden açılma koşulu:** Faz 5'te bir modülün gerçekten ihtiyaç duyduğu bir
yetenek (ör. yerel bir model kütüphanesi) yalnızca Python'da varsa ve o modül
ayrı bir süreç arkasına konulamıyorsa; veya `node:test` bu depoda ölçülebilir
bir eksikle (ör. adım düzeyinde zaman aşımı) yetmez hâle gelirse.

## Bağlam

[ADR-008](ADR-008-arayuz-dili.md) arayüz dilini TypeScript `.d.ts` olarak
sabitledi ve **uygulama dilini açıkça Faz 5'e erteledi**: *"S2 kapalı değil,
ertelendi: Faz 5'te uygulama dili Python çıkarsa arayüzler `Protocol`a
çevrilir."* ADR-008'in yeniden açılma koşulunun kendisi bu karardır. Faz 5
başlıyor ve ilk madde ([U0](../04-UYGULAMA-YOL-HARITASI.md)) çalışma zamanı
iskeletini istiyor; dil kararı olmadan `package.json` da yazılamaz, test
koşucusu da seçilemez.

Bağlayıcı kısıtlar:

- **Doğrulama zinciri Node'dur.** `arac/` altındaki araçların tamamı Node:
  `sema-dogrula.js`, `kanit-dogrula.js`, `kanit-dogrula-test.js`, `iz-izle.js`,
  `matris-uret.js`, `yapi-dogrula.js`. U1–U14'ün "bitti" ölçütlerinin çoğu bu
  araçları **test içinden** çağırmayı gerektiriyor (U1 kaydı
  `arac/sema-dogrula.js` ile doğrulayacak, U12 izi `arac/iz-izle.js` ile
  okuyacak). Aynı çalışma zamanında olmak bunu tek satır yapar.
- **Python bu makinede PATH'te yok** (`BILINEN-TUZAKLAR.md` #6) ve Türkçe
  Windows'ta Python stdout cp1254 olduğu için Unicode basan araçlar hiç
  başlamıyor (#5). Bu depodaki her belge ve her çıktı Türkçe.
- **Yeni bağımlılık maliyetlidir.** ADR-000 K2 dahil etme ölçütü bileşen için
  yazılmıştı; aynı ölçüt araç zinciri için de geçerli sayılır.
- ADR-008 sonuç kuralı 3 — *"`src/` altında **yalnızca** `.d.ts` bulunur.
  Uygulama Faz 5'in işidir"* — Faz 5 başladığı için **bu ADR ile yerini
  bırakır**; `src/` altında `.js` uygulama dosyaları artık serbesttir,
  `index.d.ts` zorunluluğu ise sürer.

## Seçenekler

### S1 — Node ESM (`"type": "module"`), koşucu `node:test`
- Nasıl çalışır: `src/<modul>/*.js` ESM modülleri; `npm test` →
  `node --test src/**/*.test.js`; tip tarafı `.d.ts` olarak kalır ve
  `tsc --noEmit` ile denetlenir.
- Artı: doğrulama araçlarıyla tek çalışma zamanı; **sıfır yeni bağımlılık**
  (koşucu Node v24.19.0'ın içinde); ADR-008 ile aynı repoda çelişkisiz;
  `arac/*.js` çağırmak `child_process` ya da doğrudan `require` ile bedava.
- Eksi: tip denetimi ile çalıştırma iki ayrı komut — `.js` dosyaları
  `tsconfig.json`'ın `include`una girmediği için imza uyumu **derleyici
  tarafından zorlanmaz**, testle zorlanır.
- Maliyet: bir `package.json`; `arac/` için bir CommonJS kaçış kapısı.

### S2 — TypeScript kaynak, derlenerek çalışır
- Nasıl çalışır: `src/<modul>/*.ts`, `tsc` ile `dist/`e derlenir, testler
  derlenmiş çıktıya bakar.
- Artı: arayüzler ile uygulama aynı denetime girer; imza sapması derleme
  hatasıdır (AP3'e karşı en güçlü seçenek).
- Eksi: `tsc` bu makinede kurulu değil, `npx` ile ağdan çekiliyor (ADR-008'in
  kendi "olumsuz" maddesi) — **çevrimdışı bir turda hiçbir test koşulamaz**.
  U0'ın kapsam dışı listesi derleyiciyi ve bundler'ı zaten dışarıda bırakıyor.
- Maliyet: derleme adımı, kaynak-çıktı ikiliği, ağ bağımlılığı.

### S3 — Python
- Nasıl çalışır: `src/<modul>/*.py`, koşucu `pytest`, arayüzler `Protocol`a
  çevrilir (ADR-008'in yeniden açılma yolu).
- Artı: ekosistem çoğunluğu (İ1'de incelenen 7 projenin 5'i Python).
- Eksi: iki tuzak kaydı doğrudan bunu vuruyor (#5, #6); doğrulama araçları
  Node'da kaldığı için her test bir alt süreçle Node çağırmak zorunda; sekiz
  ADR'nin tamamı yeniden okunup arayüzler çevrilecek.
- Maliyet: ikinci araç zinciri + sekiz arayüz dosyasının çevirisi.

## Karar

**S1 — Node ESM, koşucu `node:test`.** Belirleyici ölçüt yine
doğrulanabilirlik (ADR-000 K3): U1–U14'ün "bitti" ölçütlerinin çoğu bir
`arac/*.js` aracını test içinden çağırmayı gerektiriyor ve **kapı ancak
çalıştırılabilirse kapıdır**. S3 bunu her testte bir süreç sınırına çevirir,
üstelik makinenin iki bilinen tuzağına girer. S2 daha güçlü bir garanti sunar
ama ağa bağımlıdır: `npx tsc` çekilemeyen bir turda test koşusu tamamen durur —
kapının ağ koşuluna bağlı olması AP3'ün gecikmeli hâlidir. S1'de tip denetimi
kaybolmaz, **zorunlu olmaktan çıkar**: `.d.ts` denetimi (ADR-008) arayüz
tutarlılığını korumaya devam eder, uygulama ile arayüzün uyumunu ise test
üstlenir.

**Sonuç kuralları:**

1. `src/` altında uygulama `.js`, ESM (`import`/`export`), CommonJS yok.
   Her modülün `index.d.ts`'i **arayüz kaynağı olarak kalır** (ADR-008);
   `.js` ona uyar, onun yerine geçmez.
2. Test dosyası adı `*.test.js` ve **uyguladığı modülün klasöründe** durur.
   Koşucu `node:test`, iddia `node:assert/strict`. Test çatısı eklenmez.
3. **Bağımlılık eklenmez.** `package.json`'da `dependencies` da
   `devDependencies` de yoktur; biri gerekirse ayrı bir ADR yazılır.
4. ADR-002'nin import yönü kuralı `.js` dosyalarında da geçerlidir ve
   `arac/yapi-dogrula.js` tarafından denetlenir — kural yorumda değil,
   çıkış kodunda.
5. `arac/` CommonJS kalır (`arac/package.json` → `"type": "commonjs"`).
   Altı aracı ESM'e çevirmek U0'ın işi değil; çevrildiklerinde o dosya silinir.

## Dahil etme ölçütü (ADR-000 K2)

| | |
|---|---|
| Çözdüğü problem | Faz 5'in dilsiz başlaması: `package.json` yazılamaz, test koşucusu seçilemez, U1'in "bitti" ölçütü çalıştırılamaz. |
| Önlediği hata | *Kapının kendisinin ulaşılamaz olması*: ağ gerektiren (S2) ya da ayrı bir çalışma zamanı gerektiren (S3) bir kapı, çekilemediği turda sessizce atlanır — AP3'ün gecikmeli biçimi. Ayrıca ikinci bir araç zincirinin bakım borcu. |
| Eklediği maliyet | `.js` uygulama kodu `tsconfig.json`'ın kapsamında değil; arayüz-uygulama uyumu derleyici yerine testin sorumluluğunda. `arac/` için bir CommonJS kaçış kapısı dosyası. |
| Kanıt (≥2 olgun proje veya yaşadığımız bir arıza) | Arıza kanıtı: `BILINEN-TUZAKLAR.md` #5 ve #6 — Python araçları bu makinede iki ayrı nedenle hiç başlamadı; #7 — bütçe duvarında ağdan paket çekmeye kalan tur yarım kalır. Olgunluk kanıtı: depodaki doğrulama araçlarının tamamı Node ve bugüne kadar hepsi çalıştı. |

## Sonuçlar

**Olumlu:** `npm test` tek komutla ve ağsız koşar; sıfır test bile olsa 0 döner
(koşucunun ayakta olduğu böyle sabitlendi). U1–U14 testleri `arac/*.js`
araçlarını doğrudan çağırabilir. Yeni paket yok, `node_modules` yok, kilit
dosyası yok.

**Olumsuz / kabul edilen bedel:** Uygulama kodu tip denetiminden geçmez. Bir
modülün `.js`'i `index.d.ts`'inden saparsa bunu yalnızca test yakalar — bu
yüzden her modülün testi imzayı da (dönen belgenin alanlarını) sınamak
zorundadır, yalnızca mutlu yolu değil.

**Etkilenen sözleşmeler:** Hiçbiri değişmedi. `contracts/*.json` tek kaynak
olmayı sürdürür.

**Etkilenen diğer ADR'ler:** **ADR-008** — sonuç kuralı 3 (*"`src/` altında
yalnızca `.d.ts` bulunur"*) bu ADR ile yerini bırakır; ADR-008'in geri kalanı
(arayüz dili, ad kuralları) yürürlüktedir ve yeniden açılma koşulu **Python
seçilmediği için tetiklenmedi**. ADR-002 — import yönü kuralı artık uygulama
kodunda da denetleniyor. ADR-001 — 13 modül ölçütü değişmedi.

## Uygulama notu

Faz 5'in her maddesinin ortak kapısı üç komuttur; ilk ikisi ağsız çalışır:

```
npm test                                      # node --test src/**/*.test.js
node arac/yapi-dogrula.js                     # ADR-001 + ADR-002
npx -p typescript@5.6 tsc -p tsconfig.json    # ADR-008, ag varsa
```

Test edilebilir ölçüt: `npm run kapi` 0 ile dönüyorsa karar uygulanmıştır —
bu betik üç adımı sırayla koşar ve sonuncusu (`arac/yapi-dogrula-test.js`)
kasıtlı bir `.js` ihlali yazıp denetimin onu **yakaladığını** doğrular,
sonra dosyayı siler.
