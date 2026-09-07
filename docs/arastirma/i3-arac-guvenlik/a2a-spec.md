# A2A — Agent2Agent Protocol (spesifikasyon)

## Kimlik
a2aproject/A2A · 25.678 yıldız · 236 watcher · son push 2026-09-04 · Apache-2.0 · Shell (GitHub'ın dil tespiti; depo fiilen `.proto` + Markdown spec) · arşivlenmemiş
Klon HEAD: `98853be` (2026-09-01). İncelenen sürüm: spec **1.0.1** (`CHANGELOG.md:3` "[1.0.1](...) (2026-05-26)"; 1.0.0 → `CHANGELOG.md:12`, 2026-03-12).
canlılık: geçti.

**Bu analiz README'den değil, spesifikasyonun kendisinden yapıldı** —
birincil kaynaklar `docs/specification.md` (3.618 satır, RFC 2119 dili) ve
normatif `specification/a2a.proto` (812 satır). Görev bunu açıkça istiyordu.
İnceleme kapsamı: §1 (amaç/ilkeler), §1.4 (normatiflik), §4.6 (uzantılar),
§7 (kimlik doğrulama ve yetkilendirme, özellikle §7.6 In-Task Authorization),
§8 (Agent Card keşfi ve imzalama), §13.1–13.2 (yetkilendirme sınırları,
push notification güvenliği), `a2a.proto` (TaskState, AgentCard,
SecurityScheme, AgentExtension). Kapsam dışı: §5–6 (binding ayrıntıları ve
örnekler), §9–12 (JSON-RPC/gRPC/REST binding gövdeleri), SDK'lar
(ayrı depolarda), `docs/tutorials/`.

## Çözdüğü problem
Farklı satıcılar, diller ve çatılarla yazılmış **birbirine kapalı (opaque)**
ajanların birbirini bulup iş delege edebilmesi. Hedef kitle: birden çok
ekibin/şirketin ajanlarını aynı işe koşmak zorunda olan kurumsal
entegratör. Çözdüğü acı, `specification.md:15-21`'de açık: ajanların
"**birbirinin iç durumuna, belleğine veya araçlarına erişmesine gerek
kalmadan**" güvenli bilgi alışverişi. MCP'nin tersi yönde bir sözleşme:
MCP ajanı **araca** bağlar (dikey), A2A ajanı **ajana** bağlar (yatay).
`specification.md:3611` bunu kendisi de söylüyor — A2A ajanların *ortak
çalışması veya iş delege etmesi* ile ilgili.

Bizim için asıl önemi entegrasyon değil, **güven sınırının nereye
konduğu**: ADR-000 K6 "ajanlar birbirinin izinlerini devralmaz" diyor;
A2A tam olarak bu ayrımı protokol seviyesinde kuran ilk yaygın belge.

## Mimari
İki rol ve bir keşif belgesi (`specification.md:135-137`):

```
A2A Client  ──(1) GET /.well-known/agent-card.json──→  A2A Server
   │                    ← AgentCard (kimlik + skills + securitySchemes + signatures)
   │
   │        (2) kimlik bilgisi bant dışı (out-of-band) edinilir  ── §7.3
   │
   └──(3) message:send / message:stream ──→  Task (durumlu, uzun ömürlü)
                                              │
                       ┌──────────────────────┴───────────────────────┐
                       │  TaskState makinesi (a2a.proto:189-207)      │
                       │  SUBMITTED → WORKING → COMPLETED/FAILED      │
                       │        ↘ INPUT_REQUIRED  (6)  kesintili      │
                       │        ↘ AUTH_REQUIRED   (8)  kesintili      │
                       │        ↘ REJECTED        (7)                 │
                       └─────────────────────────────────────────────┘
                       │
   ←──(4) stream (SSE) / push notification (webhook) / polling ──┘
```

**Normatiflik zinciri açıkça tanımlı** (`specification.md:107`): tek
otoriter kaynak `a2a.proto`; üretilen JSON şeması "non-normative build
artifact"tır ve depoda **tutulmaz**; SDK bağlamaları elle düzenlenemez,
proto'dan yeniden üretilmelidir. Bu, MCP'nin TypeScript `schema.ts` +
MDX ikilisinden farklı ve daha sıkı bir tek-kaynak disiplini.

## Klasör yapısı
```
specification/
  a2a.proto           ← TEK normatif kaynak (812 satır); buf ile lint+codegen
  buf.yaml, buf.gen.yaml, .api-linter.yaml   ← şema kalite kapıları
  json/README.md      ← "a2a.json build sırasında üretilir, commit'lenmez"
docs/
  specification.md    ← RFC 2119 dilinde tam protokol metni (3.618 satır)
  topics/             ← enterprise-ready, a2a-and-mcp, life-of-a-task, extensions,
                        agent-discovery, multi-tenancy, streaming-and-async
  whats-new-v1.md, roadmap.md
adrs/                 ← yalnızca 2 dosya: adr-001-protojson-serialization.md + şablon
GOVERNANCE.md, SECURITY.md, MAINTAINERS.md
```
Dikkat çeken: kod yok. Depo saf sözleşme + belge; SDK'lar (`a2a-python`,
`a2a-js`, …) ayrı depolarda. Bu, "sözleşme önce" disiplininin somut hâli.

