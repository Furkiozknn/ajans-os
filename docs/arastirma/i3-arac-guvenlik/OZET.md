# İ3 — Araçlar ve güvenlik sınırı: iz özeti

Protokol `docs/00-ARASTIRMA-PROTOKOLU.md` §4 biçimi. Bu izde yedi kaynak
incelendi: **iki spesifikasyon birincil kaynaktan** (MCP ve A2A — görevin
açık şartı: repo README değil, spec belgesinin kendisi), iki sandbox, bir
guardrail kütüphanesi ve iki güven denetimi aracı. Her iddia ilgili proje
dosyasındaki dosya yolu + satır numarasına bağlıdır.

Bu iz, ADR-000 **K6**'nın (en az yetki + insan kapısı) doğrudan konusu.
Görev K6'yı çürüten kanıtın açıkça aranmasını istiyordu; sonuç §6'da.

---

## 1. İncelenen kaynaklar

| Kaynak | Tür | Yıldız | Son push | Lisans | Canlılık | Olg. | Mim. | Gen. | Güv.ilk. | Gözl. | Güvenlik | Dosya |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| modelcontextprotocol/modelcontextprotocol | spec | 9.151 | 2026-09-07 | MIT→Apache-2.0 geçişte | geçti | 5 | 5 | 4 | 2 | 2 | 3 | [mcp-spec.md](mcp-spec.md) |
| a2aproject/A2A | spec | 25.678 | 2026-09-04 | Apache-2.0 | geçti | 5 | 5 | 4 | 3 | 2 | 4 | [a2a-spec.md](a2a-spec.md) |
| e2b-dev/E2B | sandbox | 13.697 | 2026-09-07 | Apache-2.0 | geçti | 4 | 4 | 3 | 3 | 2 | 2 | [e2b.md](e2b.md) |
| microsandbox/microsandbox | sandbox | 8.113 | 2026-09-07 | Apache-2.0 | geçti | 3 | 4 | — | — | 2 | 4 | [microsandbox.md](microsandbox.md) |
| meta-llama/PurpleLlama (LlamaFirewall) | guardrail | — | — | — | geçti | 3 | 4 | 4 | 3 | 2 | 3 | [llamafirewall.md](llamafirewall.md) |
| invariantlabs-ai/mcp-scan (Snyk Agent Scan) | güven denetimi | 3.014 | 2026-09-07 | Apache-2.0 | geçti | 4 | 3 | 2 | 3 | 2 | 3 | [mcp-scan.md](mcp-scan.md) |
| Furkiozknn/mcp-vet | güven denetimi | **0** | 2026-09-06 | MIT | **kısmen** | 2 | 5 | 3 | 3 | 3 | 4 | [mcp-vet.md](mcp-vet.md) |

microsandbox'ta iki puan bilerek boş: crate gövdeleri okunmadı, protokol
§5 gereği "incelenmedi" yazıldı. Sıfırla doldurulmadı.

Tohum listesinde (protokol §2) **olmayan** adaylar: **mcp-scan** ve
**microsandbox** — iki tane, kural iki istiyordu.

Matris cevapları (protokol §6.2):

| Kaynak | saglayici_bagimsiz | sozlesme_var | insan_kapisi | checkpoint |
|---|---|---|---|---|
| MCP spec | evet | evet | kısmen | hayır |
| A2A spec | evet | evet | evet | hayır |
| E2B | evet | evet | hayır | kısmen |
| microsandbox | evet | evet | hayır | — |
| LlamaFirewall | **hayır** | kısmen | evet | hayır |
| mcp-scan | evet | kısmen | evet | hayır |
| mcp-vet | evet | evet | hayır | hayır |

"kısmen" gerekçeleri: MCP insan kapısı — ilkeler metninde var ama
zorlayıcı değil, host'a devredilmiş; LlamaFirewall sözleşme — tarayıcı
arayüzü var, ajan sözleşmesi yok; mcp-scan sözleşme — çıktı biçimi
kendi README'sinde "experimental" ilan edilmiş; E2B checkpoint —
`pause`/`resume` var ama durum modeli bu depoda değil.

---

## 2. Yinelenen desenler (birden çok kaynakta **bağımsız** olarak)

