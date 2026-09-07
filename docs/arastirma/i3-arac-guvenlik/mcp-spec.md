# MCP — Model Context Protocol (spesifikasyon)

## Kimlik
modelcontextprotocol/modelcontextprotocol · 9.151 yıldız · 184 watcher · son push 2026-09-07 · lisans: geçiş hâlinde — `LICENSE:1` "The MCP project is undergoing a licensing transition from the MIT License to the Apache License, Version 2.0"; yeni katkılar Apache-2.0, belgeler CC-BY-4.0, relicensing izni verilmemiş eski katkılar MIT · TypeScript (şema) + MDX (spec) · arşivlenmemiş
Klon HEAD: `e76e9c5` (2026-09-04). İncelenen sürüm: **2026-07-28** (`docs/specification/2026-07-28/`), depodaki en yeni yayımlanmış sürüm; yanında `draft/` ve beş eski sürüm (`2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25`) duruyor.
canlılık: geçti.

**Bu analiz README'den değil, spec belgesinin kendisinden yapıldı** —
birincil kaynak `docs/specification/2026-07-28/**.mdx` ve normatif şema
`schema/2026-07-28/schema.ts`. Görev bunu açıkça istiyordu.
İnceleme kapsamı: `index.mdx` (güvenlik ilkeleri), `server/tools.mdx`,
`client/sampling.mdx`, `client/elicitation.mdx`, `client/roots.mdx`,
`basic/authorization/security-considerations.mdx`, `schema/2026-07-28/schema.ts`
(`ToolAnnotations`). Kapsam dışı: transport ayrıntıları, `basic/patterns/*`,
`server/utilities/*`, MCP Apps uzantısı, referans sunucu uygulamaları.

## Çözdüğü problem
Bir LLM uygulamasının (host) dış dünyaya — dosya, veritabanı, API, araç —
bağlanmasını tek bir JSON-RPC 2.0 sözleşmesine indirger. Hedef kitle: her
entegrasyonu elle yazmak zorunda kalan uygulama geliştiricisi. Çözdüğü acı:
N model × M araç kombinatoryel entegrasyon yükünü N+M'ye düşürmek. Bizim için
asıl önemi entegrasyon değil, **araç çağrısının güvenlik sözleşmesini nasıl
tanımladığı** — çünkü ADR-000 K6 tam olarak bu sınırı düzenliyor.

## Mimari
Üç rol, `index.mdx:38-40`:

```
Host (LLM uygulaması)          ← güvenlik politikasını UYGULAYAN taraf
  │  içinde N adet Client (bağlayıcı)
  │        │ JSON-RPC 2.0
  └────────┴──→ Server (bağlam ve yetenek sağlayıcı)
```

Mimari belgesindeki tek güvenlik cümlesi host'a ait
(`architecture/index.mdx:56-57`): host "Enforces security policies and consent
requirements" ve "Handles user authorization decisions". Yani **protokolde
zorlayıcı bir izin katmanı yok; zorlama tamamen host'a devredilmiş.** Bu, aşağıda
K6 için en kritik bulgu.

Yetenekler (capability) el sıkışmada karşılıklı ilan edilir; bir tarafın ilan
etmediği yeteneği diğer taraf kullanamaz. Örnek normatif kural
(`client/sampling.mdx:52`): "Servers **MUST NOT** send tool-enabled sampling
requests to Clients that have not declared support for tool use via the
`sampling.tools` capability." Bu, "yetenek = izin ilanı" desenidir ve K6'nın
"ajanlar birbirinin izinlerini devralmaz" maddesinin protokol düzeyindeki
karşılığıdır.

## Klasör yapısı
```
docs/specification/
├── 2026-07-28/            yayımlanmış en yeni sürüm (bu analizin kaynağı)
│   ├── index.mdx          RFC2119 dili + "Security and Trust & Safety" ilkeleri
│   ├── architecture/      roller, host'un sorumlulukları
│   ├── basic/
│   │   ├── authorization/ OAuth 2.1, RFC 8707 resource indicator,
│   │   │                  security-considerations.mdx (saldırı katalogu)
│   │   ├── transports/    stdio, streamable-http
│   │   └── patterns/      cancellation, progress, subscriptions, mrtr
│   ├── client/            roots (dosya sınırı), sampling, elicitation
│   └── server/            tools, resources, prompts, discover
├── draft/                 bir sonraki sürümün çalışma hâli
└── 2024-11-05 … 2025-11-25   dondurulmuş eski sürümler (kırılma geçmişi okunabilir)
schema/<sürüm>/schema.ts   normatif TypeScript şema (ToolAnnotations burada)
seps/                      SEP: spec değişiklik önerileri (yönetişim izi)
```

