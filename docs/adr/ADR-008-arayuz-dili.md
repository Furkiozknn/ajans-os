# ADR-008 — Arayüz dili: TypeScript `.d.ts`

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ1 (ajan çatıları), İ4 (yürütme motorları) — her ikisinde de
sözleşmelerin şema tarafı JSON Schema, kod tarafı tip
**Yeniden açılma koşulu:** Faz 5'te uygulama dili Python seçilirse (o zaman
arayüzler `Protocol` olarak yeniden yazılır, bu ADR yerine geçer); veya
`.d.ts` dosyalarının tip denetimi bu makinede çalıştırılamaz hâle gelirse.

## Bağlam

Yol haritası Faz 4'ün ilk maddesi arayüz tanımını istiyor ve dili açıkça
karara bırakıyor: *"TypeScript `.d.ts` veya Python Protocol — dil kararı ADR
ile"*. Karar verilmeden `src/` iskeleti yazılamaz.

Bağlayıcı kısıtlar:

- **Sözleşmeler JSON Schema'dır** (`contracts/*.json`, blueprint §3.3). Dil ne
  olursa olsun tek kaynak orasıdır; arayüz dili yalnızca o şemaların imzada
  görünen yüzüdür.
- **Depoda çalışan her araç Node'dur:** `arac/sema-dogrula.js`,
  `arac/kanit-dogrula.js`, `arac/iz-izle.js`, `arac/matris-uret.js`,
  `arac/kanit-dogrula-test.js`. Doğrulama zinciri bugün Node üzerinde duruyor.
