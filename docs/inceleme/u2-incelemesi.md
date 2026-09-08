# U2 — `src/agent-registry/` — bağımsız inceleme

**Tarih:** 08.09.2026 16:26 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/agent-registry/index.js` + testleri (koşu 8d47554)

## Kapı yeniden koşuldu

`npm test` → 13 test, 13 geçti (U1'in 8'i + U2'nin 5'i). `npm run kapi` temiz.

## Bağımsız denemeler

Modülü gerçek sözleşmelerle (`contracts/ornek/`) doğrudan çalıştırdım:

| Çağrı | Sonuç |
|---|---|
| `listele()` | 2 kayıt — diskteki iki örnek sözleşme |
| `dogrula("...")` (bozuk girdi) | **Tipli hata**: `{gecerli:false, hatalar:["<kok>: sozlesme bir nesne olmali"]}` — U1'in ham `TypeError` sorunu burada yok |
| `turet(ad)` (ev sahibi verilmeden) | Anlaşılır hata: "bilinmeyen ev sahibi: undefined (bilinenler: claude-code)" |
| `turet(ad, "claude-code")` | `agents/kod-gozden-gecirici.md` üretti: frontmatter `name`, `description`, `model`, `color`, `tools`, `disallowedTools`, `skills` |

## Bulgu: türetilen dosya komşu projenin doğrulayıcısından geçmiyor

Türetilen `.md`'yi `turkce-ajanlar/arac/dogrula.js` ile sınadım (K8'in gerçek
sınavı budur — ev sahibi biçimi o ekosistemde geçerli mi?):

```
[hata] description: tetikleyici ifade yok — kullanicinin diyecegi bir cumleyi
tirnak icinde yaz ("su klasoru duzenle" gibi) veya "... dediginde kullan"
kalibini kullan
Sonuc: 0/1 dosya gecti
```

Yapısal olarak geçerli ama **ekosistem kuralını** karşılamıyor: Claude Code
ajan seçimini `description` içindeki tetikleyici ifadelere göre yapıyor;
sözleşmede bu bilgiyi taşıyan bir alan yok (`capabilities` yetenek listesi,
`mission` amaç cümlesi — ikisi de tetikleyici değil).

**Sonuç:** K8 ("ev sahibi biçimleri sözleşmeden türetilir") şu an yarım.
İki seçenek var ve karar ADR gerektirir:
1. Sözleşmeye tetikleyici ifade alanı eklemek (`triggers: string[]`,
   `agent.schema.json` v2.1) — kaynak tek kalır, türetme tamamlanır.
2. Türetmenin `x-host` altındaki ev sahibine özel alandan okuması — sözleşme
   sade kalır, ev sahibi bilgisi ev sahibi bölümünde durur.

Bu bulguyu U13/U14 kapsamına bırakmıyorum; **yol haritasına ayrı madde**
olarak eklenmesi doğru olur çünkü sözleşme sürümünü etkiliyor.

## Karar

U2 **bitti sayılabilir** (kendi ölçütü geçiyor), ama K8'in uçtan uca
doğrulaması bu bulgu kapanmadan yapılamaz. Bulgu yol haritasına eklendi.