## Ajan tasarımı
Ajan tanımı **AgentCard** adlı makine-okur JSON belgesidir ve
`a2a.proto`'da mesaj olarak tanımlıdır. Keşif üç yoldan
(`specification.md:1986-1990`): well-known URI
(`https://{domain}/.well-known/agent-card.json`), kayıt defteri/katalog,
ya da doğrudan yapılandırma. Sunucu Agent Card yayınlamak **zorundadır**
(`specification.md:1980` "MUST make an Agent Card available").

Sözleşmenin güvenlikle ilgili alanları (`a2a.proto`):
- `map<string, SecurityScheme> security_schemes = 8;` (`a2a.proto:382`) —
  API key / HTTP auth / OAuth2 / OpenID Connect / **mutual TLS**
  (`a2a.proto:549` "TLS is required.", `:595` `pkce_required`).
- `repeated AgentCardSignature signatures = 13;` (`a2a.proto:396`) — kartın
  JWS imzaları.
- `repeated AgentExtension extensions = 3;` (`a2a.proto:418`) ve içinde
  `bool required = 3;` (`a2a.proto:430`) — uzantı **zorunlu** işaretlenebilir.
- `AgentSkill` — yetenek beyanı; `securitySchemes`'e skill bazında referans
  verilebiliyor (`a2a.proto:497` "A map of security schemes to the required scopes.").

**Yetenek beyanı var, yetki beyanı yok.** Kart "ne yapabilirim" ve "bana
nasıl kimlik doğrularsın"ı söylüyor; "hangi yan etkileri yaratırım"ı
söylemiyor. MCP'nin `ToolAnnotations`'ındaki `destructiveHint` /
`readOnlyHint` karşılığı A2A'da **yok**. Bu, iki protokolün ortak boşluğu
değil; MCP'de en azından (bağlayıcı olmayan) bir ipucu var, A2A'da hiç yok.

## Orkestrasyon / iş akışı modeli
Graf veya DAG değil: **durum makineli görev (Task) delegasyonu**. Bir
istemci mesaj gönderir, sunucu bir Task açar, Task yaşam döngüsü boyunca
durum değiştirir. Paralellik protokolde tanımlı değil — istemci birden
çok Task açarak paralelleştirir. `contextId` ile ilişkili Task'lar
gruplanır (`specification.md:584`).

