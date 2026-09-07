# Yol haritası — ajans-os

Gece geliştirme döngüsünün yakıtı. `otomasyon\gelistirme-uret.ps1`
ilk işaretsiz maddeyi alır. **Sıra fazları zorlar:** bir sonraki fazın
maddesine, önceki fazın tüm maddeleri işaretlenmeden geçilmez. Bu
sıra ADR-000 K1'in kendisidir; bozma.

Her madde okunmadan önce: `docs/00-ARASTIRMA-PROTOKOLU.md` ve
`docs/adr/ADR-000-program-ve-ilkeler.md` okunur. Protokole uymayan
çıktı sentezde kullanılmaz.

**Devam edilebilirlik:** Bir madde bütçe yüzünden yarım kalırsa
kutucuk boş bırakılır, günlüğe "kaldığım yer" yazılır. Sonraki tur aynı
maddeyi alır; önce `docs/arastirma/<iz>/` altında zaten yazılmış
dosyalara bakar, incelenmiş projeyi **tekrar incelemez**, kaldığı
yerden sürer.

---

## Sırada

### Faz 1 — Araştırma (her iz bir madde)



- [ ] **İ4 Güvenilirlik araştırması** — Protokol İ4: değerlendirici /
      eleştirmen / gözden geçirici ajanlar, reflection & self-correction,
      arıza tespiti, retry / fallback / checkpoint / rollback. Özellikle:
      checkpoint durum modeli nasıl (immutable snapshot mı, event log
      mu), rollback gerçekten geri alıyor mu yoksa "yeniden dene" mi.
      Çıktı: `docs/arastirma/i4-guvenilirlik/`.

- [ ] **İ5 Gözlem ve ekonomi araştırması** — Protokol İ5: tracing
      (OpenTelemetry GenAI kuralları birincil kaynak), değerlendirme ve
      benchmark araçları, maliyet/gecikme optimizasyonu, model
      yönlendirme, üretim dağıtımı. Kullanıcının
      `model-comparison-harness` ve `nvidia-nim-mcp` fallback zinciri
      adaylar arasında. ADR-000 K4 model sınırı için kanıt topla. Çıktı:
      `docs/arastirma/i5-gozlem-ekonomi/`.

- [ ] **İ6 Otonom kodlama ve öğrenme araştırması** — Protokol İ6:
      otonom kodlama ajanları (OpenHands, SWE-agent, Aider, Cline,
      Claude Code'un alt-ajan modeli), self-learning / sürekli
      optimizasyon (DSPy, TextGrad). ADR-000 K7 için: insan kapısız
      kendini-değiştirmenin üretimde güvenle çalıştığı **tek bir** örnek
      var mı, açıkça ara ve yaz. Çıktı: `docs/arastirma/i6-kodlama-ogrenme/`.

### Faz 2 — Karşılaştırma

- [ ] **Architecture Comparison Matrix** — Matrisi **elle yazma**:
      `node arac/matris-uret.js` altı iz özetinden `docs/01-matris.json` ve
      `docs/01-KARSILASTIRMA-MATRISI.md`'yi üretir (protokol §6 biçimi,
      sütun istatistikleri dahil). Önce çalıştır; "Ayrıştırma uyarıları"
      bölümü boş değilse kaynak iz özetindeki tabloyu düzelt, yeniden üret.
      Sonra §6.4 yorumunu markdown'daki `<!-- YORUM -->` bloğuna yaz:
      sütun liderleri, boşluklar (örn. güvenlik sütunu tüm projelerde
      düşükse bu bizim fırsatımız), çelişkiler — her biri kanıt
      bağlantılı. Araç yeniden çalışınca yorum bloğu korunur.

- [ ] **Best ideas ve patterns** — Matris ve iz özetlerinden: birden çok
      projede **bağımsız** ortaya çıkan desenler (en güçlü sinyal), her
      desen için hangi projelerde, neden işe yaradığı, bize nereye
      oturduğu. ADR-000 K2 ölçütünü her desene uygula; geçemeyen "aday"
      listesine düşer. Çıktı: `docs/02-EN-IYI-FIKIRLER.md`.

- [ ] **Anti-patterns** — Birden çok projede soruna yol açmış seçimler;
      her biri için: belirti, kök neden, hangi projede nasıl göründü,
      bizde nasıl kaçınılır. Çıktı: `docs/03-ANTI-PATTERNLER.md`.