**D1 — Protokoller güvenliği tanımlar, zorlamaz. Zorlama uygulamanın işi.**
Bu izin en güçlü ve en tekrar eden bulgusu. MCP'de tek güvenlik cümlesi
host'a ait ve zorlayıcı bir izin katmanı protokolde yok
(`mcp-spec.md` §Mimari). A2A'da aynı cümle neredeyse birebir:
"Authorization boundaries are defined by each agent's authorization
model, **not prescribed by the protocol**" (`specification.md:3105`).
İki bağımsız, rakip spesifikasyon aynı kararı vermiş. Sonuç bizim için
tektir: **bu katmanı biz yazmazsak kimse yazmıyor.**

**D2 — İnsan onayı, sistemin durum makinesinde birinci sınıf bir durum.**
A2A'da `TASK_STATE_AUTH_REQUIRED` ayrı bir enum değeri ve "interrupted
state" olarak belgelenmiş (`a2a.proto:206-207`); `INPUT_REQUIRED`'dan
ayrı tutulmuş — "bilgi eksik" ile "yetki eksik" farklı şeyler.
LlamaFirewall'da aynı fikir karar tipinde: `ALLOW` / `BLOCK` /
`HUMAN_IN_THE_LOOP_REQUIRED` üç değerli enum
(`llamafirewall_data_types.py:22-25`). İki farklı katman (protokol /
guardrail kütüphanesi), aynı tasarım: onay bir yan mekanizma değil, ilk
sınıf bir değer.

**D3 — Tek seferlik onay yetmez; onay bileşenin sürümüne bağlanmalı.**
mcp-vet `diff.py:3-8`: "The most dangerous MCP update is not the one
that arrives malicious. It is the one that was fine at v1.2.0, got read
and approved, and quietly grew shell execution at v1.3.0. Nobody
re-reads a patch bump." Snyk Agent Scan aynı sonuca farklı yoldan
varmış: tek seferlik tarama yerine kalıcı çalışma zamanı hook'u kuruyor
(`guard.py:1`, `hooks/snyk-agent-guard.{sh,ps1}`). İki bağımsız güven
denetimi aracı, biri statik biri dinamik, aynı boşluğu işaret ediyor.
**Bu, ADR-000 K6'da bugün olmayan bir madde** (§6'ya bakınız).

**D4 — Ajan sırra değil yeteneğe sahip olmalı; sır hedefe kapsamlanır.**
microsandbox `README.md:38` "Unexploitable secret keys that never enter
the VM" ve her sır tek bir hedefe bağlı (`allowed_host`,
`README.md:216-219`). A2A bağımsız olarak aynı yere varıyor: in-band
kimlik bilgisi zincirdeki her ajana açılır, bu yüzden kimlik bilgisi
"isteği başlatan ajana bağlanmalı ki yalnızca o kullanabilsin"
(`specification.md:1961-1962`). Hipervizör katmanı ile protokol katmanı,
aynı ilke.

**D5 — Hata durumunda güvenli tarafa düşmek, sessizce izin vermemek.**
LlamaFirewall'da bir denetleyici çağrısı başarısız olursa sonuç `ALLOW`
değil `HUMAN_IN_THE_LOOP` (`alignmentcheck_scanner.py:125-131`).
mcp-vet'te `Severity.NOT_FLAGGED` bilerek `SAFE` diye adlandırılmamış —
"mcp-vet never concludes that something is safe, only that a given check
did not fire" (`models.py:34-40`) — ve çalıştırılamama ayrı bir çıkış
kodu (`risk.py:35` `EXIT_ERROR = 4`). Aynı refleks: **denetlenmemiş ≠
temiz.**

**D6 — Varsayılan kapalı, izin açıkça ve kapsamlı istenir.**
microsandbox'ta ağ erişimi sandbox oluşturma çağrısının imzasında
(`allowed_hosts` / `allowed_ports`, `README.md:211-214`), ayrı bir config
dosyasında değil. MCP'de `roots` mekanizması aynı fikrin dosya sistemi
karşılığı. A2A'da SSRF savunması için reddedilecek IP aralıkları tek tek
sayılmış (`specification.md:3122-3125`).

---

## 3. Ayrışan yaklaşımlar

