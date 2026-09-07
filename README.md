# ajans-os

**Bir AI Agency Operating System.** Sıradan bir "ajan koleksiyonu" değil:
kullanıcı hedefini alan, parçalara ayıran, doğru uzman ajanları seçen,
paralel/sıralı çalıştıran, sonucu eleştirmen ajanlarla denetleyen,
hatayı yakalayıp toparlayan, her adımı izleyen ve kendi geçmişinden
öğrenen bir çekirdek.

> Durum: **Faz 1 — Araştırma.** Henüz çalışan kod yok; bilerek.
> Önce ekosistem araştırılır, sonra mimari sentezlenir, en son kod
> yazılır. Sırayı bozan proje, en iyi ihtimalle iyi bir klon olur.

## Neden var

Açık kaynak agent ekosistemi çok parçalı: biri orkestrasyonda iyi,
biri bellekte, biri sandboxing'de, biri gözlemlenebilirlikte. Hiçbiri
tek başına bir "işletim sistemi" değil ve çoğu tek bir LLM sağlayıcısına
ya da tek bir çerçeveye bağlı.

Bu proje o parçaları **kopyalamaz**: her alandaki en güçlü mimari fikri
kanıtıyla belirler, birbiriyle uyumlu olanları tek bir tasarımda
birleştirir, uyumsuz veya zararlı olanları gerekçesiyle dışarıda bırakır.

## Altı sütun

| Sütun | Kapsadığı yetenekler |
|---|---|
| **Anlama ve planlama** | hedef anlama, görev ayrıştırma, dinamik DAG, uzman ajan seçimi |
| **Yürütme** | paralel/sıralı orkestrasyon, kontrollü ajan-ajan iletişimi, araç kullanımı |
| **Güvenilirlik** | eleştirmen/değerlendirici ajanlar, hata tespiti, retry / fallback / checkpoint / rollback |
| **Bellek ve bağlam** | kısa/uzun süreli bellek, bağlam yönetimi, RAG, bilgi katmanı |
| **Güvenlik** | izin sistemi, izolasyon, hata sınırları, riskli işlemde insan onayı |
| **Gözlem ve öğrenme** | izleme, ölçme, maliyet/gecikme/model optimizasyonu, deneyimden öğrenme |

Her sütun, [ADR-000](docs/adr/ADR-000-program-ve-ilkeler.md)'daki
**dahil etme ölçütünü** geçmek zorunda: çözdüğü problem, önlediği hata,
eklediği maliyet ve kanıtı olmayan hiçbir bileşen mimariye girmez.

## Program

```
Faz 1  Araştırma        6 iz, her izde 6-10 proje, kanıtlı analiz
Faz 2  Karşılaştırma    matris, en iyi fikirler, anti-pattern'ler
Faz 3  Sentez           mimari blueprint + 7 alt mimari
Faz 4  Tasarım          klasör yapısı, çekirdek arayüzler, sözleşmeler
Faz 5  Uygulama         modül modül, her biri bağımsız test edilebilir
```

Araştırma nasıl yapılır: [docs/00-ARASTIRMA-PROTOKOLU.md](docs/00-ARASTIRMA-PROTOKOLU.md)
Kararlar ve gerekçeleri: [docs/adr/](docs/adr/)
Ajan sözleşmesi (makine-okur): [contracts/agent.schema.json](contracts/agent.schema.json)
Sıradaki işler: [YOL-HARITASI.md](YOL-HARITASI.md)

## Klasörler

| Klasör | Ne için |
|---|---|
| `docs/arastirma/<iz>/` | Proje başına analiz dosyaları + iz özeti |
| `docs/adr/` | Architecture Decision Record'lar — her kararın gerekçesi |
| `docs/mimari/` | Blueprint ve alt mimariler (Faz 3'te dolar) |
| `contracts/` | JSON Schema sözleşmeleri: ajan, görev, mesaj, izin |
| `src/` | Çekirdek (Faz 5'te dolar) |

## Dil

Belgeler Türkçe. Kod tanımlayıcıları ve sözleşme alan adları İngilizce —
sağlayıcı SDK'ları, protokoller (MCP, A2A) ve ekosistem İngilizce; ara
katmanda çeviri yapmak hata kaynağı. Gerekçe ADR-000'da.

## Lisans

MIT.