### Faz 3 — Mimari sentez

- [ ] **Architecture Blueprint** — Faz 2 çıktısından tek bir üst
      mimari: bileşenler (Orchestrator, Planner, Router, Agent Registry,
      Task Manager, Memory Manager, Context Manager, Tool Registry,
      Permission Manager, Evaluator, Critic, Recovery Manager,
      Observability, Cost Manager, Model Router, Knowledge Layer,
      Security/Guardrails, Learning Layer) — **her biri için** K2'nin
      dört maddesi yazılır; yazılamayan bileşen mimariye girmez.
      Bileşenler arası iletişim ve veri akışı diyagramı. Çıktı:
      `docs/mimari/00-BLUEPRINT.md` + `docs/adr/ADR-001..` (her büyük
      karar ayrı ADR, biçim `docs/adr/SABLON.md`; "Dahil etme ölçütü"
      tablosu dolmayan bileşen mimariye girmez).

- [ ] **Agent Architecture** — Sözleşme (`contracts/agent.schema.json`)
      temel alınır; araştırma bulgularıyla şema gözden geçirilir, eksik
      alan varsa ADR ile eklenir. Ajan yaşam döngüsü: kayıt → seçim →
      başlatma → yürütme → değerlendirme → arşiv. Çıktı:
      `docs/mimari/01-AJAN.md`, güncellenmiş şema, `contracts/ornek/`
      altında en az iki tam örnek sözleşme (biri mevcut
      `turkce-ajanlar/agents/kod-gozden-gecirici.md`'den türetilmiş).

- [ ] **Orchestration Architecture** — Planlayıcı (hedef → görev
      grafı), yönlendirici (görev → ajan), yürütücü (paralel/sıralı,
      checkpoint'li), ajan-ajan iletişim kuralları, konsensüs ne zaman
      gerekir ne zaman israf. Görev ve mesaj sözleşmeleri:
      `contracts/task.schema.json`, `contracts/message.schema.json`.
      Çıktı: `docs/mimari/02-ORKESTRASYON.md`.

- [ ] **Memory Architecture** — Katmanlar (task/session/project/global/
      knowledge), kim yazar kim okur, tutma süreleri, PII, RAG'in yeri,
      bağlam penceresi yönetimi. Çıktı: `docs/mimari/03-BELLEK.md`.

- [ ] **Evaluation Architecture** — Evaluator vs Critic ayrımı, rubrik/
      test/metrik/insan ölçütleri, hangi çıktı ne zaman hangi yolla
      değerlendirilir, geçme eşikleri, benchmark seti. Çıktı:
      `docs/mimari/04-DEGERLENDIRME.md`.

- [ ] **Security Architecture** — Permission Manager tasarımı, en az
      yetki, sandbox katmanları, insan kapısı kuralları (hangi işlemler,
      geçilemez), ajan kimliği, hata sınırları/izolasyon.
      `contracts/permission.schema.json`. **İ3 girdileri zorunlu okuma:**
      OZET §5 (şema alanları: şiddet ve güvenilirlik ayrı eksen,
      `ALLOW/BLOCK/HUMAN_REQUIRED`, "kontrol edilmedi" ≠ "temiz", onay kapsamı;
      kimlik bilgisi ajana ulaşmaz; denetleyici hatası güvenli tarafa düşer)
      ve §6 **K6'ya aday ek madde:** verilen izin bileşenin sürümüne/içerik
      özetine bağlanır, bileşen değişirse izin düşer — bu maddede ADR olarak
      karara bağlanır. Çıktı:
      `docs/mimari/05-GUVENLIK.md`.

- [ ] **Observability Architecture** — İz (trace) modeli (OTel GenAI
      uyumlu), hangi olaylar kaydedilir, maliyet/gecikme sayaçları, iz
      → değerlendirme → öğrenme akışının veri sözleşmesi. Çıktı:
      `docs/mimari/06-GOZLEM.md`.

- [ ] **Self-improvement Architecture** — ADR-000 K7 çerçevesinde:
      izlerden öneri üretme, öneri sözleşmesi, insan onay akışı,
      sürümleme ve geri alma, "sürüklenme" tespiti. Çıktı:
      `docs/mimari/07-KENDINI-GELISTIRME.md`.

### Faz 4 — Tasarım

- [ ] **Repository / folder structure ve core interfaces** — Faz 3'ten
      türeyen klasör yapısı; her çekirdek bileşen için arayüz tanımı
      (TypeScript `.d.ts` veya Python Protocol — dil kararı ADR ile).
      Modüller birbirinden bağımsız, her biri tek başına test edilebilir.
      Çıktı: `docs/mimari/08-YAPI-VE-ARAYUZLER.md` + `src/` iskeleti
      (yalnızca arayüzler, uygulama yok).

- [ ] **Implementation Roadmap** — Faz 5 için sıralı, birbirinden
      bağımsız modül maddeleri; her biri tek gece görevi büyüklüğünde,
      "bitti" ölçütü test. Bu maddeler **bu dosyanın Faz 5 bölümüne**
      yazılır. Çıktı: `docs/04-UYGULAMA-YOL-HARITASI.md` + aşağıdaki
      Faz 5 bölümünün doldurulması.

### Faz 5 — Uygulama

<!-- Faz 4'ün son maddesi burayı doldurur. Öncesinde buraya madde yazılmaz. -->

### Sürekli

- [ ] **Araştırma turu ve yol haritası yenileme** — Bu maddeye
      gelindiğinde: ekosistemde son 30 günde çıkan kayda değer projeleri
      ve Claude Code / MCP / A2A'daki değişiklikleri tara; ADR'lerden
      birini çürüten bulgu varsa ilgili ADR'yi "yeniden açıldı"
      işaretle ve gerekçeyi yaz; yeni maddeleri ilgili fazın sonuna
      ekle; sonra bu maddeyi işaretle ve **aynısını en sona tekrar
      ekle**. Döngü böyle sürer.

---

## Bitti

<!-- Tamamlanan maddeler tarihiyle buraya taşınır -->

- [x] **İ1 Orkestrasyon ve planlama araştırması** — Protokoldeki İ1
      izini uygula: multi-agent orchestration, routing, dinamik
      planlama, DAG/workflow, ajan-ajan iletişimi, uzman mimariler,
      konsensüs. 6–10 canlı proje; tohum listesi + en az iki listede
      olmayan aday. Her proje için `docs/arastirma/i1-orkestrasyon/<repo>.md`
      (şablon: protokol §3), sonra `OZET.md` (§4). Kullanıcının
      `ai-workflow-engine` deposu adaylardan biri — kayırmadan.
      Bitti sayılması için: en az 6 proje dosyası + OZET.md + her
      projede "Alınacak / Alınmayacak" dolu.
Tamamlandı: 2026-09-07 — 7 proje dosyası + OZET.md yazıldı.

- [x] **İ2 Bellek ve bağlam araştırması** — Protokol İ2: bellek
      katmanları, uzun süreli bellek, bağlam yönetimi, RAG, bilgi
      katmanı. Özellikle şuna bak: bellek yazma kimin yetkisinde, PII
      nasıl ele alınıyor, bağlam penceresi dolunca ne oluyor. Çıktı:
      `docs/arastirma/i2-bellek/`. Aynı bitti ölçütü.

Tamamlandı: 2026-09-07 — 7 proje dosyası + OZET.md yazıldı (letta, mem0,
graphiti, cognee, graphrag, llamaindex, LightRAG).

- [x] **İ3 Araçlar ve güvenlik sınırı araştırması** — Protokol İ3:
      MCP ve A2A spesifikasyonlarını **birincil kaynaktan** oku (repo
      README değil, spec belgesi), araç izin modelleri, sandboxing
      (E2B/Daytona), guardrails, ajan kimliği/güven, insan-onay
      kapıları. Kullanıcının `mcp-vet` aracı adaylardan biri. ADR-000
      K6'yı çürüten veya güçlendiren kanıtı açıkça ara. Çıktı:
      `docs/arastirma/i3-arac-guvenlik/`.

Tamamlandı: 2026-09-07 — 7 kaynak dosyası + OZET.md yazıldı (mcp-spec,
a2a-spec, e2b, microsandbox, llamafirewall, mcp-scan, mcp-vet). ADR-000 K6:
çürüten kanıt bulunamadı, güçlendi; eksik bir madde Faz 3'e not düşüldü.
