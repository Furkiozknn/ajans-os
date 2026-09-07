# ADR-000 — Program ve ilkeler

**Durum:** Kabul edildi · **Tarih:** 2026-09-07 · **Yeniden açılır:** Faz 1
bulguları herhangi bir kararı çürütürse, ilgili ADR ile değiştirilir.

## Bağlam

Açık kaynak agent ekosistemi hızlı ve parçalı. Her hafta yeni çerçeve
çıkıyor; çoğu ya tek sağlayıcıya bağımlı, ya orkestrasyon dışında bir
şey çözmüyor, ya da "her şeyi ekle" yaklaşımıyla şişmiş. Bu programın
amacı bir tane daha çerçeve yazmak değil; ekosistemdeki en iyi mimari
fikirleri kanıtla seçip, birbiriyle uyumlu olanları tek bir işletim
sistemi tasarımında birleştirmek.

Bu ADR, tek tek bileşen kararlarından **önce** gelen çerçeve kararlarını
kaydeder. Bileşen kararları (orkestratör modeli, bellek katmanları,
izin modeli vb.) Faz 3'te ayrı ADR'lerle verilir.

## Kararlar

### K1 — Sıra: Araştırma → Karşılaştırma → Sentez → Tasarım → Uygulama

Kod, ADR serisi tamamlanmadan yazılmaz. Gerekçe: mimari kararlar kod
yazıldıktan sonra verilirse kod mimariyi belirler, tersi değil. İstisna:
sözleşme şemaları (K3) — bunlar tasarımın kendisidir, kod değil.

### K2 — Dahil etme ölçütü ("her şeyi ekle" yasağı)

Bir bileşen veya özellik mimariye ancak şu dördü yazılıysa girer:

1. **Çözdüğü problem** — somut, örnekli.
2. **Önlediği hata** — hangi arıza sınıfını engelliyor.
3. **Eklediği maliyet** — karmaşıklık, gecikme, token, bakım.
4. **Kanıt** — en az iki olgun projede bağımsız olarak ortaya çıkmış
   *veya* bizim bizzat yaşadığımız bir arızayı çözüyor.

Dördünden biri boşsa bileşen "aday" listesinde bekler, mimariye girmez.
Gerekçe: özellik sayısı kalite değildir; her bileşen bir arıza yüzeyidir.

### K3 — Önce sözleşmeler

Her ajan, görev, mesaj ve izin **makine-okur bir sözleşmeyle** tanımlanır
(JSON Schema). Orkestratör, kayıt defteri, değerlendirici — hepsi bu
sözleşmeler üzerinden konuşur, birbirinin iç yapısını bilmez.

İlk sözleşme `contracts/agent.schema.json`'dır ve şu alanları
zorunlu kılar: identity, role, mission, capabilities, inputs, outputs,
tools, permissions, dependencies, workflow, success_criteria,
failure_modes, recovery_strategy, evaluation_criteria, memory_scope,
communication_protocol.

Gerekçe: sözleşmesi olmayan ajan test edilemez, yönlendirilemez,
değerlendirilemez. Bugünkü çoğu koleksiyonun temel eksiği bu — ajan bir
prompt'tan ibaret, makinenin okuyacağı hiçbir şey yok.

### K4 — Sağlayıcıdan bağımsızlık: ince bir model sınırı

Sistem hiçbir LLM sağlayıcısına doğrudan bağlanmaz. Tek bir
**Model Router** sınırı vardır; tüm çağrılar oradan geçer. Router,
sözleşmedeki `dependencies.models` tercihlerine, maliyet/gecikme
politikasına ve sağlayıcı sağlığına göre seçer.

Uygulama ayrıntısı (LiteLLM, kendi yazdığımız katman vb.) Faz 3 kararı.
Şimdilik yalnızca **sınırın varlığı** karardır. Gerekçe: sağlayıcı
kilidi, bugün ekosistemin en pahalı hatası.

### K5 — Hata sınırları birinci sınıf vatandaş

Her bileşen sözleşmesinde `failure_modes` ve `recovery_strategy`
zorunlu. "Hata olursa bakarız" kabul edilmez. Retry, fallback,
checkpoint ve rollback çekirdeğin parçasıdır, sonradan eklenen bir
kütüphane değil.

Gerekçe: 6–7 Eylül gecesi kendi döngümüzde beş görev bütçe duvarına
toslayıp yarıda kesildi ve kendini "bitti" işaretledi. Toparlanma
mekanizması olmayan otonom sistem, hata üretir ve hatayı gizler.

### K6 — Güvenlik varsayılanı: en az yetki + insan kapısı

