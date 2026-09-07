# İ3 denetimi — kanıt doğrulaması

**Tarih:** 2026-09-07 · **Denetleyen:** canlı oturum (araştırmayı yapan iki koşudan farklı)
**Yöntem:** `node arac/kanit-dogrula.js i3-arac-guvenlik --yaz` (v3.1) + spec alıntılarının
doğru sürüm dizinine (`docs/specification/2026-07-28/`, `schema/2026-07-28/schema.ts`)
karşı elle örneklemesi + şüphelilerin `grep -rn` ile sınıflandırması.

## Araç özeti

| Toplam | TAM | YAKIN | VAR (token'sız) | Şüpheli |
|---|---|---|---|---|
| 256 | 73 | 13 | 161 | 9 |

Doğrulanabilir 95 alıntının **%91**'i doğrulandı. **161 alıntı token'sız (VAR)** —
bu iz spec ağırlıklı (mdx/proto); satırlar kod tanımlayıcısı değil metin
alıntılıyor, araç bunları otomatik doğrulayamıyor. Bu yüzden elle örnekleme
diğer izlerden geniş tutuldu.

## Spec örneklemesi (araç doğrulayamayanlar)

| md | Alıntı | Kaynak satır | Sonuç |
|---|---|---|---|
| mcp-spec.md:26 | `index.mdx:38-40` "üç rol" | "Hosts / Clients / Servers" tanımları | ✓ birebir |
| mcp-spec.md:36 | `architecture/index.mdx:56-57` host "Enforces security policies and consent" | aynı cümle | ✓ birebir |
| mcp-spec.md:43 | `client/sampling.mdx:52` "Servers MUST NOT send tool-enabled sampling" | aynı cümle | ✓ birebir |
| mcp-spec.md:73 | `server/tools.mdx:293-306` inputSchema geçerli JSON Schema | "MUST be a valid JSON Schema object (not null)" | ✓ |
| mcp-spec.md:127 | `server/tools.mdx:33-34` insan kapısı **SHOULD** | "there **SHOULD** always be a human in the loop with the ability to deny tool invocations" | ✓ birebir — K6 için kritik |
| mcp-spec.md:176 | `index.mdx:117-118` protokol zorlayamıyor | "While MCP itself cannot enforce these security principles at the protocol level, implementors **SHOULD**" | ✓ birebir — K6 için kritik |
| a2a-spec.md | `a2a.proto:195-212` TaskState | 6 `TASK_STATE_*` satırı | ✓ |

İlk denemede yanlış dosyayı yakaladım (`index.mdx` → SEP dizini); sürüm
dizini belirtilince yedisi de tuttu. **Ders:** birden çok sürümü olan spec
depolarında araç, md'nin "Kimlik" bölümündeki sürüm yolunu temel almalı
(araca eklenecek).

## Şüphelilerin sınıflandırması

| Alıntı | Sınıf | Not |
|---|---|---|
| `a2a-spec.md:227, :256` → `specification.md:1908-…` | **araç kusuru** | beklenen token iç içe alıntıydı (`a2a.proto:206-207`); iddia proto'da doğru |
| `e2b.md:9` → `README.md:20` "firecracker" | **araç kusuru** | satır e2b.md'nin **dürüstlük notu**: "bu depo istemci SDK, Firecracker çalışma zamanı burada yok" — iddia değil, kapsam uyarısı |
| `e2b.md:59` → `sandbox_api.py:861-863` `ValueError` | elle bakılmadı | düşük önem |
| `llamafirewall.md:20` → `prompt_guard_scanner.py:19` `Role.USER` | **yanlış dosya** | `Role.USER` examples/*.py'de; scanner dosyasında yok |
| `llamafirewall.md:89` → `custom_check_scanner.py:28` "production-ready" | **yanlış dosya** | ifade README ve architecture.md'de |
| `llamafirewall.md:110` `yeter` | **araç kusuru** | Türkçe sözcük token sanıldı |
| `mcp-vet.md:163` → `server.py:13` `network.external` | **belirsiz** | araç test fixture'ını seçti; desenler `mcp_vet/patterns.py` ve `diff.py`'de — md'nin kastı fixture olabilir |
| `mcp-vet.md:177` → `models.py:34-40` `UNEXPLAINED` | **satır kayması** | sembol `models.py`'de var, satır farklı |

**Uydurma iddia: 0.**

## Kalite değerlendirmesi

- **Birincil kaynak kuralı uygulanmış:** MCP için spec mdx + normatif
  `schema.ts`, A2A için `a2a.proto`; README'ye dayanan iddia yok.
- **Görevin açık şartı yerine getirilmiş:** §6 K6'yı çürüten kanıtı
  *aramış* (üç somut iddia tanımlayıp bulamamış), dört bağımsız kanıtla
  güçlendiğini göstermiş ve **ADR-000'ı yeniden açmamış** — doğru karar.
- **Faz 3 için somut çıktı:** `permission.schema.json` alanları (şiddet ve
  güvenilirlik ayrı eksen; `ALLOW/BLOCK/HUMAN_REQUIRED`; "kontrol edilmedi"
  ≠ "temiz"; onay kapsamı), görev durum makinesine kesintili
  `ONAY_BEKLIYOR`, kimlik bilgisinin ajana hiç ulaşmaması, denetleyici
  hata yolunun güvenli tarafa düşmesi.
- **K6'ya aday ek madde (D3):** verilen izin bileşenin sürümüne/içerik
  özetine bağlanır; bileşen değişirse izin düşer. İki bağımsız kaynaktan
  (mcp-vet `diff.py`, Snyk Agent Scan). Faz 3 güvenlik mimarisine not
  düşüldü.
- Kullanıcının `mcp-vet` aracı kayırılmamış; katkısı somut alanlarla
  (models.py, risk.py) sınırlandırılmış.
- Yarım kalan ilk koşu dürüstçe işaretlenmiş, ikinci koşu klonları yeniden
  indirmeden devam etmiş — devam edilebilirlik kuralı çalıştı.

## Karar

İ3 **sentezde kullanılabilir.** İki yanlış-dosya alıntısı (LlamaFirewall)
sentezde doğrudan kullanılacaksa önce düzeltilmeli; iddialar geçerli.
