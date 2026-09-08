# ADR-007 — İzin bileşenin o anki hâline verilir; bileşen değişirse izin düşer

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ3 (birincil)
**Yeniden açılma koşulu:** Özet hesaplamanın maliyeti ölçülebilir bir darboğaz
olursa (araç çağrısı gecikmesinin çoğunluğu özet hesaplamada geçiyorsa); veya
bir bileşen türünün içeriği ilkesel olarak özetlenemiyorsa (uzak servis, canlı
uç nokta).

## Bağlam

ADR-005 izin sınırını karara bağladı ama kendi §Kapsam bölümünde iki şeyi
açıkça dışarıda bıraktı; biri buydu: *"izin verilen bileşenin sürümüne/içerik
özetine bağlanması (02 §4/A1, §7 S7) → Faz 3 Security Architecture."* Blueprint
§6 aynı soruyu S7 olarak bu maddeye devretti. İ3 özeti §6 ise bunu K6'ya
eklenecek bir madde olarak kaydetti.

Sorun şu: K6 izin **verme** anını düzenliyor. İki bağımsız araç, asıl riskin
izin verildikten **sonra** olduğunu gösteriyor.

mcp-vet `diff.py:3-8`:

> The most dangerous MCP update is not the one that arrives malicious. It is
> the one that was fine at v1.2.0, got read and approved, and quietly grew
> shell execution at v1.3.0. Nobody re-reads a patch bump.

Snyk Agent Scan aynı sonuca ters yönden varıyor: tek seferlik tarama yerine
kalıcı bir çalışma zamanı hook'u kuruyor (`guard.py:1`,
`hooks/snyk-agent-guard.{sh,ps1}`). Biri statik, biri dinamik; ikisi de aynı
boşluğu işaret ediyor (İ3 D3).

Bu kanıt K6'yı **çürütmüyor**, eksik buluyor. Bu yüzden ADR-000 "yeniden
açıldı" işareti almıyor; K6'nın üstüne bir madde geliyor.

Karşı tarafta duran bir gerçek de var ve göz ardı edilmedi:
`docs/02-EN-IYI-FIKIRLER.md` bu fikri **elemişti** — "izin verilen bileşenin
sürüme bağlanması (İ3 D3 — iki kaynaktan biri olgunluk 2, kanıt sayılamaz)".
Yani K2'nin kanıt maddesi ekosistem tarafında zayıf. Aşağıdaki karar bu
zayıflığı kabul edip ikinci dala dayanıyor: *bizim bizzat yaşadığımız arıza.*

## Seçenekler

### S1 — İzin bileşene verilir, süresizdir
- Nasıl çalışır: bir kez onaylanan araç/sunucu, sözleşmeden çıkarılana kadar izinlidir.
- Görüldüğü yer: bugünkü MCP istemcilerinin çoğu; Claude Code'un araç izni de büyük ölçüde budur.
- Artı: sıfır ek maliyet, hiç ek kavram yok.
- Eksi: `diff.py:3-8`'in tarif ettiği vakayı hiç görmüyor. Onay bir kere alınır, tehdit sonra gelir.
- Maliyet: görünürde sıfır; gerçek maliyeti bir sessiz güncellemede ödenir.

### S2 — İzin beyan edilen sürüm numarasına bağlanır
- Nasıl çalışır: `binding.version` değişirse izin düşer.
- Artı: ucuz, okunabilir, insanın anlayacağı bir bağ.
- Eksi: sürüm numarası **beyandır**, ölçüm değil. Aynı sürüm etiketiyle içerik değişebilir; bir MCP sunucusu `latest` etiketiyle çalışıyorsa bağ hiç kurulmaz. mcp-vet git ref karşılaştırmasının kaçırdığı vakayı kendisi kabul ediyor (`diff.py:15-21`).
- Maliyet: düşük, ama sağladığı garanti beyanın doğruluğuna eşit — AP3'ün tam tanımı.