**A1 — Denetim aracının güven yüzeyi: sıfır bağımlılık mı, zengin
ekosistem mi?** mcp-vet `dependencies = []` seçmiş, gerekçesi kodda
yazılı (`pyproject.toml:7-9`): "An auditing tool that pulls in a
dependency tree to run is asking you to trust more code in order to
check less of it." Snyk Agent Scan 13 çalışma zamanı bağımlılığı
alıyor (`pyproject.toml:12-26`) ve karşılığında detect-secrets,
pydantic, rich gibi olgun parçaları kullanıyor. **Koşul:** aracın
kendisi güven zincirinin parçasıysa (bizim durumumuz) sıfır bağımlılık
doğru; geniş kapsama ve kurumsal entegrasyon hedefse ikincisi.

**A2 — Karar nerede verilir: yerelde mi bulutta mı?** mcp-vet tamamen
yerel ve çevrimdışı çalışabiliyor. Snyk Agent Scan kararı buluta
taşımış — API token zorunlu (`verify_api.py:523`), günlük kuota var
(`verify_api.py:552`). Bulut, kuralları merkezî olarak güncelleyebilme
avantajı veriyor; bedeli, **kuota dolduğunda güvenlik kapısının
çalışmaması** ve analiz edilen içeriğin dışarı çıkması. Bizim için
karar nettir (ADR-000 K4 + gizlilik): yerel.

**A3 — Denetim riski: hiç almamak mı, alıp insana sormak mı?**
mcp-vet saf statik — incelediği kodu asla çalıştırmıyor, karşılığında
obfuscation ve dinamik yüklemeyi göremiyor. Agent Scan sunucuyu
başlatıp `tools/list` çekiyor (gerçek araç tanımlarını görüyor), ama
bunun kod çalıştırmak olduğunu kabul edip **başlatmadan önce rıza
istiyor** (`consent.py:1-3`). İkisi de savunulabilir; bizim modelimizde
ikincisi ancak sandbox içinde yapılırsa kabul edilebilir.

**A4 — Sandbox sınırı nerede: bulutta mı, süreçte mi?** E2B bulut
hizmetinin istemcisi; izolasyon kodu depoda **yok** (`e2b.md` §Kimlik,
Copybara ile ayrı `infra` deposundan senkronize). microsandbox
kütüphane olarak gömülüyor, KVM tabanlı microVM'i kendi crate'lerinde
tutuyor (`README.md:32`, `:118`). **Koşul:** ölçeklenebilirlik ve
kurulum kolaylığı → E2B; sınırın denetlenebilirliği → microsandbox.
Donanım kısıtımız (KVM yok, Windows) ikincisini bugün kullanılamaz
kılıyor.

---

## 4. Anti-pattern'ler

**AP1 — En kritik güvenlik kuralını `SHOULD`/`MAY` bırakmak.**
MCP'de en kritik kural SHOULD (`mcp-spec.md` §Puan). A2A'da Agent Card
imzalama "**MAY** be digitally signed" (`specification.md:2014`) ve
doğrulama "**SHOULD** verify at least one signature" (`:2140`) — yani
uyumlu bir istemci imzasız karta güvenerek hiçbir kuralı çiğnemiyor.
**Opsiyonel kimlik doğrulama, pratikte doğrulanmayan kimliktir.**

**AP2 — Yan etkiyi bağlayıcı olmayan "ipucu" olarak modellemek.**
MCP'de `ToolAnnotations` (`destructiveHint`, `readOnlyHint`) yalnızca
ipucu; sunucu yanlış beyan edebilir. A2A'da karşılığı hiç yok — bir
ajanın "dosya sil" skill'i ile "dosya listele" skill'i sözleşme
düzeyinde ayırt edilemiyor (`a2a-spec.md` §Ajan tasarımı). Sonuç: yan
etki beyanına **güven ama doğrula** yetmez; beyan zorlayıcı olmalı ya
da hiç kullanılmamalı.

**AP3 — Aynı girdi için sync/async yolların farklı davranması.**
LlamaFirewall'da iki yol farklı karar birleştirme mantığı kullanıyor
(`llamafirewall.py:141-160` vs `167-182`) — test edilmemiş bir
tutarsızlık kaynağı ve güvenlik kararında en kötü yerde.

**AP4 — Deneysel etiketli bileşeni karar noktasına bağlamak.**
LlamaFirewall'ın en ilginç iki tarayıcısı `[EXPERIMENTAL]`
(`custom_check_scanner.py:28`). mcp-vet'in 560 satırlık regex kataloğunun
yanlış pozitif oranı hiç ölçülmemiş. İkisi de aynı kurala tabi: ölçülmemiş
detektör önce **gölge modda** çalışır, karar vermez.