Not: sürümler **tarih damgalı ve dondurulmuş**. Eski sürüm klasörleri silinmiyor,
duruyor. Bu bizim sözleşme sürümleme kararımız için doğrudan bir örnek.

## Ajan tasarımı
MCP ajanı tanımlamaz — **aracı** tanımlar. Araç sözleşmesi
(`server/tools.mdx:293-306`): `name`, `inputSchema` (geçerli bir JSON Schema
nesnesi olmak **MUST**), opsiyonel `outputSchema` ve `annotations`.

`ToolAnnotations` (`schema/2026-07-28/schema.ts:1912-1953`) dört ipucu taşır:
`readOnlyHint` (varsayılan **false**), `destructiveHint` (varsayılan **true**),
`idempotentHint` (varsayılan false), `openWorldHint` (varsayılan true).

İki şey birden doğru ve ikisi de bizim için önemli:

1. **Varsayılanlar kötümser.** Bir araç aksini söylemedikçe yazan, yıkıcı ve
   açık dünyaya dokunan sayılır. Bu, K6'nın "varsayılan izin salt okuma"
   ilkesiyle aynı yönde ama farklı ifade: MCP "varsayılan olarak tehlikeli
   varsay" der, K6 "varsayılan olarak yetki verme" der. İkisi birbirini
   tamamlıyor.
2. **Bu alanlar yalnızca ipucudur ve güvenilmezdir.** Şema bunu kendi yorumunda
   yazıyor (`schema.ts:1902-1908`): "all properties in `ToolAnnotations` are
   **hints**. They are not guaranteed to provide a faithful description of tool
   behavior" ve "Clients should never make tool use decisions based on
   `ToolAnnotations` received from untrusted servers." Spec metni de aynı şeyi
   normatif olarak söylüyor (`server/tools.mdx:305-306`): "clients **MUST**
   consider tool annotations to be untrusted unless they come from trusted
   servers."

Yani `readOnlyHint: true` bir izin kanıtı **değildir**; sunucunun beyanıdır.
Bizde Permission Manager bu alana **karar verdirmemeli**, yalnızca kullanıcıya
gösterilen bilgi olarak taşımalı.

## Orkestrasyon / iş akışı modeli
Yok — MCP orkestrasyon protokolü değil, bağlantı protokolü. En yakın şey
`sampling`: sunucunun host üzerinden model çağırması (ters yön). 2026-07-28'de
sampling **kullanımdan kaldırılmaya aday** işaretli (`client/sampling.mdx:13-14`):
"New implementations **SHOULD NOT** adopt it; existing implementations
**SHOULD** migrate to integrating directly". `roots` için de aynı uyarı var
(`client/roots.mdx:13-14`). Ters yön çağrının protokolden çekiliyor olması,
"sunucu host'un modelini kullanabilsin" fikrinin pratikte güvenlik/karmaşıklık
bedeliyle geldiğinin işareti.

## Durum ve bellek
Protokol büyük ölçüde durumsuz istek/yanıt; oturum durumu transport katmanında.
Elicitation'da durum tutulacaksa normatif kural var
(`client/elicitation.mdx:475-478`): durum **MUST** kullanıcıyla güvenli biçimde
ilişkilendirilsin, **MUST** yetkisiz erişime karşı korunsun, uzak sunucularda
kullanıcı kimliği mümkün olduğunda MCP authorization'dan gelen `sub` iddiasından
türetilsin. Checkpoint/rollback kavramı protokolde yok.

## Hata yönetimi
Araç hataları modele geri verilir ki model kendini düzeltsin
(`server/tools.mdx:785`): "Clients **SHOULD** provide tool execution errors to
language models to enable self-correction." Timeout istemci tarafında önerilir
(`server/tools.mdx:801`). Retry'da JSON-RPC `id` yeniden kullanılamaz
(`server/tools.mdx:234`).

**İnsan kapısı** protokolün en dikkat çekici yeri ve üç ayrı yerde tekrarlanıyor:

- Araç çağrısı (`server/tools.mdx:33-34`): "For trust & safety and security,
  there **SHOULD** always be a human in the loop with the ability to deny tool
  invocations."
- Sampling (`client/sampling.mdx:37-38`): kelimesi kelimesine aynı cümle, bu kez
  "deny sampling requests".
- Elicitation (`client/elicitation.mdx:39-46`): burada dil sertleşiyor —
  "MCP clients **MUST**: Provide UI that makes it clear which server is
  requesting information; Respect user privacy and provide clear decline and
  cancel options".

Ve kimlik bilgisi için mutlak bir yasak var (`client/elicitation.mdx:29-33`):
"Servers **MUST NOT** use form mode elicitation to request sensitive information
such as passwords, API keys, access tokens, or payment credentials" — bunun
yerine URL modu **MUST**. Bu, bizim `CLAUDE.md`'deki "şifre/kart/kimlik bilgisi
girme" sabit sınırının protokol düzeyindeki eşdeğeri; bağımsız olarak aynı
sonuca varılmış olması güçlü bir sinyal.

