# U0 — çalışma zamanı iskeleti ve test kapısı — bağımsız inceleme

**Tarih:** 08.09.2026 16:08 · **İnceleyen:** canlı oturum (üreten koşudan farklı)
**Konu:** `package.json`, `tsconfig.json`, `src/**/index.test.js`,
`arac/yapi-dogrula-test.js`, ADR-009 (koşu de91763)

## Kapı bu incelemede yeniden koşuldu

| Komut | Sonuç |
|---|---|
| `npm test` | Çıkış 0 · 2 test, 2 geçti (koşucu ayakta + ADR-001 ölçütü) |
| `npm run kapi` | Temiz: test + yapı doğrulama + yapı kapısının **kendi testi** |
| `node arac/yapi-dogrula.js` | 13 modül, blueprint §2 ile eşli, import yönü tek |
| Bağımlılık | `dependencies: {}` — ek paket yok, koşucu Node'un kendi `node:test`'i (K3 korundu) |

## Değerlendirme

**Güçlü yan: kapının kendi testi var.** `yapi-dogrula-test.js` ağaca
**kasıtlı bir ihlal** koyuyor (`.js` kardeş import), doğrulayıcının bunu
yakaladığını görüyor ve ağacı geri bırakıyor. Yani "yapı doğrulaması geçti"
cümlesi artık boş değil; doğrulayıcının kör olmadığı ölçülüyor. Bu,
04-DEGERLENDIRME'nin `mutant_yakalama_orani` fikrinin U0'a inmiş hâli ve
Faz 5'in ilk maddesinde uygulanması doğru sıra.

**Güçlü yan: ilk test mimari kısıt sınıyor.** İki testten biri ADR-001'in
"13 modülün her birinde `index.d.ts` var" ölçütü — yol haritasının "her
testte en az bir mimari kısıt" kuralı ilk maddede tutuldu.

**Not: `tsc` çalıştırılmadı.** `npx typescript` ağ gerektiriyor; kapı bunu
atlıyor ve atladığını söylüyor. Kural gereği doğru davranış; tip tutarlılığı
ilk ağ erişimli turda ölçülmeli.

## Karar

U0 **bitti sayılabilir**; ölçütü kendi kapısıyla doğrulandı ve bu inceleme
kapıyı bağımsız olarak yeniden koştu. U1 (`task-manager`) başlayabilir.