Kritik nokta **zincirleme delegasyon**: bir istemci kendisi de A2A ajanı
ise, aldığı yetkilendirme isteğini kendi istemcisine devredebilir ve
kendi Task'ını `TASK_STATE_AUTH_REQUIRED`'a geçirebilir
(`specification.md:1945-1947`) — "This enables forming a chain of Tasks in
`TASK_STATE_AUTH_REQUIRED`". Yani insan onayı kapısı **zincir boyunca
yukarı taşınabiliyor**; en tepede duran insan görüyor.

## Durum ve bellek
Task durumu sunucuda yaşar ve kalıcıdır (`Get Task`, `List Tasks` ile
sorgulanır). Checkpoint/rollback kavramı **yok**; durum makinesi ileri
yönlüdür, `CANCELED` var ama "geri al" yok. Mesaj geçmişi için açık
uyarı var (`specification.md:762`): mesajlar "**MUST NOT** be considered a
reliable delivery mechanism for critical information" — istemci yeniden
bağlandığında ara mesajları kaçırabilir; kritik bilgi Artifact'a
yazılmalı. Bu, bizim iz (trace) tasarımımız için doğrudan uyarı: karar
kanıtı akış mesajında değil, kalıcı yapıda durmalı.

## Hata yönetimi
Push notification tarafında somut ve sert kurallar var
(`specification.md:3113-3130`): ajanlar webhook isteklerine kimlik bilgisi
koymak **zorunda**; 10-30 sn timeout, üstel geri çekilmeli retry, ardışık
başarısızlıktan sonra teslimatı bırakabilme; ve **SSRF savunması** —
özel IP aralıklarını (127/8, 10/8, 172.16/12, 192.168/16), localhost ve
link-local adresleri reddet, mümkünse allowlist kullan. İstemci tarafında:
webhook özgünlüğünü doğrula, payload'daki task ID beklenen bir Task'a mı
ait bak, **idempotent** işle (tekrar teslimat olabilir), hız sınırı koy.

Bilgi sızdırmama kuralı da açık: `specification.md:514` — "Servers **MUST
NOT** reveal the existence of resources the client is not authorized to
access", ve `:3106` — yetki kontrolü, kaynağın varlığını sızdırabilecek
**herhangi bir veritabanı sorgusundan önce** yapılmalı.

