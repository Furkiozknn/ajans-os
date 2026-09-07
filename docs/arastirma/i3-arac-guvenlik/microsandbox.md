# microsandbox

*Tohum listesinde olmayan aday (protokol §2 gereği).*

## Kimlik
microsandbox/microsandbox · 8.113 yıldız · 25 watcher · son push 2026-09-07 · Apache-2.0 · Rust · arşivlenmemiş
Klon HEAD: `e25cae3` (2026-09-04).
canlılık: geçti.
İnceleme kapsamı: `README.md` (yetenek ve API sözleşmesi), `crates/` ağacı (14 crate), `Cargo.toml`, SDK örnekleri (Python/JS/Ruby/Go). **Kapsam dışı (dürüstlük):** Rust crate'lerinin gövdeleri okunmadı — `crates/network/lib` ve `crates/runtime/lib` altındaki uygulama, vsock katmanı, `agentd`. Bütçe yetmedi. Aşağıdaki mimari iddialar **ilan edilen sözleşme ve crate sınırlarına** dayanıyor; izolasyonun doğru uygulandığı bu incelemede kanıtlanmadı, yalnızca **nerede uygulandığı** gösterildi.

**Neden bu proje seçildi.** `e2b.md` incelemesi dürüst bir boşlukla
bitmişti: E2B deposunda asıl izolasyon çalışma zamanı **yok** (Copybara
ile ayrı bir `infra` deposundan senkronize ediliyor), bu yüzden
"sandbox sınırı nedir" sorusu orada cevaplanamadı. microsandbox aynı
kategoride ama **izolasyon kodunu kendi deposunda tutuyor** — boşluğu
kapatan tamamlayıcı bir vaka.

## Çözdüğü problem
"Güvenilmeyen iş yükünü nerede çalıştırayım" sorusuna **yerel** cevap:
`README.md:15` "easy, fast, local microVMs for untrusted workloads",
`:28` hedef listesinde ilk sırada "AI agents". E2B'den ayrıştığı nokta
mimari değil **konum**: E2B bir bulut hizmetinin istemcisi, microsandbox
uygulamanın içine gömülen bir kütüphane — `README.md:37` "Spawn VMs right
within your code. No setup server. No long-running daemon."

Bizim için önemi: donanım kısıtı gereği buluta yönelen bir sistemde bile,
**izolasyon sınırının nerede olduğunu kod olarak görebildiğimiz** bir
referans.

## Mimari
İzolasyon iddiası donanım seviyesinde: `README.md:32` "Hardware-level
isolation with microVM technology", ve gereksinim açık —
`README.md:118` Linux'ta "KVM enabled". Yani sınır konteyner namespace'i
değil, hipervizör. (E2B'de bu cümlenin karşılığı depoda hiç yoktu.)

Crate ayrımı sınırın nerede çizildiğini gösteriyor:
```
crates/
  runtime/     ← microVM yaşam döngüsü
  network/     ← ağ politikası (allowed_hosts / allowed_ports)
  filesystem/  ← dosya sistemi sınırı
  vsock/       ← host ↔ VM kanalı (VM'in tek meşru çıkışı)
  agentd/      ← VM içi ajan süreci
  image/, db/, protocol/, metrics/, migration/, cli/, testing/, utils/
```
`vsock`'un ayrı bir crate olması anlamlı: misafir ile host arasındaki
tek iletişim kanalı adlandırılmış ve izole edilmiş.

## Ajan tasarımı
Ajan tanımı yok; sandbox tanımı var ve **makine-okur bir sözleşme**
biçiminde (`README.md:205-220`):

```ruby
Microsandbox::Sandbox.create("my-sandbox",
  image: "python", cpus: 1, memory: 512,
  network: { allowed_hosts: ["api.openai.com"], allowed_ports: [443] },
  secrets: [{ env: "OPENAI_API_KEY",
              value: ENV.fetch("OPENAI_API_KEY"),
              allowed_host: "api.openai.com" }])
```

Bu on satır, ADR-000 K6'nın iki maddesinin birebir uygulaması:
- **"ağ erişimi sözleşmede açıkça istenir ve kapsamlıdır (hangi alan
  adı)"** → `allowed_hosts` + `allowed_ports`, varsayılan kapalı.
