# U7 — `src/model-router/` — bağımsız inceleme

**Tarih:** 08.09.2026 17:10 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `src/model-router/index.js` + testleri (koşu 06c1e0a)

## Kapı yeniden koşuldu

`npm test` → **70 test, 70 geçti** (U7'nin payı 14). `npm run kapi` temiz.

## Bağımsız denemeler

| Deneme | Sonuç |
|---|---|
| Kaynakta sağlayıcı adı (`grep -ciE "openai\|anthropic\|azure\|bedrock\|gemini\|claude\|gpt"`) | **0 eşleşme** — D2'nin "seçim mantığı agnostik" kuralı ölçüldü, iddia edilmedi |
| Tavan altında `tahmini_usd: null` olan model | Eleniyor: *"maliyeti bilinmiyor, tavan altinda secilemez"* — kural 11 (bilinmeyen maliyet `null`, sıfır değil) fail-safe uygulanmış |
| Karşılanamayan istek | İstisna **eleme gerekçeleriyle**: hangi modelin neden elendiği tek tek yazılı |
| Eksik katalog alanı | Ad vererek reddediliyor (`katalog[0].baglam_token pozitif sonlu bir sayi olmali`) |

Taşıyıcının döndürdüğü belge de bir güven sınırından geçiyor: `usage`
dönmeyen çağrı kabul edilmiyor ("olculemeyen cagri kabul edilmez").

## Not: `tahmini_usd` çağıranın sorumluluğunda

Katalog girdisi fiyat tablosu değil, **çağrı başına tahmini maliyet**
taşıyor. Yani tahmini token sayısından USD'ye çeviren taraf Model Router
değil, onu çağıran (Cost Manager, U8). Bu bilinçli bir sınır olabilir ama
iki modülün sözleşmesi U8'de tutarlı olmalı; U8 incelemesinde bunu
kontrol edeceğim.

## Karar

U7 **bitti sayılabilir**. Sağlayıcı bağımsızlığı ölçüldü, bilinmeyen maliyet
kuralı fail-safe çalışıyor.