**AP5 — Çıktı sözleşmesini kararsız ilan edip yine de kapı olarak
kullandırmak.** Snyk Agent Scan README'si çıktının deneysel olduğunu ve
değişebileceğini yazıyor (`README.md:15-23`), ama araç CI kapısı olarak
konumlanıyor. Sözleşme yoksa otomasyon yoktur.

**AP6 — Denetlenmemiş boyutu sessizce onaylanmış saymak.** İzin
katmanının en sinsi kaçağı. mcp-vet bunu doğru yapıyor (`(not checked)`
işareti, canlı çıktıda doğrulandı); anti-pattern, bunu yapmayan her
sistem.

---

## 5. Bizim için öneri

1. **Permission Manager'ı biz yazacağız — bu bir tercih değil, D1'in
   sonucu.** İki büyük protokol de zorlamayı uygulamaya devretti
   (`specification.md:3105`; `mcp-spec.md` §Mimari). Bileşen mimariye
   K2 ölçütüyle **girer**; alternatif yok.
2. **İzin kararı sözleşmesi (`permission.schema.json`) şu alanları
   taşımalı:** (a) şiddet ve güvenilirlik **ayrı** eksenler
   (`mcp_vet/models.py:9-16`), tek "risk skoru" alanı **olmamalı**
   (`risk.py:3-7`: genel karar alanların en kötüsü, ortalaması değil);
   (b) üç değerli karar `ALLOW`/`BLOCK`/`HUMAN_REQUIRED`
   (`llamafirewall_data_types.py:22-25`); (c) "kontrol edilmedi" ile
   "kontrol edildi, temiz" ayrı değerler (`models.py:34-40`);
   (d) onay kararının **kapsamı** — hangi işlem, ne kadar süre, sonraki
   çağrılara geçerli mi (`specification.md:1968-1972`: onay sinyali tek
   başına yetki değildir).
3. **Görev durum makinesine `ONAY_BEKLIYOR` durumu, "kesintili" olarak
   eklenmeli** (`a2a.proto:206-207`) ve "girdi bekliyor"dan ayrı
   tutulmalı. Ayrıca onay isteği **zincir boyunca yukarı delege
   edilebilmeli** (`specification.md:1945-1947`) — alt-ajan doğrudan
   kullanıcıya ulaşamadığı için üst-ajan kendi görevini de onay bekler
   duruma geçirip isteği insana taşır.