- **kimlik bilgisinin kapsamlanması** → her sır **tek bir hedefe**
  bağlanıyor (`allowed_host: "api.openai.com"`). Sır, ortam
  değişkeni adıyla ilan ediliyor ama `README.md:38`'e göre
  "**Unexploitable secret keys that never enter the VM**" — yani değer
  VM'in içine hiç girmiyor; VM sırrı *kullanabiliyor* ama *okuyamıyor*.

Son madde bu izin en önemli tek bulgusu olabilir: **yetki ile sırrın
ayrılması.** Ajan "şu hedefe istek at" yetkisine sahip oluyor, sırrın
kendisine değil. Kod sızdırılsa bile anahtar sızmıyor.

## Orkestrasyon / iş akışı modeli
Yok — bu bir yürütme sınırı, bir orkestratör değil. `Sandbox.create` →
`exec` → `stop` üç adımlı yaşam döngüsü (`README.md:205-227`).

## Durum ve bellek
İncelenmedi (crate gövdeleri okunmadı). `crates/db` ve
`crates/migration`'ın varlığı kalıcı durum tutulduğunu gösteriyor ama
neyin saklandığı doğrulanmadı.

## Hata yönetimi
İncelenmedi. Retry/timeout/rollback davranışı hakkında iddiada
bulunulmuyor.

## Genişletilebilirlik
İncelenmedi. Crate sınırları temiz görünüyor (ağ, dosya sistemi, imaj
ayrı), ama eklenti mekanizması olup olmadığı doğrulanmadı.

## Güçlü yönler (kanıtlı)
- **İzolasyon mekanizması adlandırılmış ve deponun içinde**
  (`README.md:32`, `:118` KVM; `crates/runtime`, `crates/vsock`) — E2B'de
  eksik olan tam bu.
- **Ağ politikası sözleşmenin birinci sınıf alanı** (`README.md:211-214`)
  — "izin verilen hostlar" bir yapılandırma dosyasında değil, sandbox'ı
  oluşturan çağrının imzasında; varsayılan olarak kapalı.
- **Sır ↔ hedef bağı** (`README.md:216-219`) — bir sırrın hangi hedefe
  karşı kullanılabileceği sözleşmede yazılı; kapsamsız kimlik bilgisi
  ifade edilemiyor.
- **Sırrın VM'e hiç girmemesi** (`README.md:38`) — sızıntı yüzeyini
  yapısal olarak kaldırma; politika değil mimari çözüm.
- **Sunucu/daemon gerektirmemesi** (`README.md:37`) — güvenlik sınırının
  ayakta kalması için ayrıca yönetilmesi gereken bir bileşen yok.

## Zayıf yönler (kanıtlı)
- **KVM zorunlu** (`README.md:118`) — kullanıcının makinesi Windows 11;
  bu yol doğrudan kullanılamaz. WSL2 altında çalışabilirliği bu
  incelemede **doğrulanmadı**.
- **İddiaların kod düzeyinde doğrulanmaması (bu incelemenin sınırı).**
  "Secrets never enter the VM" güçlü bir güvenlik iddiası ve yalnızca
  README'de görüldü; `crates/` gövdeleri okunmadı. Protokolün
  "README pazarlamadır" kuralı gereği bu iddia **doğrulanmamış**
  sayılmalı. Bir sonraki turda doğrulanacak ilk şey bu olmalı.
- **Ekosistem olgunluğu belirsiz** — 8.113 yıldız var ama indirme,
  issue kapanma hızı ve üretim kullanımı ölçülmedi.

## Puan (1–5)
olgunluk **3** — aktif ve popüler, ama üretim kanıtı bu incelemede görülmedi ·
mimari netlik **4** — crate sınırları izolasyon sınırlarıyla örtüşüyor ·
genişletilebilirlik **—** incelenmedi ·
güvenilirlik **—** incelenmedi ·
ilkeller **4** — sandbox / ağ politikası / kapsamlı sır üçlüsü temiz ·
gözlemlenebilirlik **2** — `crates/metrics` var, içeriği incelenmedi ·
güvenlik duruşu **4** — donanım izolasyonu + varsayılan kapalı ağ + kapsamlı sır; tavan, iddiaların doğrulanmamış olması