### S3 — İzin bileşenin içerik özetine (digest) bağlanır
- Nasıl çalışır: izin verilirken bileşenin araç tanımlarının/manifestinin sha256'sı hesaplanır ve karara yazılır. Sonraki çağrıda özet yeniden hesaplanır; farklıysa izin düşer ve yeni karar istenir.
- Artı: beyan değil ölçüm. Sürüm etiketi yalan söylese de bağ tutar.
- Eksi: her yeniden kullanımda bir hesap; ve "bileşenin içeriği" nedir sorusunun her bileşen türü için ayrı cevaplanması gerekir.
- Maliyet: özet hesaplama gecikmesi + hangi baytların özete girdiğinin tanımı.

### S4 — İzin hiç yeniden kullanılmaz; her çağrı sıfırdan karar
- Artı: bağ sorunu ortadan kalkar; bileşen değişmiş mi diye sormaya gerek yok.
- Eksi: insan kapısına düşen her çağrı yeniden onay ister — gece koşusu diye bir şey kalmaz. S3'ün çözdüğü problem burada "çözülmez, yasaklanır" oluyor.
- Maliyet: otonominin tamamı; ADR-005'in S3'ü ile aynı duvara çarpar.

## Karar

**S3, iki katmanlı bağ ile.** Dört somut kural:

**1. `ALLOW` kararı `binding` olmadan yazılamaz.** İzin bir bileşene değil,
bileşenin **o anki hâline** verilir. `permission.schema.json` bunu `if/then`
ile zorlar: `decision: ALLOW` → `required: ["binding"]`. Bağsız izin, bileşen
değişince düşemez — düşemeyen izin süresiz izindir (S1).

**2. Zorunlu olan `digest`, `version` değil.** `binding.version` isteğe
bağlıdır ve insan içindir; makinenin baktığı alan `binding.digest`'tir
(`^sha256:[0-9a-f]{64}$`). Gerekçe S2'nin eksisi: sürüm numarası beyandır, özet
ölçümdür. Beyanla ölçümü aynı kefeye koymak AP3'ün mekanizmasıdır.

**3. Yeniden kullanılabilir izin özetsiz verilemez.** `grant.mode` `oturum`
veya `sureli` ise `binding.digest`, `expires_at` ve `max_calls` üçü de
zorunludur. Tek çağrılık izinde bağ yine yazılır (kural 1) ama tükendiği için
yeniden doğrulama sorusu doğmaz. **Süresiz izin diye bir mod yoktur** —
`grant.mode` enum'unda böyle bir değer tanımlı değildir.

**4. Özet tutmuyorsa izin düşer, sessizce yenilenmez.** Yeniden kullanım
anında hesaplanan özet karardaki özetten farklıysa sonuç `ALLOW` olamaz. Ne
olacağı çağrının kendisine bağlıdır: sabit sınıra dokunuyorsa
`HUMAN_REQUIRED`, dokunmuyorsa yeni bir karar üretilir ve eski kayıt
`supersedes` ile gösterilir. Eski kayıt **silinmez** — düşen izin de bir
kayıttır.

**Özete ne girer (bileşen türü başına):**

| Bileşen | Özetlenen | Özetlenmeyen |
|---|---|---|
| MCP sunucusu | `tools/list` çıktısının kurallı JSON serileştirmesi (ad, açıklama, `inputSchema`, `annotations`) | sunucunun süreç kimliği, çalışma zamanı durumu |
| Yerel araç (Claude Code) | araç adı + parametre şeması + ev sahibi sürümü | ev sahibinin tüm ikili dosyası |
| Ajan sözleşmesi | `agent.schema.json` belgesinin baytları | türetilmiş `.claude/agents/*.md` çıktısı (K8: türev, kaynak değil) |
| Eklenti / uzatma noktası | manifest baytları | eklentinin yazdığı veri |

**Özeti hesaplanamayan bileşene yeniden kullanılabilir izin verilmez.** Uzak
bir uç noktanın içeriği ölçülemiyorsa `grant.mode` yalnızca `tek-cagri`
olabilir. Bu, S4'ün dar bir uygulaması: ölçülemeyen yerde otonomi yok.

## Dahil etme ölçütü (ADR-000 K2)