4. **Kimlik bilgisi ajana hiç ulaşmamalı.** Ajan "şu hedefe şu isteği
   yap" yeteneğini alır; anahtarı izin kapısı enjekte eder ve anahtar
   tek bir hedefe kapsamlanır (`microsandbox README.md:38`, `:216-219`;
   `specification.md:1961-1962`). Bu, sabit sınırımızı ("ajan kimlik
   bilgisi girmez") bir adım ileri taşır: ajan onu **görmez** bile.
5. **Her denetleyici hata yolu güvenli tarafa düşmeli**
   (`alignmentcheck_scanner.py:125-131`), ve "kontrol çalışmadı" ile
   "kontrol temiz" hiçbir zaman aynı sinyali vermemeli
   (`risk.py:35` `EXIT_ERROR = 4`) — otomatik gece çalıştırmalarımız
   için doğrudan geçerli.

---

## 6. ADR-000 K6 için karar (görevin açık şartı)

**K6'yı çürüten kanıt arandı; bulunamadı.** Aranan somut iddialar
şunlardı: (a) yaygın bir spesifikasyonun veya olgun projenin "her
çağrıyı izin katmanından geçirmek gereksiz yüktür" demesi; (b) ajanlar
arası izin devralmanın güvenli sayıldığı bir örnek; (c) insan kapısız
otomatik onayın üretimde sorunsuz çalıştığı bir vaka. Üçü de yok.

Bulunan tek gerilim K6'nın *maliyetiyle* değil *kapsamıyla* ilgili: A2A
da zorlayıcı katman koymamayı seçmiş, ama gerekçesi "gereksiz" değil,
"**bu protokolün kapsamı değil**" (`specification.md:3105`). Kapsam
kararı, ilke reddi değil.

**K6 güçleniyor, dört bağımsız kanıtla:** protokollerin zorlamayı
uygulamaya devretmesi (D1), onay kapısının protokol durum makinesine
gömülmesi (D2), izin devralmama ilkesinin A2A'nın *opaque execution*
kurucu ilkesiyle örtüşmesi, ve kapının fiilen kurulabildiğinin ticari
bir üründe kanıtlanması (`guard.py` + `hooks/`).

**Ancak K6'ya eksik bir madde tespit edildi (D3).** K6 izin *verme*
anını düzenliyor; iki bağımsız araç asıl riskin izin verildikten
**sonra bileşenin değişmesinde** olduğunu gösteriyor (mcp-vet
`diff.py:3-8`; Snyk Agent Scan `guard.py`). Önerilen ek madde:

> *Verilen izin, bileşenin belirli bir sürümüne (veya içerik özetine)
> bağlanır. Bileşen değişirse izin düşer ve yeniden onay gerekir.*

Bu, K6'yı çürütmediği için ADR-000 "yeniden açıldı" işareti
**gerektirmiyor**; Faz 3'te `docs/mimari/05-GUVENLIK.md` ve
`permission.schema.json` yazılırken K6'ya eklenecek bir madde olarak
kaydedilmiştir. Karar sentez aşamasına aittir, bu araştırmaya değil.

---

## 7. Açık sorular

1. **İzin kapısı hangi katmanda oturacak?** Kendi çalışma zamanımızda
   mı, yoksa Claude Code'un hook mekanizmasına yerleşerek mi
   (`mcp-scan/guard.py` deseni)? İkincisi bugün çalışır ama K6'yı
   üçüncü taraf bir mekanizmaya bağlar.
2. **Sır enjeksiyonu tek makinede nasıl uygulanır?** microsandbox
   modeli hipervizöre yaslanıyor (KVM yok bizde). Sandbox olmadan "ajan
   sırrı görmez" nasıl sağlanır — proxy süreç mi, ayrı kullanıcı hesabı
   mı? Faz 3 kararı.
3. **Araç yan etki beyanı zorlayıcı mı olacak?** MCP'nin `ToolAnnotations`
   ipucu modeli AP2'ye düşüyor. Bizim Tool Registry'de yan etki sınıfı
   (okuma/yazma/geri alınamaz) zorunlu alan mı olmalı, ve kim
   doğrulayacak?
4. **Bileşen değişince izin düşmesi (D3) nasıl tespit edilecek?**
   Sürüm numarası yeterli mi, yoksa dosya ağacının özeti mi gerekli?
   mcp-vet git ref karşılaştırmasının kaçırdığı vakayı kendi kabul
   ediyor (`diff.py:15-21`).
5. **Denetim raporu izni genişletebilir mi?** Öneri: hayır — temiz
   rapor insan kapısındaki kararı *bilgilendirir*, izni *genişletmez*.
   Onaylanması gereken bir ilke.

---

## 8. İncelenmeyenler

- **Open Policy Agent (OPA)** — tohum listesindeydi, açılmadı. İzin
  modeli için en olgun genel çözüm ve Rego politika dili bizim
  `permission.schema.json` tasarımını doğrudan etkileyebilir.
  **Faz 2'ye girmeden önce açılması önerilir.**
- **Daytona** — klonu `_inceleme/daytona` altında hazır, bütçe yetmedi.
  E2B ve microsandbox iki sandbox modelini zaten temsil ettiği için
  öncelik düşük.
- **guardrails-ai ve NVIDIA NeMo Guardrails** — klonları hazır
  (`_inceleme/guardrails`, `_inceleme/NeMo-Guardrails`), bütçe yetmedi.
  LlamaFirewall guardrail kategorisini temsil etti; ikisinin eklenmesi
  D5 ve AP4'ü güçlendirir ya da çürütür.
- **microsandbox'ın crate gövdeleri** — "sırlar VM'e hiç girmez"
  iddiası (`README.md:38`) yalnızca README'den okundu. Protokol §1
  "README pazarlamadır" kuralı gereği **doğrulanmamış** sayılıyor. Bu
  iddia mimarimizin varsayımı olacaksa (öneri 4) önce kodda
  doğrulanmalı — bir sonraki turda ilk iş.
- **MCP referans sunucuları** — spec okundu, uygulamalar okunmadı;
  `ToolAnnotations`'ın pratikte doğru doldurulup doldurulmadığı
  ölçülmedi. AP2 için ölçülebilir bir kanıt kaynağı olurdu.
