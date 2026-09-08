# Anti-pattern'ler — bağımsız inceleme

**Tarih:** 08.09.2026 13:25 · **İnceleyen:** canlı oturum (belgeyi üreten koşudan farklı)
**Konu:** `docs/03-ANTI-PATTERNLER.md` (koşu e776e15, 16,9 dk, 4,73 USD; 11 anti-pattern, 8 elenen aday)

## Kanıt zinciri

Yeni araçla (`arac/iz-izle.js`) ölçüldü: belgedeki **32 farklı `dosya:satır`
alıntısının 32'si** iz belgelerinde birebir aynı satır numarasıyla geçiyor
(`docs/inceleme/iz-izlenebilirlik.md`). Belge kendi §7'sinde 35 atıf + 17
sembol = 52 kontrol yaptığını söylüyor; aradaki fark yöntemsel (o `grep -rF`
ile sembolleri de saydı, araç yalnızca `dosya:satır` biçimini sayıyor).
İki ölçüm de aynı sonuca varıyor: **uydurma alıntı yok.**

Klonlarda örnekleme (AP1'in kanıt satırları): LangGraph `types.py:851`
`def interrupt(...)` ✓, Aider `args.py:760` `--yes-always` ✓, OpenHands
`confirmation_policy.py:35-41` `class NeverConfirm` / `return False` ✓,
TextGrad `optimizer.py:186` `parameter.set_value(new_value)` ✓,
MCP `server/tools.mdx` insan kapısı uyarısı ✓ (İ3 denetiminde de doğrulanmıştı).

## Bir ifade düzeltmesi

**SWE-agent `_dry_run` cümlesi yanıltıcı** (03 belgesi satır 96-99, kaynağı
İ6 `swe-agent.md:136-139`). Belge "`_dry_run` parametresi tanımlı ama çağrı
yerinde kullanılmıyor" diyor. Klonda kontrol edildi:

- Parametre **fonksiyon gövdesinde kullanılıyor**: `open_pr.py:51`
  (`--allow-empty`), `:84-86` (`echo ` öneki ile push simülasyonu), `:101`
  (`if not _dry_run:` PR açmayı koruyor).
- Ama **tek çağrı yeri** (`open_pr.py:141-147`, `OpenPRHook.on_instance_completed`)
  parametreyi hiç geçmiyor; varsayılan `False`. Yani dry-run yolu koda
  yazılmış ama hiçbir zaman etkinleşmiyor.

İddianın **sonucu doğru** (hook etkinse gerçek PR açılır, onay yok), ifadesi
yanlış okunmaya açık. Önerilen düzeltme: *"`_dry_run` yolu gövdede var ama
tek çağrı yerinde geçilmiyor, varsayılan `False`"*. Belge sahibi turu
düzeltebilir; puanı veya AP1'in geçerliliğini değiştirmez.

## Yapı ve tutarlılık

- Giriş şartı (**2+ iz** ya da **tek izde 3+ proje**) 11 maddenin 10'unda
  sağlanıyor; sağlamayan tek madde (AP11, tek iz + 2 proje) hem tabloda hem
  §7'de **açıkça istisna olarak işaretli**. Bu, ölçütü gizlemek yerine
  görünür kılan doğru davranış.
- AP1'in "5 iz, 9 kaynak" iddiası kanıt tablosundan sayıldı: İ1, İ2, İ3, İ4,
  İ6 = 5 iz ✓; LangGraph, Letta, MCP, A2A, Aider, OpenHands, SWE-agent,
  TextGrad + İ4'ün "7 projeden yalnızca biri" bulgusu = 9 ✓.
- §5 ayna tablosu 02 belgesindeki desen numaralarıyla tutarlı (D2, D3, D4,
  D5, D6, D9, D10, D11, D12, D13 geçiyor; AP9 ve AP10 için "aynası yok"
  denmiş — 02'nin "boşluklar" bölümüyle örtüşüyor).
- §4'teki 8 elenen adayın her birinde "ne olursa geçer" satırı var; bu, Faz 3
  ve sonraki araştırma turları için doğrudan kullanılabilir bir kuyruk.

## Karar

Belge Faz 3 için **kullanılabilir**. §6'daki 12 bağlayıcı kural doğrudan
mimari ADR'lerine girdi olabilir. Tek açık iş, yukarıdaki ifade düzeltmesi.

## Yeni araç

`arac/iz-izle.js` bu incelemede yazıldı: bir Faz 2/3 belgesindeki her
`dosya:satır` alıntısının iz belgelerinde karşılığı olup olmadığını sınar
(BİREBİR / YAKIN / YOK), `--yaz` ile `docs/inceleme/iz-izlenebilirlik.md`
üretir, YOK varsa çıkış kodu 1. `kanit-dogrula.js` belge→kod zincirine,
bu araç belge→iz zincirine bakar. Sonraki Faz 3 belgeleri için de geçerli.