## Genişletilebilirlik
`AgentExtension` ile uzantı bildirimi (`specification.md:1002-1076`):
uzantı bir URI ile adlandırılır, kartta ilan edilir, istemci
`A2A-Extensions` HTTP başlığıyla (veya binding'e özgü eşdeğeriyle) opt-in
eder. Sürüm uyumsuzluğunda kural sert (`specification.md:1141`): ajan
desteklemediği uzantıyı yok sayar, ama uzantı `required` işaretliyse hata
döndürmek **zorunda**, ve "**MUST NOT** fall back to a previous version of
the extension automatically" — sessiz sürüm düşürme yasak.

Yeni ajan eklemek: bir Agent Card yayınla + endpoint aç. Çekirdek
değişikliği yok. Bu model bizim Agent Registry'miz için doğrudan bir
şablon.

## Güçlü yönler (kanıtlı)
- **Tek normatif kaynak, üretilmiş her şey non-normatif** (`specification.md:107`) —
  şema sürüklenmesini yapısal olarak engelliyor; JSON artefaktı bilerek
  commit'lenmiyor.
- **`TASK_STATE_AUTH_REQUIRED` birinci sınıf bir durum** (`a2a.proto:206-207`,
  "Indicates that authentication is required to proceed. This is an
  interrupted state.") — insan/yetki kapısı protokolün durum makinesine
  gömülü, yan mekanizma değil. `INPUT_REQUIRED` (`:201`) ile ayrı tutulmuş:
  "bilgi eksik" ile "yetki eksik" farklı durumlar.
- **Onay kapısının zincir boyunca delege edilebilmesi** (`specification.md:1945-1947`) —
  çok katmanlı ajan sistemlerinde onayın en tepedeki insana ulaşması için
  tanımlı bir yol.
- **Agent Card imzalama tam belirtilmiş** (`specification.md:2068-2145`): JWS
  (RFC 7515) + RFC 8785 kanonikleştirme, `kid`/`jku` ile anahtar bulma,
  çoklu imzayla anahtar döndürme, "expired veya revoked anahtar **MUST
  NOT** kullanılır". Ajan kimliği için uçtan uca uygulanabilir bir reçete.
- **Somut, uygulanabilir güvenlik kuralları** — SSRF için IP aralıklarını
  saymak (`:3122-3125`), yetki kontrolünü sorgudan önceye almak (`:3106`)
  gibi maddeler "güvenli olun" nasihatinden fark ediliyor.

## Zayıf yönler (kanıtlı)
- **Agent Card imzalama MAY.** `specification.md:2014`: kartlar "**MAY** be
  digitally signed". Doğrulama tarafı da yumuşak: `:2140` istemciler en az
  bir imzayı doğrulamalı — ama "**SHOULD**". Yani uyumlu bir A2A istemcisi
  imzasız karta güvenerek hiçbir kuralı çiğnemiyor. Ajan kimliği
  **opsiyonel**.
- **Yetkilendirme modeli tamamen uygulamaya bırakılmış.**
  `specification.md:3105`: "Authorization boundaries are defined by each
  agent's authorization model, **not prescribed by the protocol**". §7.5
  yetkilendirmenin neyi *dikkate alabileceğini* sayıyor (skill, eylem,
  veri, scope) ama hiçbirini zorunlu kılmıyor.
- **`AUTH_REQUIRED` bir yetki *değil*, yalnızca bir sinyal.** §7.6.4 bunu
  üç kez tekrarlıyor (`specification.md:1968`, `:1972`): ajanlar bu durum
  geçişini "kendi başına herhangi bir işlem için yetki olarak **MUST NOT**"
  saymalı; alınan kimlik bilgisi sonraki mesajları yetkilendirdiği
  varsayılamaz. Kapının *kilidi* protokolde yok — yalnızca kapının
  *çerçevesi* var.
- **Yan etki beyanı yok.** Skill'ler yeteneği tanımlıyor; hangi skill'in
  yıkıcı/geri alınamaz olduğunu söyleyen bir alan yok (`a2a.proto`
  genelinde `destructive`/`readonly`/`idempotent` alanı yok). Bir ajanın
  "dosya sil" skill'i ile "dosya listele" skill'i sözleşme düzeyinde
  ayırt edilemiyor.
- **Bant dışı (out-of-band) kimlik bilgisi edinimi protokolün dışında.**
  §7.3 adım 2 ve §7.6 "Agents MUST arrange to receive credentials via an
  out-of-band means" — protokolün en kritik güvenlik adımı kapsam dışı
  bırakılmış. İki uyumlu uygulama burada tamamen farklı davranabilir.
- **ADR sayısı iki.** `adrs/` altında yalnızca `adr-001-protojson-serialization.md`
  ve şablon var; 1.0'a giden büyük kararların gerekçesi izlenebilir
  değil. Belge kalitesi yüksek, karar arkeolojisi zayıf.

## Puan (1–5)
olgunluk **5** — 1.0.1 yayımlanmış, sürümleme ve deprecation politikası yazılı (`specification.md:109-115`) ·
mimari netlik **5** — normatif kaynak tek ve açık, RFC 2119 tutarlı kullanılmış ·
genişletilebilirlik **4** — uzantı mekanizması ve sürüm kuralları net; ama uzantı kayıt/yönetişimi henüz ince ·
güvenilirlik **3** — retry/timeout/idempotency yazılı, ama checkpoint/rollback yok ve mesaj teslimi açıkça güvenilmez ilan edilmiş ·
ilkeller **4** — Task/Message/Part/Artifact/AgentCard iyi ayrılmış ilkel küme ·
gözlemlenebilirlik **2** — §13'te log kuralı var (`:3205` sırlar loglanmaz), ama trace/span sözleşmesi yok ·
güvenlik duruşu **4** — kimlik doğrulama, imza, SSRF, bilgi sızdırmama somut; **ama** zorlayıcı yetki katmanı yok ve imza MAY

## ADR-000 K6 için kanıt (görevin açıkça istediği)

**K6'yı güçlendiren kanıt (baskın):**

1. **İki büyük protokol de zorlamayı uygulamaya devrediyor.** MCP'de
   güvenlik politikasını uygulayan taraf host (`mcp-spec.md` §Mimari);
   A2A'da yetkilendirme sınırları "protokol tarafından reçete edilmiyor"
   (`specification.md:3105`). İki bağımsız spesifikasyonun aynı boşluğu
   bırakması, K6'nın "her araç çağrısı Permission Manager'dan geçer"
   maddesinin bir tercih değil **zorunluluk** olduğunu gösteriyor: bu
   katmanı biz yazmazsak kimse yazmıyor.
2. **İnsan onayı kapısı protokolde birinci sınıf bir durum olarak
   modellenebiliyor** (`a2a.proto:206-207`) ve `specification.md:1908-1913`
   örneği birebir bizim vakamız: "An agent requiring human approval before
   a destructive action is taken". K6'nın "geri alınamaz işlemler her zaman
   insan kapısından geçer" maddesi, protokol tasarımcılarının da bağımsız
   olarak vardığı bir sonuç.
3. **"Ajanlar birbirinin izinlerini devralmaz" maddesi doğrulanıyor.**
   A2A'nın kurucu ilkesi *opaque execution* (`specification.md:39`) ve
   §7.6.3'ün in-band kimlik bilgisi uyarısı — kimlik bilgileri bir ajan
   zincirinden geçerse "zincirdeki her ajana açılır", bu yüzden kimlik
   bilgisi **isteği başlatan ajana bağlanmalı** ki yalnızca o
   kullanabilsin (`specification.md:1961-1962`). Bu, K6'nın izin
   devralmama maddesinin protokol düzeyindeki karşılığı.
4. **Yetki kontrolünün konumu bile belirtilmiş**: sorgudan **önce**
   (`specification.md:3106`). Bizim Permission Manager'ın araç çağrısını
   *sarmalaması* değil, *önüne geçmesi* gerektiğini destekliyor.

**K6'yı çürüten kanıt:** bulunamadı. Aranan şey şuydu: yaygın kullanılan
bir spesifikasyonun "her çağrıyı bir izin katmanından geçirmek gereksiz
yüktür" veya "ajanlar arası izin devralma güvenlidir" demesi. A2A'nın
söylediği tam tersi. Bulunan tek gerilim K6'nın *maliyetiyle* ilgili:
A2A'nın kendisi de zorlayıcı bir katman koymamayı seçmiş, ama gerekçesi
"gereksiz" değil, "**bu protokolün kapsamı değil**" (`:3105`) — kapsam
kararı, ilke reddi değil.

**Sonuç: K6 yeniden açılmıyor; güçleniyor.** Ek olarak K6'ya eksik olan
bir madde önerisi doğuyor — aşağıda "Alınacak fikir" ilk maddesi.

## Alınacak fikir
- **`AUTH_REQUIRED`'ı görev durum makinesine birinci sınıf durum olarak
  koymak** (`a2a.proto:206-207`, `specification.md:1921-1933`) — bizim Task
  Manager'ında "beklemede" ile "insan onayı bekliyor" ayrı durumlar olmalı;
  ikincisi *kesintili* durum olarak işaretlenmeli ki gözlem katmanı
  "sistem takıldı" ile "insan bekleniyor"u ayırabilsin. K6'nın onay
  kapısına somut bir durum modeli.
- **Onay isteğinin zincir boyunca yukarı delege edilebilmesi**
  (`specification.md:1945-1947`) — alt-ajan onay isterse üst-ajan kendi
  görevini de onay bekler duruma geçirip isteği insana kadar taşır.
  Bizde alt-ajan doğrudan kullanıcıya ulaşamaz; bu desen tam bu boşluğu
  dolduruyor.
- **Onay sinyali ≠ yetki** ayrımı (`specification.md:1968-1972`) — onay
  kapısından dönen kararın **kapsamı** (hangi işlem, ne kadar süre,
  sonraki mesajlara geçerli mi) ayrıca ve açıkça tanımlanmalı. Bizim
  `permission.schema.json` (Faz 3) bu üç alanı taşımalı, yoksa "bir kez
  onayladım" sessizce "hep onaylıyorum"a dönüşür.
- **Kritik bilginin akış mesajına değil kalıcı artefakta yazılması**
  (`specification.md:762-764`) — iz/karar kanıtı stream olayında durmaz;
  bizim trace kaydında da onay gerekçesi kalıcı kayda yazılmalı.
- **Ajan kimliği için JWS + RFC 8785 kanonikleştirme reçetesi**
  (`specification.md:2016-2145`) — ajan sözleşmelerimizi (`contracts/agent.schema.json`)
  imzalayıp doğrulamak istediğimizde hazır, standartlara oturan bir yol;
  özellikle "varsayılan değerli alanları çıkar, `signatures` alanını hariç
  tut, sonra kanonikleştir" adımı kendi başımıza doğru bulmamız zor bir
  ayrıntı.
- **Sessiz sürüm düşürme yasağı** (`specification.md:1141`, "MUST NOT fall
  back to a previous version automatically") — bizim ajan sözleşmesi
  sürümlemesinde aynı kural: eski sürüme sessizce düşmek, güvenlik
  varsayımlarını sessizce düşürmektir.
- **SSRF savunmasının somut listesi** (`specification.md:3122-3125`) — ağ
  izni verilen her araç için özel IP aralığı reddi; K6'nın "ağ erişimi
  kapsamlıdır (hangi alan adı)" maddesinin uygulama detayı.

## Alınmayacak
- **Agent Card imzasını `MAY` bırakmak** (`specification.md:2014`, `:2140`) —
  A2A'nın kurumsal birlikte çalışabilirlik zorunluluğu var, bizim yok.
  Bizde ajan sözleşmesi kaydı **tek** yerden yapılıyor; imza/bütünlük
  kontrolü opsiyonel olmamalı. Opsiyonel kimlik doğrulama, pratikte
  doğrulanmayan kimliktir.
- **Yetkilendirme modelini tamamen "uygulamaya bırakmak"**
  (`specification.md:3105`) — A2A için doğru bir kapsam kararı, bizim için
  hedefin kendisi. Biz *uygulamayız*; K6 bizden reçeteyi yazmamızı
  istiyor.
- **Bant dışı kimlik bilgisi ediniminin tanımsız bırakılması** (§7.3, §7.6) —
  bizde kimlik bilgisi akışı tanımsız kalamaz; sabit sınır gereği ajan
  şifre/kimlik bilgisi *girmez*, kimlik bilgisi ajana **hiç
  ulaştırılmaz** (araç kendi tarafında saklar). A2A'nın "ajan kimlik
  bilgisini alır" varsayımı bizim modelimize uymuyor.
- **Task durum makinesini olduğu gibi almak** — geri alma/checkpoint yok
  (`a2a.proto:189-207`); İ4'ün konusu olan rollback için bu model yetersiz.
  Durum adlarını ödünç alalım, makinenin tamamını değil.
- **Push notification/webhook modelini şu aşamada kurmak** — tek makinede
  çalışan bir sistemde webhook, SSRF ve kimlik doğrulama yükünü karşılığı
  olmadan getirir. Uzaktan ajan devreye girerse yeniden değerlendirilir.
