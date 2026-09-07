# mcp-vet (kullanıcının kendi aracı)

## Kimlik
Furkiozknn/mcp-vet · **0 yıldız · 0 watcher** · son push 2026-09-06 · MIT · Python (yalnızca standart kütüphane) · haftalık indirme: yok (PyPI'de yayımlanmamış)
Oluşturulma: 2026-08-30 — **depo 8 günlük.** Sürüm `pyproject.toml:3` `version = "0.5.0"`.
Klon HEAD: `6b03fe3` (2026-09-06). Depo `D:\Repolar\mcp-vet` (kullanıcının kendi çalışma kopyası).
canlılık: **kısmen geçti** — arşivlenmemiş, OSI lisanslı (MIT), son push 1 gün önce; ama protokol §1'in "yıldız kanıt değildir" maddesinin diğer yüzü de geçerli: **tek geliştirici, sıfır dış kullanıcı, 8 günlük geçmiş.** Bağımsız kullanımla sınanmamış. Aşağıdaki her puan bu gerçeğe göre tavanlanmıştır.

**Kayırma beyanı (protokol §5).** Bu kullanıcının kendi deposu. Aynı rubrik
uygulandı: canlılık "kısmen", olgunluk 2 ile sınırlandı, "Alınmayacak"
bölümü diğer projelerdekiyle aynı sertlikte yazıldı. Aracın tasarım
kalitesi yüksek çıktı — bu, kayırma değil, doğrulanmış bir gözlem
(aşağıdaki "Doğrulama" bölümüne bakınız); ama **olgunluk ile tasarım
kalitesi ayrı puanlar** ve ikincisi birincisini kurtarmıyor.

İnceleme kapsamı: `mcp_vet/` altındaki 19 modülün tamamının başlık
docstring'leri + `models.py`, `risk.py`, `trust.py`, `injection.py`,
`network.py`, `diff.py`, `audit.py` gövdeleri; `pyproject.toml`;
`tests/` (14 test dosyası); CLI'nin canlı çalıştırılması. Kapsam dışı:
`patterns.py`'ın 560 satırlık regex kataloğunun tek tek doğruluğu,
`http.py` önbellek mekaniği, `registry.py` MCP Registry entegrasyonunun
canlı davranışı, `SKILL.md`.

## Çözdüğü problem
Bir MCP sunucusunu makinene kurmadan önce "bu ne yapabilir ve kime veri
gönderir" sorusunu cevaplar. Hedef kitle: MCP sunucusu kuran herkes.
Çözdüğü acı doğrudan bizim ADR-000 K6'mızın kör noktası: MCP
spesifikasyonu araç tanımının **doğruluğunu garanti etmiyor**
(`mcp-spec.md` §Zayıf yönler — `ToolAnnotations` yalnızca "hint",
bağlayıcı değil), yani bir sunucunun "salt okuma" demesi onu salt okuma
yapmıyor. mcp-vet bu boşluğa **kurulum öncesi statik denetim** koyuyor:
sunucunun beyanına değil, koduna bakıyor.

Kategori olarak bu bir **güven denetimi (supply-chain vetting)** aracı,
bir çalışma zamanı guardrail'i değil. LlamaFirewall çalışırken bakar,
mcp-vet kurmadan önce bakar. İkisi rakip değil, farklı zamanlarda
devreye giren iki kapı.

## Mimari
Tek yönlü boru hattı; tüm analizler tek bir veri modelinde toplanıp üç
görünüme (metin, JSON, çıkış kodu) yansıtılıyor.

```
hedef (owner/repo | --path dizin)
  │
  ├─ github.py   → RepoMeta / RepoExtras        (ağ; --offline ile atlanır)
  ├─ registry.py → MCP Registry provenance
  ├─ scanning.py → ScanResult (dosya ağacı)
  │      ├─ source.py      → capability eşleşmeleri + dataflow + credentials
  │      ├─ injection.py   → tool poisoning / prompt injection
  │      ├─ network.py     → endpoint çıkarımı + sınıflandırma
  │      ├─ dependencies.py→ bağımlılık analizi
  │      └─ install.py     → kurulum kancaları (postinstall vb.)
  │
  └──→ models.AuditReport  (TEK gerçek kaynağı)
             │
             ├─ report.py → metin / --json
             └─ risk.py   → overall = alanların EN KÖTÜSÜ + çıkış kodu
```

Tasarımın omurgası `models.py:1-20`'de yazılı iki kural:
1. **"Severity is not confidence."** — bir regex eşleşmesi yüksek
   şiddetli *ve* düşük güvenilirlikli olabilir; ikisini tek sayıya
   çevirmek tarayıcıyı ya kurt masalı anlatan ya da susan bir şeye
   dönüştürür. İki eksen çıktıya kadar ayrı taşınıyor.
2. **"A finding without evidence is an opinion."** — her `Finding`
   dosya, satır ve tetikleyen kod parçasını taşır (`models.py:120-125`,
   `Evidence` sınıfı: "Without this a finding is unfalsifiable").
   Okuyucu araçla, aynı şeye bakarak aynı fikirde olmayabilir.

## Klasör yapısı
```
mcp_vet/
  models.py       (329) ← Severity/Confidence/Area/Finding/Evidence/AuditReport
  risk.py         (171) ← bulgular → karar; tek skor YOK; çıkış kodları
  patterns.py     (560) ← capability regex kataloğu (shell.execute, environment.read…)
  source.py       (394) ← kaynak taraması, dataflow, beklenen kimlik bilgileri
  injection.py    (323) ← tool poisoning: "bu cümle kime yazılmış"
  network.py      (225) ← endpoint çıkarımı, EXPECTED/UNEXPLAINED sınıflandırması
  diff.py         (313) ← iki sürüm arası YETENEK ARTIŞI
  registry.py     (419) ← MCP Registry provenance
  trust.py / popularity.py / dependencies.py / install.py / github.py / http.py
  audit.py        (275) ← akışı yürüten koordinatör
  cli.py          (321) ← search / registry / check / audit / diff / report
tests/            ← 14 dosya, 237 test; fixtures/ altında clean, exfil,
                    poisoned, obfuscated dört sahte sunucu
docs/json-schema.md ← JSON çıktısının sözleşmesi (SCHEMA_VERSION = "1.0")
```

## Ajan tasarımı
Ajan yok — bu bir CLI denetim aracı, ajan çatısı değil. Ama bizim için
ilgili olan bir "sözleşme" var: `AuditReport` (`models.py:272-280`,
"The only thing renderers read") ve `SCHEMA_VERSION = "1.0"`
(`models.py:30`, "Bumped when the JSON output's shape changes in a way a
consumer could notice"). Yani araç **kendi çıktısını sürümlenmiş bir
sözleşme olarak** ele alıyor. Denetim alanları (`Area`,
`models.py:100-117`) on tane ve sabit: popularity_integrity,
repository_trust, source_code, dependencies, installation, capabilities,
network, prompt_injection, maintenance, provenance.

## Orkestrasyon / iş akışı modeli
Doğrusal boru hattı, dinamik plan yok, paralellik yok. `audit.py:124`
`audit_directory` (yerel dizin) ve `audit.py:152` `audit_repository`
(GitHub) iki giriş noktası; ikisi de `analyze_tree` (`audit.py:47`)
üzerinden aynı statik analiz kümesini çalıştırıyor. Bu iz için doğru
karar: denetim aracının kendisi karmaşık olursa denetlenebilirliğini
kaybeder.

## Durum ve bellek
Durum yok (her çalıştırma bağımsız). Tek kalıcılık HTTP yanıt önbelleği
(`http.py`, `--no-cache` ile atlanır). `diff.py` iki *sürüm* karşılaştırır
ama sürümler arası durum tutmaz; her ikisini de o an analiz eder.

## Hata yönetimi
En dikkat çekici tasarım kararı burada, `risk.py:1-14`:

- **Tek skor yok.** "A server can be impeccably maintained, widely
  starred, and still read your environment and post it somewhere.
  Averaging those into one figure destroys exactly the information a
  reader needs" — genel karar alanların **ortalaması değil, en
  kötüsü**.
- **Güvenilirlik karar aşamasında uygulanıyor, tespit aşamasında
  değil** (`risk.py:9-13`): bulgu her zaman gerçek şiddetiyle
  *raporlanır* (güvenlik bağlamında HIGH'ı bastırmak yanlış takas),
  ama düşük güvenilirlikli bulgu genel karara **bir kademe aşağıdan**
  katkı verir. Böylece tek bir spekülatif regex eşleşmesi kendi başına
  CRITICAL başlık üretemiyor.
- **Kararsızlık ayrı bir değer.** `Severity.NOT_FLAGGED`
  (`models.py:34-40`) bilerek `SAFE` diye adlandırılmamış: "mcp-vet
  never concludes that something is safe, only that a given check did
  not fire." Aynı ayrım `Status` ile alan bazında da var — canlı
  çıktıda `--offline` modunda altı alan "(not checked)" olarak
  görünüyor, sessizce "temiz" sayılmıyor.
- **Çıkış kodları sözleşme** (`risk.py:31-35`): 0 temiz, 1 LOW/MEDIUM,
  2 HIGH, 3 CRITICAL, 4 aracın kendisi çalışamadı. "stable: CI gates
  depend on these" — 4'ün ayrı olması önemli: *araç patladı* ile *temiz
  çıktı* karışmıyor.

## Genişletilebilirlik
Yeni bir yetenek imzası eklemek: `patterns.py`'a bir kayıt (tek dosya).
Yeni bir denetim alanı eklemek: `Area` enum'una üye + bir analiz modülü
+ `audit.py`'da iki satır bağlama. Eklenti/kayıt mekanizması **yok** —
LlamaFirewall'ın dekoratörle tarayıcı kaydına (`register_llamafirewall_scanner`)
karşılık burada elle bağlama var. Araç bu boyutta buna gerek duymuyor,
ama üçüncü taraf kontrol eklemek isteyen biri çekirdeğe dokunmak
zorunda.

Sıfır çalışma zamanı bağımlılığı (`pyproject.toml:10` `dependencies = []`)
ve gerekçesi kodda yazılı (`pyproject.toml:7-9`): "An auditing tool that
pulls in a dependency tree to run is asking you to trust more code in
order to check less of it." Bu, denetim aracı için doğru ve nadir bir
duruş.

## Doğrulama (bu analiz için fiilen çalıştırıldı)
Protokol "yaptığını doğrula" diyor; iddiaları koddan okumakla
yetinmeyip araç çalıştırıldı:

1. `uv run --with pytest pytest -q` → **237 passed in 1.83s**. (Not:
   makinede `python` PATH'te yok, `uv run` gerekli — BILINEN-TUZAKLAR #6.)
2. `python -m mcp_vet.cli audit --offline --path tests/fixtures/exfil_server`
   → `OVERALL RISK HIGH`, çıkış kodu **2** (`risk.py:33` `EXIT_HIGH = 2`
   ile tutarlı). Çıktı dört yetenek gösterdi (`environment.read`
   server.py:13, `network.external` :16, `process.spawn` :23,
   `shell.execute` :23), iki beklenen kimlik bilgisi (`GITHUB_TOKEN`
   zorunlu, `OPENAI_API_KEY` opsiyonel) ve her biri için **düz dille
   patlama yarıçapı** (`models.py:213` `blast_radius: str  # plain-language
   consequence if compromised`), ve bir `UNEXPLAINED` ağ hedefi.
   Denetlenmeyen altı alan `(not checked)` olarak işaretlendi — iddia
   edilen "sessizce temiz sayma" davranışı doğrulandı.

## Güçlü yönler (kanıtlı)
- **Tek skor reddi ve gerekçesi** (`risk.py:3-7`) — güvenlik
  değerlendirmesinde en yaygın hatayı yapısal olarak engelliyor.
- **Şiddet ve güvenilirliğin ayrı eksenler olması** (`models.py:9-16`,
  `risk.py:9-13`) — ve güvenilirliğin *tespit*i değil *kararı* etkilemesi.
- **"Bilmiyorum" ilk sınıf bir değer** — `NOT_FLAGGED ≠ SAFE`
  (`models.py:34-40`), `UNEXPLAINED` en yaygın ağ verdikti
  (`network.py:10-14`, "Unknown is not the same as malicious, and this
  module refuses to conflate them").
- **Injection tespitinin doğru soruyu sorması** (`injection.py:8-12`):
  "does this text contain scary words" değil, "**who is this sentence
  addressed to**" — açıklama, aracın ne döndürdüğünü söylüyorsa
  sözleşmedir; modele neye inanacağını, neyi gizleyeceğini, hangi
  aracı çağıracağını söylüyorsa talimattır ve orada işi yoktur.
  Ve kendi sınırını biliyor: "That distinction cannot be made reliably
  by pattern matching, so nothing here concludes maliciousness."
- **Yetenek artışı denetimi (`diff.py:3-8`)** — "The most dangerous MCP
  update is not the one that arrives malicious. It is the one that was
  fine at v1.2.0, got read and approved, and quietly grew shell
  execution at v1.3.0. Nobody re-reads a patch bump." Onaylanmış bir
  bileşenin **onay sonrası yetki genişletmesi**, bizim K6 modelimizin
  en zayıf noktası ve bu araç tam ona bakıyor.
- **Kendi kısıtını rapora yazması** (`diff.py:15-21`): git ref
  karşılaştırmasında yalnızca değişen dosyalar çekiliyor, bu yüzden
  yarısı değişmemiş dosyada duran bir kombinasyon kaçabilir —
  "Stated as a limitation rather than glossed over."
- **Sıfır çalışma zamanı bağımlılığı, gerekçesi yazılı**
  (`pyproject.toml:7-10`).
- **237 test + dört adet kasıtlı kötücül fixture** (`tests/fixtures/`:
  clean, exfil, poisoned, obfuscated) — tarayıcının yalanı yakalayıp
  yakalamadığı test edilebilir hâlde.

## Zayıf yönler (kanıtlı)
- **Sıfır dış kullanım.** 0 yıldız, 0 watcher, 8 günlük depo, PyPI'de
  yok. Regex kataloğunun (`patterns.py`, 560 satır) yanlış pozitif/negatif
  oranı hiç ölçülmemiş; tek kanıt kendi fixture'ları. Bir güvenlik
  aracının değeri, gerçek kötücül örneklerle karşılaşma sayısıyla
  artar — bu sayı burada sıfır.
- **Statik analizin kaçınılmaz tavanı.** Obfuscation, dinamik import,
  çalışma zamanında indirilen kod, derlenmiş uzantı — hiçbiri
  yakalanamaz. Araç bunu `injection.py:15-18`'de kabul ediyor ama
  **kullanıcı temiz bir rapor gördüğünde bu tavanı hatırlamayabilir**;
  "temiz" raporu yanlış güven üretme riski taşıyor.
- **Eklenti mekanizması yok** — yeni kontrol eklemek çekirdeğe dokunmak
  demek (`audit.py:47-79`). Karşılaştırma: LlamaFirewall'da dekoratörle
  dışarıdan kayıt var.
- **Yalnızca Python/JS ağırlıklı kaynak analizi varsayımı** —
  `patterns.py` imzaları dile bağlı; Go veya Rust yazılmış bir MCP
  sunucusunda yetenek tespiti sessizce zayıflar. Bu sınır rapora
  yazılmıyor (`--offline` çıktısında dil kapsamı belirtilmiyor).
- **`--offline` modunun altı alanı denetlenmemiş bırakması** doğru
  davranış, ama genel karar yine de "HIGH" gibi kesin bir kelimeyle
  sunuluyor; okuyucu için "HIGH (kısmi denetim)" daha dürüst olurdu.
- **Tek geliştirici, tek bakış açısı.** Aracın kendi `trust.py`'ı
  `SINGLE_MAINTAINER_THRESHOLD = 2` ile tek-bakımcılı projeleri
  işaretliyor (`trust.py:27`); kendi kendine uygulandığında bu bayrak
  kalkardı.

## Puan (1–5)
olgunluk **2** — çalışıyor ve test edilmiş, ama 8 günlük, sıfır dış kullanıcı, yayımlanmamış (rubrik: "Kısmen var, kavram düzeyinde"nin üstü, "belgelenmemiş veya kırılgan"ın altı; kırılgan olan kod değil, kanıt tabanı) ·
mimari netlik **5** — tek veri modeli, üç görünüm, her modülün başında kararının gerekçesi yazılı; bu izde okunan en açık kod ·
genişletilebilirlik **3** — yeni imza kolay, yeni alan orta, üçüncü taraf kontrol için mekanizma yok ·
güvenilirlik **3** — 237 test geçiyor ve doğrulandı; ama gerçek dünya yanlış-pozitif oranı bilinmiyor ·
ilkeller **5** — Severity/Confidence/Area/Evidence/Finding ayrımı bu izde görülen en temiz güvenlik ilkel kümesi ·
gözlemlenebilirlik **3** — JSON çıktısı sürümlenmiş sözleşme (`docs/json-schema.md`), çıkış kodları kararlı; ama trace/olay akışı yok ·
güvenlik duruşu **4** — sıfır bağımlılık, kendi sınırlarını yazan tasarım, "safe" demeyi reddetmesi; tavan yalnızca kanıt tabanının yokluğu

## ADR-000 K6 için kanıt
**Güçlendiriyor, ve K6'da eksik olan bir boyutu gösteriyor.**

K6 izin *verme* anını düzenliyor: hangi araç, hangi kapsam, kim onaylar.
`diff.py:3-8` şunu gösteriyor: asıl risk izin verme anında değil, **izin
verildikten sonra bileşenin değişmesinde**. Bir MCP sunucusuna v1.2.0'da
"ağ erişimi yok" diye izin verirsin; v1.3.0 shell çalıştırmayı ekler ve
kimse patch bump'ı yeniden okumaz. K6 bu duruma bugün cevap vermiyor.

Bu, K6'yı çürütmüyor — **eksik bir maddesini ortaya çıkarıyor**: izin
kararı bir sürüme/içerik özetine bağlanmalı ve bileşen değiştiğinde izin
**düşmeli** (yeniden onay gerektirmeli). Bu bulgu, `mcp-scan.md`'deki
bağımsız bulguyla örtüşüyor (bkz. OZET §2).

K6'yı çürüten kanıt: yok.

## Alınacak fikir
- **Şiddet ≠ güvenilirlik, iki ayrı eksen** (`models.py:9-16`) — bizim
  Permission Manager'ının reddetme gerekçesi de iki eksenli olmalı: "bu
  işlem ne kadar tehlikeli" ile "tehlikeli olduğundan ne kadar eminim"
  ayrı alanlar. Düşük güvenilirlikli tespit *kaydedilir* ama tek başına
  otomatik reddetmez — insan kapısına düşer.
- **Genel karar = en kötü alan, ortalama değil** (`risk.py:3-7`) — bir
  ajan çağrısının güvenlik değerlendirmesi asla ortalamayla
  yumuşatılmamalı. Bizim `permission.schema.json` tek bir "risk skoru"
  alanı **içermemeli**.
- **`NOT_FLAGGED ≠ SAFE`** (`models.py:34-40`) ve alan bazında
  "(not checked)" (canlı çıktıda doğrulandı) — bizim izin kararı
  sözleşmesinde de "kontrol edilmedi" ile "kontrol edildi, temiz"
  ayrı değerler olmalı. Denetlenmemiş boyutu sessizce onaylanmış
  saymak, K6'nın varsayılan-salt-okuma ilkesini içeriden delen en
  sinsi yol.
- **Yetenek artışı (capability drift) denetimi** (`diff.py:3-8`) — K6'ya
  eklenecek madde: verilen izin, bileşenin belirli bir sürümüne
  bağlanır; sürüm değişince izin otomatik düşer. Bizim Tool Registry'de
  her aracın onaylanmış sürümü/özeti saklanmalı.
- **Kanıtsız bulgu = kanaat** (`models.py:120-125`) — reddedilen veya
  onaya düşen her izin kararı, tetikleyen dosya/satır/kod parçasını
  taşımalı. "Politika reddetti" tek başına denetlenebilir değil.
- **Çalıştırılabilirlik hatasının ayrı çıkış kodu** (`risk.py:35`
  `EXIT_ERROR = 4`) — bizim otomatik çalıştırmalarımızda "kontrol temiz"
  ile "kontrol çalışmadı" hiçbir zaman aynı sinyali vermemeli.
- **Denetim aracının sıfır çalışma zamanı bağımlılığı**
  (`pyproject.toml:7-10`) — güvenlik katmanımızın bağımlılık yüzeyi,
  denetlediği şeyden küçük olmalı.
- **Kasıtlı kötücül fixture kümesi** (`tests/fixtures/`: exfil,
  poisoned, obfuscated, clean) — bizim Permission Manager'ı için de
  "geçmemesi gereken" örnek çağrı kümesi yazılmalı; guardrail'in
  testi, iyi girdilerle değil kötü girdilerle yapılır.

## Alınmayacak
- **Aracı çalışma zamanı bağımlılığı olarak sisteme gömmek** — mcp-vet
  bir *kurulum öncesi* denetim aracı; ADR-000 K6'nın istediği "her araç
  çağrısı Permission Manager'dan geçer" gereksinimini karşılamaz.
  Statik analiz çalışma zamanı zorlamasının yerine geçemez (aynı
  gerekçe LlamaFirewall için ters yönde geçerliydi). MCP yapım aşaması
  ilkesine de uygun: yapımda/kurulumda yardımcı, çalışma zamanında
  bağımlılık değil.
- **Regex imza kataloğunu (`patterns.py`, 560 satır) olduğu gibi
  devralmak** — yanlış pozitif/negatif oranı hiç ölçülmemiş; kendi
  fixture'ları dışında kanıtı yok. Fikri (yetenek sınıfı → imza) alalım,
  kataloğu ölçmeden karar noktasına bağlamayalım (LlamaFirewall'ın
  `[EXPERIMENTAL]` tarayıcıları için verdiğimiz kararın aynısı).
- **Statik analiz sonucunu "onaylandı" saymak** — obfuscation, dinamik
  import ve derlenmiş uzantı kapsam dışı. Bizde temiz denetim raporu
  izni *genişletmemeli*, yalnızca insan kapısındaki kararı
  *bilgilendirmeli*.
- **Tek geliştirici + sıfır dış kullanım profilindeki bir aracı
  güvenlik zincirinin tek halkası yapmak** — kendi `trust.py:27`
  ölçütüne (`SINGLE_MAINTAINER_THRESHOLD = 2`) takılırdı. İkinci,
  bağımsız bir denetim kaynağıyla (bkz. `mcp-scan.md`) birlikte
  kullanılmalı.