- Her araç çağrısı **Permission Manager**'dan geçer; ajan doğrudan araç
  çağıramaz.
- Varsayılan izin: salt okuma. Yazma, çalıştırma ve ağ erişimi
  sözleşmede açıkça istenir ve kapsamlıdır (hangi yol, hangi alan adı).
- Geri alınamaz veya dışarı açılan işlemler (silme, gönderme, yayın,
  ödeme, hesap ayarı) **her zaman** insan onayı kapısından geçer.
  Hiçbir yapılandırma bunu kapatamaz.
- Ajanlar birbirinin izinlerini devralmaz; her ajanın kendi sınırı var.

Gerekçe: otonom sistemde en tehlikeli hata, iyi niyetli ajanın geniş
yetkiyle yanlış şeyi hızlıca yapmasıdır.

### K7 — Kendini geliştirme kanıta dayalı ve kapılıdır

Öğrenme döngüsü: izler (traces) → değerlendirme → **öneri** → insan
onayı → uygulama. Sistem kendi prompt'unu, ajan sözleşmesini veya
yönlendirme politikasını **kendiliğinden değiştirmez**; değişiklik önerir,
kanıtını sunar, onay bekler. Onaylanan değişiklik sürümlenir ve geri
alınabilir.

Gerekçe: gözetimsiz kendini-değiştirme, ölçülemeyen sürüklenme üretir.
Kendi döngümüzde bunu gördük — ajan kendi ajanını düzeltti ama düzeltmeyi
yeniden test edemedi.

### K8 — Claude Code ilk ev sahibi, tek ev sahibi değil

Ajanlar sözleşme olarak tanımlanır; Claude Code alt-ajan biçimi
(`.claude/agents/*.md` frontmatter) bu sözleşmeden **türetilir**, tersi
değil. Aynı sözleşmeden başka ev sahipleri (Cursor, Codex, doğrudan API)
için de biçim üretilebilir.

Gerekçe: bugünkü `turkce-ajanlar` yalnızca Claude Code'da çalışıyor;
ekosistemin en büyük koleksiyonu çoklu ev sahibi destekliyor. Kaynak
sözleşme olursa ev sahibi bir çıktı biçimidir.

### K9 — Dil politikası

Belgeler, ADR'ler, raporlar, yorumlar: **Türkçe.** Kod tanımlayıcıları,
sözleşme alan adları, protokol terimleri: **İngilizce.** Gerekçe:
sağlayıcı SDK'ları, MCP/A2A spesifikasyonları ve ekosistem İngilizce;
`permissions` alanını `izinler` diye çevirmek her entegrasyonda bir
eşleme katmanı ve bir hata kaynağı ekler. Türkçe olan şey *düşünce ve
açıklama*, İngilizce olan şey *makinenin okuduğu*.

### K10 — Kanıt kuralı her yerde

Araştırmada dosya yolu/URL, mimaride ADR referansı, uygulamada test.
Kanıtı olmayan iddia belgeye girmez. Kullanıcının kendi depoları da
aynı rubrikle değerlendirilir, kayırılmaz.

## Sonuçlar

**Olumlu:** Kod yazmaya geç başlanır ama yazılan kod mimariye uyar.
Her bileşenin varlık gerekçesi kayıtlıdır; "bu neden var?" sorusunun
cevabı hep bir ADR'dir. Sağlayıcı ve ev sahibi değişimi çekirdeği bozmaz.

**Olumsuz / kabul edilen bedel:** İlk çalışan demo haftalar alır.
Sözleşme disiplini başta ağır gelir. K6 ve K7'nin insan kapıları,
tam otonom çalışmayı bilerek sınırlar — bu bir özellik.

**Riskler:** Araştırma fazı sonsuza uzayabilir → her iz tek gece
göreviyle sınırlı, Faz 2'ye geçiş yol haritasında sabit. Sentez
"her şeyden biraz" olabilir → K2 ölçütü her bileşene uygulanır,
geçemeyen dışarıda kalır.

## Bu ADR'yi değiştirebilecek bulgular

Faz 1'de şunlardan biri kanıtlanırsa ilgili karar yeniden açılır:

- Olgun projelerin çoğunluğu sözleşmesiz çalışıp daha iyi sonuç
  alıyorsa → K3
- Model sınırı belirli bir sağlayıcı özelliğini (ör. yerel araç
  çağırma biçimi) kaybettiriyor ve bu kayıp kabul edilemezse → K4
- İnsan kapısız kendini-geliştirme üretimde güvenle çalışan bir örnek
  bulunursa → K7

Araştırmacı bu maddeleri açıkça arar ve bulgusunu iz özetine yazar.
