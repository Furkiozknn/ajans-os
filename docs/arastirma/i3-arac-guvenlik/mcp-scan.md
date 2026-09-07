# mcp-scan / Snyk Agent Scan

*Tohum listesinde olmayan aday (protokol §2 gereği).*

## Kimlik
invariantlabs-ai/mcp-scan · 3.014 yıldız · 13 watcher · son push 2026-09-07 · Apache-2.0 · Python · arşivlenmemiş
Klon HEAD: `dada638` (2026-09-07). Paket adı artık **`snyk-agent-scan`**, sürüm 0.6.2 (`pyproject.toml:2-4`: `name = "snyk-agent-scan"`, `version = "0.6.2"`, `description = "Agent supply chain security scanner."`).
canlılık: geçti — ama **sahiplik değişmiş**: depo adı `mcp-scan`, ürün adı "Snyk Agent Scan" (`README.md:3`). Bu, aşağıdaki bağımlılık analizinin merkezinde.
İnceleme kapsamı: `pyproject.toml`, `src/agent_scan/` ağacı, `guard.py`, `consent.py`, `verify_api.py`, `redact.py`, `hooks/`, `agents/`. Kapsam dışı: `direct_scanner.py` ve `pipelines.py` gövdeleri, `tests/`, `demoserver/`, tespit kurallarının içeriği (zaten sunucu tarafında).

