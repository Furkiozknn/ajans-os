# U15 — Tetikleyici ifade alanı ve K8'in uçtan uca kanıtı — bağımsız inceleme

**Tarih:** 08.09.2026 18:55 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `contracts/agent.schema.json` v2.1 (`triggers`), `src/agent-registry/`
türetici, tuzak #25 (koşu 4d63486)

## Bulgunun kapanışı

Bu madde **U2 incelemesinde bulduğum eksikten** doğmuştu: `turet()` yapısal
olarak geçerli bir Claude Code ajan dosyası üretiyordu ama komşu projenin
doğrulayıcısı onu reddediyordu (tetikleyici ifade yok). Aynı testi şimdi
tekrar koştum:

```
node arac/dogrula.js <turetilen dosya>
Sonuc: 1/1 dosya gecti, 0 hata, 0 uyari
```

**Geçti.** K8 ("ev sahibi biçimleri sözleşmeden türetilir") artık uçtan uca
kanıtlı: kaynak tek (`contracts/`), üretilen dosya hedef ekosistemin kendi
doğrulayıcısından geçiyor. Bir incelemede bulunan boşluk, yol haritasına
madde olarak girip kapandı — döngünün kendi kendini düzeltmesinin somut
örneği.

## Mekanik kontroller

| Kontrol | Sonuç |
|---|---|
| Şema | 19 alan / 18 zorunlu (v2.0'da 18/17 idi); yeni alan `triggers` |
| `triggers` gerekçesi | Şemada yazılı: `capabilities` yeteneği, `mission` amacı taşır; "ne zaman çağrılacağı" alanı yoktu |
| `npm test` | **139 test, 139 geçti** |
| `npm run kapi` | Temiz |

## Yeni tuzak #25 (ölçülmüş)

Türetici `description` içine tetikleyici ifadeleri çift tırnakla koyunca
`JSON.stringify` kaçışı satırı okunmaz yaptı. Tuzak listesine girdi. Bu,
"üretilen dosyayı hedef aracın doğrulayıcısıyla sına" kuralının neden
gerekli olduğunun ikinci kanıtı: yapısal geçerlilik yetmiyor.

## Karar

U15 **bitti**. Faz 5'te kalan tek iş maddesi U14 (uçtan uca kabul koşusu).