`basic/authorization/security-considerations.mdx` ayrı bir saldırı katalogu
tutuyor: token audience binding (**MUST**, `:19-20`), token hırsızlığı (`:25-34`),
karıştırma (mix-up) saldırıları (`:63-65`), açık yönlendirme (`:67`), **confused
deputy** (`:107-110`: "By using stolen authorization codes, they can obtain
access tokens without user consent") ve ayrıcalık kısıtlaması (`:116-124`:
sunucu **MUST** yalnızca kendisi için düzenlenmiş token'ı kabul etsin, audience
iddiasında kendisi geçmeyen token'ı **MUST** reddetsin). Token passthrough
açıkça yasak.

## Genişletilebilirlik
Yeni araç eklemek sunucu tarafında tek bir `tools/list` girdisi; host'ta kod
değişikliği gerekmez. Sürüm uyumluluğu tarih damgalı sürümlerle ve `SEP`
(spec değişiklik önerisi) süreciyle yönetiliyor (`seps/`). Araç adı çakışması
protokolde **çözülmemiş**, açıkça istemciye bırakılmış
(`server/tools.mdx:326-330`): istemciler çakışmayı ele alan bir strateji
uygulamalı ve araç adına belirsizlik giderme için güvenmemeli.

## Güçlü yönler (kanıtlı)
- **Normatif dil disiplini.** RFC2119 anahtar kelimeleri açıkça tanımlanmış
  (`index.mdx:20-25`) ve tutarlı kullanılmış; "MUST" ile "SHOULD" arasındaki
  fark her yerde anlamlı. Bir sözleşme belgesinin nasıl yazılacağının örneği.
- **Kötümser varsayılanlar.** `destructiveHint` varsayılan `true`,
  `openWorldHint` varsayılan `true` (`schema.ts:1933,1953`).
- **Kendi ipucuna güvenmeme.** Şema, kendi alanlarının güvenilmez olduğunu şema
  içinde ilan ediyor (`schema.ts:1902-1908`). Bu ender bir dürüstlük.
- **Kimlik bilgisi için mutlak yasak** (`client/elicitation.mdx:29-33`) —
  yapılandırmayla açılamaz, "MUST NOT".
- **Sürüm arkeolojisi korunuyor**: altı sürüm klasörü yan yana duruyor, hangi
  kuralın ne zaman geldiği okunabiliyor.

## Zayıf yönler (kanıtlı)
- **Protokol hiçbir şeyi zorlayamıyor ve bunu itiraf ediyor**
  (`index.mdx:117-118`): "While MCP itself cannot enforce these security
  principles at the protocol level, implementors **SHOULD**…". Ardından gelen
  beş maddenin tamamı SHOULD. Uyumlu bir istemci, hiç onay sormadan da uyumlu
  kalabilir.
- **İnsan kapısı SHOULD, MUST değil** (`server/tools.mdx:33-34`). Ekosistemin
  fiilî standardı, en riskli işlemde bile onayı zorunlu kılmıyor.
- **Araç açıklaması ve annotation güvenilmez** ama istemcinin "güvenilir sunucu"
  kararını nasıl vereceğine dair mekanizma yok — "unless they come from trusted
  servers" (`server/tools.mdx:306`) ifadesindeki güven tamamen tanımsız.
- **Araç adı çakışması çözülmemiş** (`server/tools.mdx:326-330`); iki sunucunun
  `search` aracı arasında protokol ayrım yapmıyor.
- Sampling ve roots gibi iki güvenlik ilgili yetenek kullanımdan kaldırılma
  yolunda (`client/sampling.mdx:13-14`, `client/roots.mdx:13-14`) — dosya sınırı
  (`roots`) protokolden çekiliyorsa, sınır bilgisi nereye gidiyor sorusu açık.

## Puan (1–5)
olgunluk **5** (altı sürüm, yönetişim süreci, RFC2119 disiplini) ·
mimari netlik **5** · genişletilebilirlik **4** (SEP süreci var, araç adı
çakışması açık) · güvenilirlik ilkelleri **2** (retry/timeout önerisi var,
checkpoint/rollback yok) · gözlemlenebilirlik **2** (yalnızca "log tool usage
for audit purposes", `server/tools.mdx:804`) · güvenlik duruşu **3** —
ilkeler mükemmel yazılmış ama zorlama yok, en kritik kural SHOULD.

## ADR-000 K6 kanıtı

**Sonuç: hem güçlendiriyor hem sınırını gösteriyor — ama çürütmüyor.**

Güçlendiren kanıt:
- "Hosts must obtain explicit user consent before invoking any tool"
  (`index.mdx:112`) — K6'nın "her araç çağrısı Permission Manager'dan geçer"
  maddesiyle aynı.
- "Tools represent arbitrary code execution and must be treated with appropriate
  caution" (`index.mdx:108-109`) — K6'nın gerekçesiyle birebir.
- Kimlik bilgisi toplama için mutlak yasak (`client/elicitation.mdx:29-33`),
  K6'nın "hiçbir yapılandırma bunu kapatamaz" dilinin kanıtlanmış bir örneği:
  MUST NOT kullanılınca yapılandırma tartışması bitiyor.
- Yetenek el sıkışması (`client/sampling.mdx:52`) K6'nın "ajanlar birbirinin
  izinlerini devralmaz" maddesini protokol düzeyinde örnekliyor.

**K6'yı zorlayan kanıt (kaydedilmeli):** ekosistemin en yaygın araç protokolü,
insan kapısını **SHOULD** olarak yazdı, MUST olarak değil
(`server/tools.mdx:33-34`) ve zorlayamadığını açıkça kabul etti
(`index.mdx:117-118`). Bu K6'yı çürütmez — K6 bir *ürün* kararı, MCP ise
*birlikte çalışabilirlik* belgesi; MUST yazsa uyumsuz istemciler doğardı. Ama
şunu gösteriyor: **K6'yı biz uygulamazsak kimse uygulamıyor.** Bağlandığımız
her MCP sunucusunun karşısında onay kapısını host olarak biz kurmak
zorundayız; protokolün varlığı bize hiçbir garanti vermiyor. Bu, Permission
Manager'ı "isteğe bağlı bir katman" değil, **zorunlu tek geçiş noktası** yapan
en güçlü gerekçe.

## Alınacak fikir
- **Kötümser varsayılanlar, ipucu olarak taşınan meta veri.** `destructiveHint`
  varsayılanı `true` (`schema.ts:1933`) + "bu alanlara karar verdirme"
  (`schema.ts:1907-1908`). Bizim araç sözleşmemizde aynı ayrımı yapalım: aracın
  *beyan ettiği* risk (bilgi, kullanıcıya gösterilir) ile *politikanın atadığı*
  risk (karar, Permission Manager'da) ayrı alanlar olsun. Beyan asla karara
  girdi olmasın.
- **Yetenek el sıkışması = izin ilanı.** İki taraf da ilan etmediği yeteneği
  kullanamaz (`client/sampling.mdx:52`). Ajan-ajan iletişiminde aynı kural:
  çağıran ajan, çağrılan ajanın ilan etmediği bir yeteneği isteyemez.
- **Kimlik bilgisi için MUST NOT dili.** `client/elicitation.mdx:29-33`
  biçimindeki mutlak yasak, bizim sabit sınırlarımızın nasıl yazılacağının
  örneği: yapılandırma anahtarı olmayan kural.
- **Tarih damgalı dondurulmuş sürümler + değişiklik önerisi süreci** (`seps/`).
  Sözleşme şemamız (`contracts/agent.schema.json`) değiştiğinde eski sürümü
  silmek yerine dondurmak.
- **Saldırı katalogunu spec'in yanında tutmak**
  (`basic/authorization/security-considerations.mdx`): confused deputy, token
  passthrough, mix-up. Güvenlik mimarimizde aynı biçimde ayrı bir tehdit listesi
  olmalı, ilkelerin içine gömülü değil.

## Alınmayacak
- **İnsan kapısını SHOULD yapmak** (`server/tools.mdx:33-34`). Bizde geri
  alınamaz işlem kapısı MUST; K6 bunu zaten söylüyor ve MCP'nin gerekçesi
  (birlikte çalışabilirlik) bizde geçerli değil.
- **Zorlamayı tamamen host'a devretmek** (`index.mdx:117-118`). Bizde host da
  bizim kodumuz; devredecek kimse yok.
- **Annotation'a dayalı otomatik izin verme.** `readOnlyHint: true` gördüğü için
  onay atlayan bir uygulama, spec'in kendi uyarısını
  (`schema.ts:1907-1908`) ihlal eder. Bu tuzağa düşmemek için Permission
  Manager'da annotation okuma yolu ile karar yolu ayrı tutulacak.
- **Sampling deseni** (sunucunun host modelini çağırması) — protokolün kendisi
  çekiliyor (`client/sampling.mdx:13-14`); bizde de araç, çağıranın modeline
  erişemesin.

Matris: saglayici_bagimsiz=evet · sozlesme_var=evet · insan_kapisi=kismen (üç yerde ısrarla önerilmiş ama üçünde de SHOULD; yalnızca elicitation'da MUST'a dönüyor) · checkpoint=hayir