## Çözdüğü problem
Makinedeki **ajan bileşenlerini keşfedip** (MCP sunucuları, ajanlar,
skill'ler) prompt injection ve tedarik zinciri açıkları için tarar.
mcp-vet'ten farkı kapsamda: mcp-vet *bir* sunucuyu kurmadan önce
denetler; agent-scan *zaten kurulmuş olanların hepsini* bulur.
`src/agent_scan/agents/` altında Claude Code, Claude Desktop, Codex,
Cursor, Windsurf, Kiro, Antigravity, opencode, VS Code için ayrı
keşfediciler var — yani "hangi ajan istemcisi hangi MCP sunucusunu
yapılandırmış" sorusunu makine üzerinde otomatik cevaplıyor.

## Mimari
```
agents/*        → keşif: her istemcinin config dosyasını bul ve ayrıştır
   ↓
consent.py      → stdio sunucusu BAŞLATILMADAN ÖNCE kullanıcıya sor
   ↓
mcp_client.py   → sunucuyu başlat, tools/list ile araç tanımlarını çek
   ↓
redact.py       → gönderilmeden önce sırları temizle (detect-secrets)
   ↓
verify_api.py   → **Snyk buluta gönder**, karar oradan gelsin
   ↓
printer.py / guard.py → rapor + çalışma zamanı hook kurulumu
```

## Ajan tasarımı
Ajan üretmiyor, ajanları **keşfediyor**. `agents/base.py` bir
`DiscoveryScope` soyutlaması tanımlıyor; her istemci (`claude_code.py`,
`codex.py`, `vscode/cursor.py` …) kendi config biçimini bilen bir alt
sınıf. Yeni bir ajan istemcisi desteklemek tek dosya eklemek demek —
bu izde görülen en temiz genişletme noktalarından biri.

## Orkestrasyon / iş akışı modeli
Boru hattı (`pipelines.py`), dinamik plan yok. İki mod: tek seferlik
tarama ve **kalıcı koruma** (`guard.py`). İkincisi bizim için asıl ilginç
olan.

## Durum ve bellek
Durum makinede değil, **bulutta**. `verify_api.py:523` API token
istiyor ("go to https://app.snyk.io/account"), `verify_api.py:552`
ise günlük kullanım sınırından bahsediyor: "Daily usage limit reached
for the public version of Agent-Scan." Yani tespit mantığı ve karar
istemcide değil; istemci topluyor, sunucu karar veriyor.

## Hata yönetimi
Üç savunma katmanı kayda değer:

1. **Başlatma öncesi rıza** (`consent.py:1-3`) — bir stdio MCP
   sunucusunu *çalıştırmadan* önce kullanıcıya komutu gösterip
   onay alıyor. Sebep açık: `tools/list` çağırmak için sunucuyu
   başlatmak gerekir, ve sunucuyu başlatmak zaten kod çalıştırmaktır.
   Denetim aracının kendisi bir saldırı vektörü olabilir; bu, o riski
   kabul edip insana devrediyor.
2. **Ekrana ve buluta giden her şeyde redaksiyon** (`consent.py:31-35`:
   `_render_env_redacted` → "Values are never echoed back to the
   terminal", ortam değişkenleri `KEY=***` olarak gösteriliyor;
   `redact.py:1-9`: ortam değişkenleri, komut satırı argüman
   değerleri (detect-secrets ile), HTTP başlıkları, URL sorgu
   parametreleri ve traceback'lerdeki dosya yolları temizleniyor).
3. **Çalışma zamanı hook'ları** (`guard.py:1`, "Agent Guard hook
   management for Claude Code, Cursor, and Codex") — `hooks/` altında
   `snyk-agent-guard.sh` ve `snyk-agent-guard.ps1` betikleri var;
   araç bunları hedef istemcinin hook yapılandırmasına kuruyor. Yani
   tarama tek seferlik bir fotoğraf olmaktan çıkıp **her araç
   çağrısında çalışan bir kapıya** dönüşüyor.

## Genişletilebilirlik
Yeni ajan istemcisi: `agents/` altına bir dosya. Yeni tespit kuralı:
**mümkün değil** — kurallar bulutta. Bu, aracın en keskin ödünleşimi.

## Güçlü yönler (kanıtlı)
- **Denetim aracının kendi riskini kabul etmesi** (`consent.py:1-3`) —
  "sunucuyu incelemek için sunucuyu çalıştırmam gerekiyor, izin ister
  misin". mcp-vet bu riski hiç almıyor (saf statik), agent-scan alıyor
  ama insan kapısına koyuyor. İki farklı doğru cevap.
- **Sırların hiçbir yolda dışarı çıkmaması** (`redact.py:1-9`,
  `consent.py:33`) — hem terminale hem buluta giden yol ayrı ayrı
  temizleniyor.
- **Hook ile çalışma zamanı zorlaması** (`guard.py`, `hooks/*.sh|ps1`) —
  K6'nın "her araç çağrısı Permission Manager'dan geçer" maddesinin
  mevcut ajan istemcilerinde **fiilen uygulanabilir** tek yolu bu:
  istemcinin hook mekanizmasına girip çağrıyı kesmek.
- **İstemci keşfinin genişliği** (`agents/` altında 9+ istemci) —
  "makinede ne kurulu" sorusunun cevabı elle tutulamayacak kadar
  dağınık; bunu otomatikleştirmek gerçek bir katkı.

## Zayıf yönler (kanıtlı)
- **Kararın bulutta olması** (`verify_api.py:523`, `:552`) — API token
  zorunlu, günlük kuota var, çevrimdışı çalışmıyor. Bir güvenlik
  aracının kararı ağ bağlantısına ve bir ticari hesaba bağlı.
- **Analiz edilen içerik dışarı gönderiliyor.** Redaksiyon var ama
  redaksiyon *en iyi çaba*; MCP araç açıklamaları ve config'ler üçüncü
  bir tarafa gidiyor. Bu, kullanıcının kendi makinesindeki özel
  depolar için doğrudan bir gizlilik takası.
- **Çıktı sözleşmesi açıkça kararsız** (`README.md:15-23`): "The raw
  output of this CLI — including risk indicator names, scores, field
  names, and response structure — is experimental and may change."
  CI kapısı kurmak için güvenilemez. Karşılaştırma: mcp-vet'in
  `SCHEMA_VERSION` + kararlı çıkış kodu sözleşmesi.
- **13 ağır çalışma zamanı bağımlılığı** (`pyproject.toml:12-26`:
  rich, pydantic, aiohttp, lark, psutil, mcp[cli], detect-secrets…) —
  denetlediğinden daha büyük bir güven yüzeyi. mcp-vet'in
  `dependencies = []` duruşunun tam tersi; ikisi aynı problemi
  çözerken zıt kararlar vermiş.
- **Sahiplik değişimi ve sürüm kırılması** — `mcp-scan` adıyla bilinen
  araç artık `snyk-agent-scan`; README v0.5.x'in "planned for
  deprecation" olduğunu yazıyor (`README.md:17`). Bağımlılık olarak
  almak, ticari bir ürünün yol haritasına bağlanmak demek.

## Puan (1–5)
olgunluk **4** — 3k yıldız, aktif, kurumsal destek; ama ürün kimliği yeni değişti ·
mimari netlik **3** — keşif katmanı temiz, karar katmanı görünmüyor (bulutta) ·
genişletilebilirlik **2** — yeni istemci kolay, **yeni kural imkânsız** ·
güvenilirlik **3** — ağ ve kuotaya bağlı; çevrimdışı çalışmıyor ·
ilkeller **3** — `DiscoveryScope` iyi; risk modeli istemcide görünmüyor ·
gözlemlenebilirlik **2** — çıktı biçimi açıkça deneysel ilan edilmiş ·
güvenlik duruşu **3** — redaksiyon ve rıza güçlü; veri dışarı çıkması ve büyük bağımlılık ağacı düşürüyor

## ADR-000 K6 için kanıt
**Güçlendiriyor, ve K6'nın uygulanabilirliğini kanıtlıyor.**

`guard.py` + `hooks/*.sh|ps1`, K6'nın en iddialı maddesinin ("her araç
çağrısı Permission Manager'dan geçer; ajan doğrudan araç çağıramaz")
mevcut ajan istemcilerinde **fiilen kurulabildiğini** gösteriyor: hook
mekanizmasına yerleşip çağrıyı kesmek çalışıyor ve ticari bir ürün bunu
üretimde satıyor. K6 teorik bir istek değil.

İkinci kanıt `consent.py`: onay kapısı, *tehlikeli işlemden* önce değil,
**tehlikeli olabilecek kodu çalıştırmadan** önce konmuş. K6'nın
"varsayılan izin salt okuma" maddesiyle aynı refleks — bir bileşeni
başlatmak bile bir izin kararıdır.

**Çürüten kanıt: yok.** Aranan şey ("izin kapısı pratikte kurulamıyor"
veya "kullanıcılar kapıyı kapatıyor") yerine tam tersi bulundu.

Ancak mcp-vet ile **bağımsız olarak örtüşen** bir eksik ortaya çıktı:
her iki araç da tek seferlik denetimin yetmediğini söylüyor —
mcp-vet sürümler arası yetenek artışını izliyor (`diff.py`), agent-scan
kalıcı hook kuruyor (`guard.py`). İki bağımsız proje aynı sonuca
varmış: **onay bir kerelik değil, sürekli olmalı.** Protokol §4'e göre
bu, bu izin en güçlü sinyali.

## Alınacak fikir
- **Bir bileşeni *başlatmanın* kendisi izin kararıdır** (`consent.py:1-3`) —
  bizim Permission Manager'ı yalnızca araç *çağrılarını* değil, araç
  sürecinin *ayağa kaldırılmasını* da kapıya almalı.
- **Hook tabanlı çalışma zamanı kesme** (`guard.py`, `hooks/`) — mevcut
  ajan istemcileriyle çalışırken K6'yı uygulamanın somut yolu; kendi
  çalışma zamanımızı yazana kadar kullanılabilir köprü. (Not: bu, aracı
  değil **deseni** almak demek.)
- **Redaksiyonun her çıkış yolunda ayrı uygulanması** (`redact.py:1-9`,
  `consent.py:33`) — bizde de sır temizliği tek noktada değil, terminale,
  loga ve ize giden her yolda ayrı ayrı; ortam değişkeni değerleri
  hiçbir yolda basılmamalı.
- **İstemci keşfi soyutlaması** (`agents/base.py`, `DiscoveryScope`) —
  "hangi ajan hangi aracı yapılandırmış" envanterini tek arayüz
  arkasında toplamak; bizim Tool Registry'nin keşif tarafı için doğrudan
  şablon.
- **Tek seferlik denetim yetmez** (`guard.py` + mcp-vet `diff.py`,
  bağımsız örtüşme) — K6'ya eklenecek madde: izin kararı bileşenin
  sürümüne bağlanır ve bileşen değiştiğinde düşer.

## Alınmayacak
- **Karar mantığının buluta taşınması** (`verify_api.py:523`, `:552`) —
  ADR-000 K4'ün sağlayıcı bağımsızlığı ve MCP yapım-aşaması ilkesiyle
  çelişir; ayrıca kuota dolduğunda güvenlik kapısı çalışmaz hâle gelir.
  Bizim izin kararımız **yerelde ve çevrimdışı** verilebilmeli.
- **Analiz edilen içeriği üçüncü tarafa göndermek** — redaksiyon en iyi
  çaba; kullanıcının özel depoları ve config'leri makineden çıkmamalı.
- **Ağır bağımlılık ağacı** (`pyproject.toml:12-26`, 13 paket) — güvenlik
  katmanının güven yüzeyi denetlediğinden büyük olmamalı; mcp-vet'in
  sıfır bağımlılık duruşu bu iz için doğru olan.
- **Çıktı biçimi deneysel ilan edilmiş bir aracı sözleşme kaynağı
  yapmak** (`README.md:15-23`) — otomatik akışımızın kararı buna
  bağlanamaz.
- **Hook betiklerini (`hooks/*.sh|ps1`) olduğu gibi kurmak** — üçüncü
  taraf bir betiğin bizim ajan istemcimizin her araç çağrısına
  girmesi, K6'nın kendisini üçüncü tarafa devretmek olur. Deseni al,
  betiği değil.
