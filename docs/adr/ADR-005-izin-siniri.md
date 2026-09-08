# ADR-005 — İzin sınırı: tek geçit, sabit sınırlar ve muafiyetsiz uzatma noktaları

**Durum:** Kabul edildi
**Tarih:** 2026-09-08
**İlgili izler:** İ3 (birincil), İ6, İ1, İ2
**Yeniden açılma koşulu:** Tek geçit ölçülebilir bir darboğaz olursa (araç
çağrısı gecikmesinin çoğunluğu izin kararında geçiyorsa); veya bir uzatma
noktasının izin sözleşmesinden geçirilmesi teknik olarak imkânsız çıkarsa.
Bu ADR **kapının kaldırılmasıyla** yeniden açılmaz — bkz. §Karar/1.

## Bağlam

ADR-000 K6 izin modelini zaten karara bağlamıştı: en az yetki, varsayılan salt
okuma, geri alınamaz işlemlerde insan kapısı. Faz 1 ve 2 bunu çürütmedi,
**güçlendirdi** — ama iki şeyi de netleştirmesi gerekti:

- **AP1** (5 iz, 9 kaynak — bütün anti-pattern listesinin en güçlüsü): insan
  kapısı bir yapılandırma değeri olduğunda tek bayrakla sıfırlanıyor. Aider
  `--yes-always`, OpenHands `NeverConfirm`, MCP'de yalnızca SHOULD, Letta'da
  varsayılana bağlanmamış onay kuralı, İ4'te yedi projeden yalnızca birinde
  birinci sınıf kapı.
- **02 §7 S5**: uzatma noktaları (yeni ajan, yeni araç, eklenti) izin
  sözleşmesinden muaf mı? Matrisin en net çelişkisi buna bakıyor:
  genişletilebilirlik ↔ güvenlik (LangGraph 5/2, Mastra 4/2, graphrag 5/2) —
  en çok uzatma noktası veren çatı en geniş saldırı yüzeyini de veriyor.

## Seçenekler

### S1 — İzin bir yapılandırma katmanı; kapılar açılıp kapatılabilir
- Nasıl çalışır: onay gerektiren işlemler bir listede tutulur, kullanıcı listeyi daraltabilir; bir "hepsine evet" kısayolu vardır.
- Görüldüğü yer: Aider (`--yes-always`), OpenHands (`NeverConfirm`), CrewAI `human_input` döngüsü.
- Artı: otonomi ihtiyacına göre ayarlanır; gece koşusu hiç durmaz.
- Eksi: AP1'in tam tanımı. En olgun araç bile (Aider, olgunluk 5) kapıyı bir bayrağa bağlıyor; bayrak bir kez konduğunda kalıcı olur.
- Maliyet: görünürde ucuz; gerçek maliyeti tek bir yanlış işlemde ödenir.

### S2 — İki katmanlı: yapılandırılabilir kapılar + yazılamaz sabit sınırlar
- Nasıl çalışır: izin kararı üç değerlidir (`ALLOW` / `BLOCK` / `HUMAN_REQUIRED`); çoğu kapı sözleşmeyle ayarlanır, ama bir sabit sınırlar kümesi **koddadır ve yapılandırmadan okunmaz**.
- Görüldüğü yer: LlamaFirewall'ın üç değerli karar tipi (`llamafirewall_data_types.py:22-25`); mcp-vet'in şiddet/güvenilirlik ayrı eksenleri (`mcp_vet/models.py:9-16`); A2A'nın protokol düzeyinde `AUTH_REQUIRED` durumu.
- Artı: otonomi ile güvenliği aynı anda verir; sabit sınır listesi kısa ve okunabilir kalır.
- Eksi: iki katman iki kavram demek; "bu neden ayarlanamıyor" sorusu her seferinde cevaplanmalı.
- Maliyet: sabit sınır listesinin bakımı ve bu listenin sözleşmede değil kodda yaşaması.

### S3 — Her şey sabit; hiçbir izin ayarlanamaz
- Artı: AP1 imkânsız.
- Eksi: sistem kullanılamaz — her dosya okuması onay isterse gece koşusu diye bir şey kalmaz.
- Maliyet: otonominin tamamı.

## Karar

**S2.** Dört somut kural:

**1. Sabit sınırlar yapılandırmadan okunmaz.** `--yes-always` karşılığı
**yazılamaz olmalı** — kapatan bir bayrak, ortam değişkeni veya sözleşme alanı
yoktur. Sabit sınırlar kümesi `CLAUDE.md`'de bugün yazılı olanla aynıdır ve
kısadır: kimlik bilgisi girme, kalıcı silme, para transferi, hesap açma, sistem
güvenlik ayarı değiştirme, dışarı açılan yayın/gönderim. Bu liste **koddadır**;
uzatılabilir, daraltılamaz.

**2. Karar üç değerlidir ve iki eksen ayrıdır.** `ALLOW` / `BLOCK` /
`HUMAN_REQUIRED`. "Kontrol edilmedi" ile "kontrol edildi, temiz" **ayrı
değerlerdir** (D11); şiddet ile güvenilirlik ayrı eksenlerdir ve tek bir "risk
skoru" alanı **olmaz** — iki bağımsız sinyali tek sayıya ezmek AP5'in
mekanizmasıdır. Hata yolu güvenli tarafa düşer: denetleyici çalışmazsa sonuç
`HUMAN_REQUIRED`'dır, `ALLOW` değil.