| | |
|---|---|
| Çözdüğü problem | Onaylanmış bir bileşenin onaydan sonra yetenek kazanması ve eski onayla çalışması. Somut: `diff.py:3-8`'in v1.2.0 → v1.3.0 vakası; bizde karşılığı, `gh` CLI'a verilmiş bir iznin CLI güncellendikten sonra kendiliğinden geçerli sayılması. |
| Önlediği hata | *Zamanla kayan yetki* — izin ile izin verilen şey arasındaki bağın kopması. AP3'ün özel bir hâli: onay kaydı bir garanti beyan ediyor ama neyi onayladığını artık gösteremiyor. |
| Eklediği maliyet | Her yeniden kullanımda bir özet hesabı (gecikme); her bileşen türü için "özete ne girer" tanımı ve bakımı; ve düşen izinlerin yeniden onaya gelmesi → gece otonomisi bir miktar daha azalır. Ölçülemeyen bileşenler tek çağrılığa iner, yani bazı iş yükleri yavaşlar. |
| Kanıt (≥2 olgun proje veya yaşadığımız arıza) | Ekosistem tarafı **zayıf ve bu kabul ediliyor**: iki kaynak var (mcp-vet `diff.py:3-8`, Snyk Agent Scan `guard.py:1`) ama biri kullanıcının kendi deposu (olgunluk 2) ve `02-EN-IYI-FIKIRLER.md` bu yüzden fikri elemişti. Karar K2'nin **ikinci** dalına dayanıyor: bizzat yaşadığımız arıza — `BILINEN-TUZAKLAR.md` #12 (kuyruğa elle dokunurken zamanlayıcının kapmış olduğu görev: durum onay anıyla kullanım anı arasında değişti) ve #13 (düzeltme görevi çalıştığında sorun çoktan kapanmıştı: anlık görüntü ile eylem anı arasındaki yarış). İkisi de aynı sınıf: **karar anındaki dünya ile eylem anındaki dünya aynı değil.** |

## Sonuçlar

**Olumlu:** "Bu çağrıya kim izin verdi" sorusunun cevabı artık *neye* izin
verildiğini de gösteriyor. Sessiz güncelleme bir onay kaybına dönüşüyor, sessiz
bir yetki kazanımına değil. `supersedes` sayesinde düşen izinlerin tarihi
okunabilir kalıyor.

**Olumsuz / kabul edilen bedel:** Ekosistem kanıtı zayıf; bu ADR'nin dayandığı
asıl kanıt kendi arızalarımız. Özete neyin girdiği tablosu bakım yüküdür ve
yanlış tanımlanmış bir özet (fazla kapsayan) izinleri gereksiz yere düşürüp
gece koşusunu insan kapısıyla tıkayabilir — bu, ADR-005'in "tek geçit darboğaz
olursa" koşuluna komşu bir risktir ve **ölçülmesi gerekir** (bkz.
`05-GUVENLIK.md` §8 sayaç 3).

**Etkilenen sözleşmeler:** `contracts/permission.schema.json` — `binding`
(component/version/digest), `grant` (mode/expires_at/max_calls), `supersedes`.
`contracts/agent.schema.json` — değişiklik yok; ajan sözleşmesinin kendisi
özetlenen bir bileşendir.

**Etkilenen diğer ADR'ler:** ADR-005 (kapsamadığını söylediği maddeyi bu ADR
kapatır); ADR-000 K6 (madde eklenir, çürütülmez).

## Uygulama notu

Faz 5'te `src/permission_manager/binding.py` (veya dil kararına göre karşılığı):
tek bir `ozet_hesapla(bilesen)` fonksiyonu, bileşen türü başına bir dal, ve
kurallı JSON serileştirme (anahtar sırası sabit, boşluk yok) — aksi hâlde aynı
içerik farklı özet üretir ve izin sebepsiz düşer.

Test edilebilir ölçüt: "bileşenin araç tanımına yeni bir araç eklendiğinde,
önceki `ALLOW` kararı yeniden kullanılmıyor" ve "yalnızca `version` değişip
içerik aynı kaldığında izin düşmüyor" testleri geçiyorsa karar uygulanmıştır.
İkincisi önemlidir: bu ADR sürüm etiketine değil içeriğe bağlanmayı seçti.