*(İki puan bilerek boş — protokol §5: "İncelemeye bütçen yetmediyse
'incelenmedi' yaz." Matris üretilirken bu satır eksik alanla girer.)*

## ADR-000 K6 için kanıt
**Güçlendiriyor — ve K6'yı somutlaştıracak bir mekanizma öneriyor.**

K6 "yazma, çalıştırma ve ağ erişimi sözleşmede açıkça istenir ve
kapsamlıdır (hangi yol, hangi alan adı)" diyor. microsandbox'ın
`create` imzası (`README.md:211-219`) bunun çalışan bir uygulaması:
ağ hedefi ve port sözleşmede, sır ise **tek bir hedefe bağlı**.

Dahası, K6'da yazmayan bir ilkeyi ekliyor: **ajan bir sırra sahip
olmamalı, bir yeteneğe sahip olmalı** (`README.md:38`). Bu, A2A
incelemesinde bağımsız olarak ulaştığımız sonucun aynısı — A2A'da
in-band kimlik bilgisi zincirdeki her ajana açıldığı için kimlik
bilgisinin isteği başlatan ajana bağlanması öneriliyordu
(`a2a-spec.md` §K6 kanıtı, `specification.md:1961-1962`). İki bağımsız
proje, iki farklı katmanda (protokol / hipervizör), aynı sonuca varmış.

**Çürüten kanıt: yok.**

## Alınacak fikir
- **Sır ≠ yetki ayrımı** (`README.md:38`, `:216-219`) — bizim Permission
  Manager'ında ajan bir API anahtarını *almaz*; "şu hedefe şu isteği
  yap" yeteneğini alır, anahtarı kapı enjekte eder. Sabit sınırımız
  ("ajan şifre/kimlik bilgisi girmez") ile aynı yönde ve onu bir adım
  ileri taşıyor: ajan kimlik bilgisini *görmez* bile.
- **Sırrın kapsamının sözleşmede olması** (`allowed_host`,
  `README.md:218`) — `permission.schema.json`'da her kimlik bilgisi
  girdisi bir hedef kapsamı taşımalı; kapsamsız kimlik bilgisi şemaca
  ifade edilemez olmalı.
- **Varsayılan kapalı ağ + açık allowlist** (`README.md:211-214`) —
  K6'nın "varsayılan izin salt okuma" maddesinin ağ karşılığı; izin
  verilen host ve port çağrının imzasında, ayrı bir config dosyasında
  değil.
- **İzolasyon sınırının kod yapısında görünür olması**
  (`crates/{runtime,network,filesystem,vsock}`) — bizim mimarimizde de
  güvenlik sınırı bir modül sınırıyla çakışmalı; "sınır nerede"
  sorusunun cevabı klasör ağacından okunabilmeli.

## Alınmayacak
- **microVM'i şu aşamada bağımlılık olarak almak** — KVM zorunlu
  (`README.md:118`), kullanıcının makinesi Windows; ayrıca donanım
  kısıtı gereği yerel ağır çalıştırma zaten hedef değil. Fikri
  (kapsamlı sır + varsayılan kapalı ağ) alalım, çalışma zamanını değil.
- **README'deki güvenlik iddialarına doğrulamadan güvenmek** —
  protokol §1 "README pazarlamadır". "Secrets never enter the VM"
  mimarimizin bir varsayımı hâline gelecekse önce `crates/` içinde
  doğrulanmalı; bu incelemede yapılmadı.
- **İzolasyonu tek katman saymak** — hipervizör sınırı güçlü ama K6'nın
  izin katmanının yerine geçmez. Sandbox "ne yapabileceğini" sınırlar,
  Permission Manager "ne yapmasına izin verildiğini" karara bağlar;
  ikisi farklı sorular.