**3. Kapsam belirtilmemişse sonuç boş kümedir** (kural 7), "hepsi" değil.
Yazma/çalıştırma/ağ izni sözleşmede açıkça ve kapsamlı istenir (hangi yol,
hangi alan adı). Yıkıcı bir işlemde kapsamsızlık bir hatadır — sessizce
"hepsi"ne genişletilmez. Gerekçe AP6: etiketin yetki sanılması ve izolasyonun
varsayılanının "hepsi" olması.

**4. S5'in cevabı: uzatma noktaları izin sözleşmesinden muaf değildir.**
Yeni bir ajan, araç veya eklenti eklemek, izin kapsamını genişletmez. Somut
sonuç: `Tool Registry`'ye bir araç eklemek onu çağrılabilir yapmaz — çağrı
yine Permission Manager'dan geçer ve ilgili ajanın sözleşmesinde o araç
kapsamlı olarak istenmiş olmalıdır. D6 (genişleme = bir dosya + bir kayıt
satırı) ile D12 (varsayılan kapalı) arasındaki gerilim böyle çözülür:
**genişleme ucuzdur, yetki genişlemesi ucuz değildir.** Matrisin
genişletilebilirlik/güvenlik çelişkisi bilinçli olarak güvenlik tarafına
çözüldü.

**Sır ajana ulaşmaz.** Kimlik bilgisi ajanın bağlamına girmez; ajan yeteneği
ister ("şu depoya şu isteği yap"), sırrı Permission Manager enjekte eder.
Bu makinede hipervizör yolu kapalı (KVM yok, Windows) olduğu için mekanizma
proxy süreç veya ayrı kullanıcı hesabıdır — kararı Faz 3 "Security
Architecture" verir, bu ADR yalnızca **sırrın ajana ulaşmayacağını** sabitler.

**Bu ADR'nin kapsamadığı iki şey**, yol haritasının kendi maddesine bırakıldı:
izin verilen bileşenin sürümüne/içerik özetine bağlanması (02 §4/A1, §7 S7) ve
`permission.schema.json`'ın tam alan listesi → Faz 3 "Security Architecture".

## Dahil etme ölçütü (ADR-000 K2)

| | |
|---|---|
| Çözdüğü problem | Bir ajanın kendisine verilmiş geniş bir kimlik bilgisiyle amaçlanmayan bir hedefe erişmesi. Somut: bu makinede `gh` CLI tam yetkili ve bir PAT dolaşımda. |
| Önlediği hata | *Yetki sızması* ve *sessiz izin*; ve AP1'in kendisi — kapının tek bir bayrakla sıfırlanması. |
| Eklediği maliyet | Her araç çağrısı bir karar noktasından geçer (gecikme); sır enjeksiyon mekanizması yazma yükü; üçüncü değer her çağıran kodda ele alınmak zorunda; insan kapısına düşen çağrı arttıkça gece otonomisi azalır. Uzatma noktalarının muaf olmaması, eklenti yazmayı bir adım zorlaştırır. |
| Kanıt (≥2 olgun proje veya yaşadığımız arıza) | D12: 3 olgun bağımsız kaynak (A2A 5, MCP 5, microsandbox 3). D11: 4 kaynak, 2 iz. AP1: 5 iz, 9 kaynak — listenin en güçlü maddesi. Ve arıza tarafı: `BILINEN-TUZAKLAR.md` #14 (kimlik ezme push'u düşürdü), #20 (`git add -A` başkasının işini süpürdü) — ikisi de kapsamsız işlemin zararı. |

## Sonuçlar

**Olumlu:** Tek geçit olduğu için "bu çağrıya kim izin verdi" sorusunun tek bir
cevabı vardır. Sabit sınırlar yapılandırmayla aşınamaz. Eklenti ekosistemi
büyüdükçe saldırı yüzeyi otomatik büyümez.

**Olumsuz / kabul edilen bedel:** Gece otonomisi sınırlıdır ve bilerek
sınırlıdır (ADR-000'in ifadesiyle: "bu bir özellik"). Sandbox yokluğu nedeniyle
bu kapı **tek** savunmadır (`docs/mimari/00-BLUEPRINT.md` §4.4) — yani izin
kararındaki bir hatanın ikinci bir ağı yoktur. Bu, mimarinin bilinen en zayıf
noktasıdır ve kayıtlıdır.

**Etkilenen sözleşmeler:** `contracts/permission.schema.json` (Faz 3 Security
Architecture'da yazılacak) — üç değerli karar, ayrı şiddet/güvenilirlik
eksenleri, zorunlu kapsam alanı. `contracts/agent.schema.json` — `permissions`
alanı kapsamsız değer kabul etmez. `contracts/task.schema.json` —
`ONAY_BEKLIYOR` durumu (ADR-003).

**Etkilenen diğer ADR'ler:** ADR-002 (Permission Manager döngü tarafından
çağrılır, araç tarafından değil), ADR-003 (`ONAY_BEKLIYOR` kesintili durum),
ADR-004 (`DEGERLENDIRILMEDI` insan kapısına düşer).

## Uygulama notu

Faz 5'te `src/permission_manager/`; sabit sınırlar listesi tek bir modül
sabitidir ve hiçbir yapılandırma okuyucusu tarafından okunmaz.

Test edilebilir ölçüt: "sabit sınır listesindeki bir işlem, her yapılandırma
kombinasyonunda `HUMAN_REQUIRED` döndürüyor" ve "kapsam alanı boş bırakılmış
bir yazma izni isteği hata veriyor, boş kümeye değil `ALLOW`a da düşmüyor"
testleri geçiyorsa karar uygulanmıştır.