- **Python bu makinede PATH'te yok** (`BILINEN-TUZAKLAR.md` #6) ve Türkçe
  Windows'ta Python stdout cp1254 olduğu için Unicode basan araçlar hiç
  başlamıyor (#5). Node için böyle bir tuzak kaydı yok.
- ADR-000 K3: sözleşme değişikliği doğrulanabilir olmalı. Bir arayüz tanımı,
  **çalıştırılabilir bir kontrolü yoksa** belge hükmündedir.

## Seçenekler

### S1 — TypeScript `.d.ts`
- Nasıl çalışır: her modül `src/<modul>/index.d.ts`; ortak sözleşme tipleri
  `src/tipler.d.ts`; denetim `npx tsc --noEmit`.
- Artı: depodaki araç zinciriyle aynı çalışma zamanı; tip denetimi tek komutla
  çalışır ve çıkış kodu üretir; `.d.ts` **yalnızca tip** taşır — kazara uygulama
  yazmak dilin kendisi tarafından engellenir (Faz 4'ün "uygulama yok" şartı).
- Eksi: `tsc` yerelde kurulu değil, `npx` ile çekiliyor — ağ gerektirir.
- Maliyet: bir `tsconfig.json`; ilk `npx` çağrısında paket indirme.

### S2 — Python `Protocol` (`.pyi` veya `protocols.py`)
- Nasıl çalışır: `typing.Protocol` sınıfları; denetim `mypy`/`pyright`.
- Artı: ajan ekosisteminin çoğunluğu Python (İ1'de incelenen 7 projenin 5'i);
  Faz 5'te bir Python kütüphanesini doğrudan kullanmak kolaylaşır.
- Eksi: bu makinede Python PATH'te yok (#6); `uv run` üzerinden çalışır ama
  doğrulama zinciri Node'da olduğu için iki çalışma zamanı bakımı doğar.
  cp1254 tuzağı (#5) her doğrulama komutuna ortam değişkeni eklemeyi
  zorunlu kılar.
- Maliyet: ikinci bir araç zinciri; `arac/*.js` ile bölünmüş doğrulama.

### S3 — Dilsiz: arayüzleri yalnızca markdown tablo olarak yaz
- Artı: hiçbir çalışma zamanı gerekmez.
- Eksi: AP3'ün tanımı — *beyan edilen garantinin kodda karşılığı yok*.
  Arayüzler arası tutarsızlık (yanlış tip adı, olmayan alan) hiçbir zaman
  yakalanmaz.
- Maliyet: görünürde sıfır, gerçekte Faz 5'te ödenir.

## Karar

**S1 — TypeScript `.d.ts`.** Belirleyici ölçüt, dilin popülerliği değil
**doğrulanabilirlik**: arayüz tanımı ancak bir komutla denetlenebiliyorsa
sözleşmedir, yoksa belgedir (ADR-000 K3, AP3). Node zinciri bu makinede
çalışıyor ve tuzak kaydı yok; Python'un iki ayrı tuzağı var (#5, #6).

S2 kapalı değil, **ertelendi**: Faz 5'te uygulama dili Python çıkarsa
arayüzler `Protocol`a çevrilir — çeviri kaynağı yine `contracts/*.json`
olduğu için maliyeti sınırlıdır. S3, AP3'ün kendimize dönük hâli olurdu.

**Sonuç kuralları:**

1. Sözleşme alan adları JSON şemasındaki **İngilizce adların birebir aynısı**
   (`step_id`, `contract_version`, `decision`). Çeviri yok; şema ile kod
   arasında ad eşlemesi tutmak zorunda kalmamak için.
2. Metot ve tip adları **Türkçe**; metotlar snake_case. Bu, ADR-004'ün zaten
   sabitlediği `gecerli_mi()` / `esigi_asti_mi()` adlarıyla aynı biçimdir;
   ikinci bir adlandırma kuralı açmamak için tümü ona uyar.
3. `src/` altında **yalnızca** `.d.ts` bulunur. Uygulama Faz 5'in işidir.

## Dahil etme ölçütü (ADR-000 K2)

| | |
|---|---|
| Çözdüğü problem | Faz 4'ün arayüz maddesinin dilsiz kalması; 13 bileşenin imzalarının birbirine uyduğunun hiçbir yerde kontrol edilememesi. |
| Önlediği hata | *Belge hükmünde arayüz* (AP3): tip adı uyuşmazlığı, olmayan alana referans, iki modülün aynı kavrama iki ad vermesi — üçü de `tsc --noEmit` ile yakalanır. |
| Eklediği maliyet | Bir `tsconfig.json` ve doğrulama için ağ üzerinden `npx -p typescript tsc`; Faz 5'te Python seçilirse bir çeviri turu. |
| Kanıt (≥2 olgun proje veya yaşadığımız arıza) | Arıza kanıtı: `BILINEN-TUZAKLAR.md` #5 ve #6 — Python araçları bu makinede iki ayrı nedenle hiç başlamadı. Olgunluk kanıtı: depodaki beş doğrulama aracının beşi de Node ile yazılmış (`arac/*.js`). |

## Sonuçlar

**Olumlu:** `npx -p typescript@5.6 tsc -p tsconfig.json` çıkış kodu 0 verdiği
sürece 13 arayüz birbiriyle tutarlıdır. `node arac/yapi-dogrula.js` ise
klasör kümesinin ADR-001 ile ve import yönünün ADR-002 ile uyumunu kontrol
eder. İkisi birlikte Faz 4 çıktısının otomatik kapısıdır.

**Olumsuz / kabul edilen bedel:** Tip denetimi ağa bağlı (`npx` indirmesi);
çevrimdışı bir turda yalnızca `yapi-dogrula.js` çalışır ve bu durum günlüğe
yazılır. Faz 5'te Python seçilirse arayüzler yeniden yazılır.

**Etkilenen sözleşmeler:** Hiçbiri değişmedi. `src/tipler.d.ts` şemaların
**türevi**dir; çelişki hâlinde şema haklıdır ve bu kural dosyanın başındaki
yorumda yazılıdır.

**Etkilenen diğer ADR'ler:** ADR-001 (13 modül klasörü ölçütü artık
çalıştırılabilir), ADR-002 (import yönü artık denetleniyor), ADR-004 (metot
adları arayüze birebir girdi).

## Uygulama notu

Test edilebilir ölçüt: `npx -p typescript@5.6 tsc -p tsconfig.json` ve
`node arac/yapi-dogrula.js` komutlarının ikisi de 0 ile dönüyorsa karar
uygulanmıştır. Ayrıntı: `docs/mimari/08-YAPI-VE-ARAYUZLER.md`.
