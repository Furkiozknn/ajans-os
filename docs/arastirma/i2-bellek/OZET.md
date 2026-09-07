# İ2 — Bellek ve bağlam: iz özeti

Protokol `docs/00-ARASTIRMA-PROTOKOLU.md` §4 biçimi. Bu izde yedi proje
kod okunarak incelendi; her iddia ilgili proje dosyasındaki dosya yolu +
satır numarasına bağlıdır.

---

## 1. İncelenen projeler

| Proje | Yıldız | Son push | Lisans | Canlılık | Olg. | Mim. | Gen. | Güv.ilk. | Gözl. | Güvenlik | Dosya |
|---|---|---|---|---|---|---|---|---|---|---|---|
| letta-ai/letta (MemGPT) | 24.638 | 2026-08-23 | Apache-2.0 | geçti* | 4 | 3 | 3 | 4 | 4 | 2 | [letta.md](letta.md) |
| mem0ai/mem0 | 64.820 | 2026-09-04 | Apache-2.0 | geçti | 4 | 3 | 4 | 3 | 3 | 2 | [mem0.md](mem0.md) |
| getzep/graphiti | 30.648 | 2026-09-06 | Apache-2.0 | geçti | 4 | 4 | 3 | 3 | 3 | 2 | [graphiti.md](graphiti.md) |
| topoteretes/cognee | 30.542 | 2026-09-06 | Apache-2.0 | geçti | 4 | 4 | 4 | 3 | 4 | 3 | [cognee.md](cognee.md) |
| microsoft/graphrag | 35.862 | 2026-09-07 | MIT | geçti | 4 | 4 | 5 | 3 | 4 | 2 | [graphrag.md](graphrag.md) |
| run-llama/llama_index | 52.045 | 2026-09-05 | MIT | geçti | 4 | 4 | 4 | 2 | 2 | 2 | [llamaindex.md](llamaindex.md) |
| HKUDS/LightRAG | 39.452 | 2026-09-07 | MIT | geçti | 4 | 3 | 4 | 4 | 3 | 2 | [lightrag.md](lightrag.md) |

\* Letta "geçti" ama uyarılı: GitHub'daki `main` dalı fiilen boşaltılmış
(12 idari dosya), kaynak kod `archive` dalında. Analiz `origin/archive`
üzerinden yapıldı — ayrıntı `letta.md` §Kimlik.

Tohum listesinde (protokol §2) **olmayan** adaylar: **graphiti**,
**graphrag**, **LightRAG** — üç tane, kural iki istiyordu.

Matris cevapları:

| Proje | saglayici_bagimsiz | sozlesme_var | insan_kapisi | checkpoint |
|---|---|---|---|---|
| letta | evet | evet | kısmen | evet |
| mem0 | evet | kısmen | hayır | hayır |
| graphiti | evet | evet | kısmen | evet |
| cognee | evet | evet | hayır | kısmen |
| graphrag | evet | kısmen | hayır | kısmen |
| llamaindex | kısmen | kısmen | hayır | kısmen |
| LightRAG | evet | kısmen | kısmen | evet |

---

## 2. Yinelenen desenler (birden çok projede bağımsız ortaya çıktı)

**D1 — Ham konuşma kalıcı bellek değildir; kalıcı olan türetilmiş kayıttır.**
Yedi projenin yedisi de aynı ayrımı yapıyor: sohbet akışı bir yerde
(SQL/KV), *bellek* başka bir yerde (vektör/graf). mem0 konuşmadan olgu
çıkarıp yalnızca onu saklar ve ham mesajın yalnızca son 10'unu tutar
(`storage.py:279-292`); LightRAG belgeden varlık/ilişki çıkarır; cognee
`DataPoint` üretir; graphiti "episode"dan `EntityEdge` türetir. Ham veri
ile türetilmiş bellek arasındaki köprü her yerde **kaynak referansı**
(`source_id`, `attributed_to`, `reference_id`). En güçlü sinyal bu.

**D2 — Yazma kararını LLM verir, doğrulama kod tarafındadır.**
Yedi projenin hepsinde "neyin hatırlanacağına" bir LLM çağrısı karar
veriyor. Hiçbirinde yazma öncesi insan onayı yok. Kod tarafındaki
korumalar hep aynı üç kalıba düşüyor: (a) şema/JSON doğrulama, (b) hash
veya deterministik id ile idempotency (cognee `id_for()`, mem0 md5),
(c) LLM'e kısa yerel id verip halüsinasyonu kesme (mem0 UUID→tamsayı
`main.py:933-938`; graphrag ve LightRAG'de aynı fikir farklı biçimde).

**D3 — Token bütçesi, adet sınırından üstündür ve ayrıştırılarak dağıtılır.**
Bağlamı ciddiye alan üç proje aynı çözümü bağımsız buldu: toplam bütçeyi
bileşenlere böl, her bileşeni kendi payı içinde kırp.
- graphrag: `max_context_tokens=8000`, `community_prop`/`local_prop`/
  `text_unit_prop` oranlarıyla alt bütçeler (`mixed_context.py:175-208`).
- LightRAG: `max_total_tokens` − (sistem promptu + graf + sorgu + 200
  tampon) = metin parçalarına kalan (`operate.py:5864`); ayrıca
  `max_entity_tokens`/`max_relation_tokens` alt bütçeleri.
- LlamaIndex: `token_limit` × `chat_history_token_ratio` (0.7) kısa
  süreli kuyruğa, kalanı bloklara (`memory.py:205-216`).
Buna karşı cognee ve mem0 yalnızca **adet** sınırı (`top_k`) kullanıyor
ve ikisinde de token sayan tek satır yok — aynı sistemde iki farklı
olgunluk seviyesi.

**D4 — Bağlam dolunca cevap "sıkıştır ve tahliye et", "sil" değil.**
Letta: `ContextWindowExceededError` yakalanır, kesim noktası bulunur,
kesilen kısım ayrı ve **daha ucuz** bir özetleyici modelle özetlenir,
ham mesajlar DB'de kalır — bağlamdan tahliye, diskten silme değil
(`letta_agent_v3.py:1218`). LlamaIndex: eşiği aşınca en eskiden
`token_flush_size` kadar tahliye, tahliye edilen bloklara akar.
LightRAG: bir varlığın açıklamaları şişince map-reduce özetleme
(`operate.py:373-470`). graphrag: bütçeye sığmayan community'ler ayrı
batch'lere bölünüp map-reduce ile ayrı ayrı sorgulanır. Dört farklı
proje, tek fikir: **taşma bir hata değil, planlanmış bir faz geçişidir.**

**D5 — Tetikleme eşiği %100'ün altındadır ve güvenlik payı vardır.**
Letta `SUMMARIZATION_TRIGGER_MULTIPLIER = 0.9` ve yaklaşık sayaç
kullanırken `%30` pay ekler (`APPROX_TOKEN_SAFETY_MARGIN = 1.3`);
LlamaIndex 0.7 oranı; LightRAG 200 token sabit tampon. Hiçbiri
"pencere dolduğunda" değil, "dolmadan önce" davranıyor.

**D6 — Silme bir işaret, bir tombstone'dur; gerçek silme nadirdir.**
graphiti çelişen kenarı silmez, `invalid_at`/`expired_at` alanlarını set
eder (`edge_operations.py:538-573`) — bu bilinçli ve iyi. mem0 sildiği
anının **metnini** `history.old_memory` içinde bırakır
(`main.py:2113-2122`) ve `expiration_date` yalnızca görünürlük
filtresidir (`main.py:442`) — bu bilinçsiz ve kötü. Aynı desen, biri
zamansal doğruluk için, diğeri farkında olmadan uyum riski üretiyor.

**D7 — Depolama arkası çoklu, çekirdek algoritma tekil.**
Yedi projenin hepsinde vektör/graf/KV için adapter ailesi ve fabrika var
(LightRAG 14 uygulama, cognee 6 graf + 3 vektör, mem0 ~20 vektör).
Sağlayıcı bağımsızlığı bu ekosistemde çözülmüş bir problem; ADR-000
K3/K4 için olumlu kanıt.

---

## 3. Ayrışan yaklaşımlar (aynı problem, farklı cevap)

**A1 — Çelişen bilgi ne olacak?** Üç farklı cevap:
- **Zamansal geçersizleştirme (graphiti):** yeni fact eskisiyle çelişiyorsa
  eskinin `invalid_at`'i işaretlenir, kayıt kalır; "T anındaki durum"
  sorgulanabilir. En pahalı, en doğru.
- **Üzerine yazma (letta, klasik MemGPT çekirdek bellek):** ajan kendi
  bellek bloğunu araçla düzenler; eski hâl geçmişte kalır.
- **Yan yana yaşatma (mem0 v2):** append-only; "Ali vegan" ve "Ali et
  yiyor" ikisi de saklanır, hangisinin geçerli olduğu okuma anında
  çözülmez (`prompts.py:472`). En ucuz, en riskli.
Koşul: geçmişe dönük sorgu veya denetim gerekiyorsa A1-zamansal; yalnızca
"şu anki doğru" gerekiyorsa üzerine yazma yeterli. Otonom karar veren bir
sistemde append-only kabul edilemez.

**A2 — Bellek katmanları var mı?** Letta açık katman modeli kurar (çekirdek
bellek / arşiv / recall, ajanın araçlarla eriştiği); mem0 tek düz liste +
üç etiket (`user_id`/`agent_id`/`run_id`) kullanır, hiyerarşi yoktur;
LightRAG ve graphrag'de kullanıcı/oturum kavramı bile yoktur, yalıtım
süreç düzeyinde bir `workspace` alanıdır (`lightrag.py:418`). Katman
modeli ajan-merkezli projelerde, düz model belge-merkezli projelerde.

**A3 — Bilgi katmanı graf mı, vektör mü?** graphiti/cognee/LightRAG/graphrag
graf kurar (ilişkisel sorgular için); mem0 v2 grafı OSS'ten **çıkarmış**
(v1'deki `graph_memory.py` bu sürümde yok) ve yerine `linked_memory_ids`
taşıyan düz bir varlık koleksiyonu koymuş. Graf, ilişki sorularını
çözer ama yazma maliyetini ve LLM çağrı sayısını artırır; mem0'ın geri
çekilmesi bu maliyetin gerçek olduğunun kanıtı.

**A4 — İnsan nerede devreye girer?** LightRAG post-hoc düzeltme yüzeyi
sunar (`utils_graph.py`: create/edit/delete/merge entity+relation) ve
elle eklenen veriyi kanıt saymayarak ağırlığını düşürür
(`constants.py:51-54`). graphiti kısmi (kenar geçersizleştirme elle
yapılabilir). mem0, cognee, graphrag, llamaindex'te insan yüzeyi yok.
Hiçbirinde **yazma öncesi** kapı yok — bu bir boşluk, aşağıda §5.

---

## 4. Anti-pattern'ler (birden çok projede soruna yol açmış)

**AP1 — Token bütçesiz bağlam birleştirme.** cognee `resolve_edges_to_text`
kenarları tek metne yığar, kırpma yok (`resolve_edges_to_text.py:61-97`);
mem0 proxy dönen bütün anıları son kullanıcı mesajına yapıştırır
(`proxy/main.py:176-186`). İkisinde de tek koruma çağıranın `top_k`
seçimi. Belirti: veri büyüdükçe sessiz bağlam taşması veya sessiz
kalite düşüşü.

**AP2 — Görünürlük filtresini saklama süresi sanmak.** mem0
`expiration_date` süresi dolan anıyı yalnızca sonuçlardan gizler
(`main.py:442`), `show_expired=True` ile geri gelir. "TTL var" denilebilir
ama uyum (compliance) anlamında yoktur. Aynı hata `delete()`'in
metni geçmişte bırakmasında tekrarlanıyor.

**AP3 — Scope'u yetki sınırı sanmak.** mem0 REST katmanında doğrulanmış
kimlik ile gövdedeki `user_id` karşılaştırılmıyor (`server/main.py:368-375`);
LightRAG varsayılan kurulumda guest moduna düşüp varsayılan JWT gizli
anahtarını kullanıyor (`api/auth.py:57-63`). Etiket ≠ yetki.

**AP4 — Ölü kalmış eski mimarinin belgede yaşamaya devam etmesi.** mem0'ın
en çok bilinen özelliği (LLM'in ADD/UPDATE/DELETE'e karar vermesi) v2'de
çağrılmayan koda dönüşmüş (`prompts.py:176`, `prompts.py:406`) ama anlatı
sürüyor. Protokolün "README'ye güvenme" kuralının en somut örneği; her
proje dosyasında sürüm numarası ve çağrı zincirinin doğrulanması şart.

**AP5 — Sync/async kodun elle ikizlenmesi.** mem0 aynı 8 fazlı boru
hattını `main.py:879` ve `main.py:2533`'te iki kez yazmış. Bakım
maliyeti ve davranış kayması riski.

**AP6 — Geri döndürülemez sıkıştırma.** LightRAG özetleme sırasında
orijinal açıklamaları LLM özetiyle **değiştirir**; özet yanlışsa graf
tarafında geri dönüş yok. Letta'nın yaklaşımı doğru olan: özet eklenir,
ham mesaj DB'de kalır.

**AP7 — Varsayılan açık, satıcıya giden telemetri.** mem0
`MEM0_TELEMETRY` varsayılan `True`, gömülü PostHog anahtarı
(`telemetry.py:14-16`). Yerel çalışan bir ajan sisteminde kabul edilemez.

---

## 5. Bizim için öneri

**Ö1 — Context Manager'ın çekirdeği "bütçe dağıtımı" olmalı, "top_k" değil.**
LightRAG'in formülü doğrudan alınabilir: `kalan = toplam − (sistem
sözleşmesi + görev durumu + bilgi + sorgu + tampon)`, kalan geri
getirmeye verilir (`operate.py:5864`). Bütçe, **gerçekten render
edilecek şablonla** ölçülmeli (`operate.py:5802-5813`) — tahmini
şablonla ölçmek sessizce yanlış hesaplar. Taşmada kısılma sırası
önceden yazılır: sistem sözleşmesi > görev durumu > bilgi katmanı >
geçmiş. (Kanıt: D3, AP1.)

**Ö2 — Taşma bir hata değil, bir faz geçişi olarak modellenmeli; eşik
%100'ün altında olmalı.** Letta'nın modeli alınacak: eşik aşılınca
kesim noktası bul, kesilen kısmı **daha ucuz bir modelle** özetle, özeti
bağlama koy, ham kaydı sakla (`letta_agent_v3.py:1218`). Sıkıştırma
kayıplı olabilir ama **kaynak kayıt korunmalı** — LightRAG'in yaptığı
gibi orijinali atmamalı (AP6). Yaklaşık token sayımı kullanılacaksa
Letta'nın %30 güvenlik payı örnek alınmalı. (Kanıt: D4, D5.)

**Ö3 — Bellek yazma yetkisi üç sınıfa ayrılmalı, üçü de aynı kapıdan
geçmeli.** İncelenen hiçbir projede yazma öncesi kapı yok (D2) — bu
bizim için bir boşluk ve fırsat. Öneri: (a) **deterministik yazma** —
görev tamamlandı, onay verildi gibi olaylar LLM'e sorulmadan yazılır
(mem0'ın `infer=False` yolu, `main.py:879`); (b) **çıkarımsal yazma** —
LLM önerir, şema doğrulaması ve idempotency kontrolünden geçer;
(c) **kalıcı/paylaşılan katmana yazma** — insan onayı gerekir. Kaynak
her kayıtta saklanır ve güven ağırlığına yansır (LightRAG'in
`manual_creation` kanıt saymama kuralı, `constants.py:51-54`).

**Ö4 — Çelişki çözümü mimarinin parçası olmalı; append-only yasak.**
graphiti'nin bi-temporal modeli (`valid_at`/`invalid_at` olay zamanı,
`created_at`/`expired_at` sistem zamanı, `edges.py:271-282`) alınmalı;
en azından her bellek kaydında "hangi kaydı geçersiz kılıyor" alanı ve
okuma anında geçerli olanın seçilmesi zorunlu. Uyarı: graphiti'de bile
varsayılan `search()` filtre uygulamıyor ve geçersiz kılınmış fact'leri
de döndürüyor — bizde varsayılan **güvenli taraf** (yalnızca geçerli)
olmalı, geniş sorgu açıkça istenmeli. (Kanıt: A1, D6.)

**Ö5 — Silme gerçekten silmeli; saklama süresi gerçek bir iş
tetiklemeli.** mem0'ın iki hatası (silinen metnin geçmişte kalması,
TTL'in yalnızca filtre olması) tekrarlanmamalı. Denetim kaydı içerik
değil **içerik hash'i + kaynak referansı** tutmalı; böylece "bu bilgi
belleğe nasıl girdi" cevaplanabilir kalırken "sil" gerçekten siler.
PII konusunda incelenen yedi projenin **hiçbirinde** içerik düzeyinde
tespit/maskeleme yok — bu bir ekosistem boşluğu, bizde Memory Manager
ile Permission Manager arasında ayrı bir karar noktası olmalı.
(Kanıt: AP2, §6 S3.)

---

## 6. Açık sorular (sentezde karar verilecek)

**S1 — Bilgi katmanı graf mı olacak?** Graf ilişki sorularını çözüyor ama
yazma başına birden çok LLM çağrısı getiriyor; mem0'ın v2'de grafı
OSS'ten çıkarması bu maliyetin gerçek olduğunu gösteriyor (A3). Karar
ADR-000 K2 ölçütüyle verilmeli: graf olmadan çözülemeyen somut bir
kullanım senaryomuz var mı?

**S2 — Bellek katmanları kaç tane ve sınırları ne?** Yol haritası
task/session/project/global/knowledge diyor. Letta'nın ajan-merkezli
katmanları ile LightRAG'in belge-merkezli düz modeli farklı problemleri
çözüyor (A2). Hangi katmana kimin yazabileceği Ö3 ile birlikte
kararlaştırılmalı.

**S3 — PII'yi nerede yakalayacağız?** İncelenen yedi projede içerik
düzeyinde PII kontrolü **yok**; mem0'ın çıkarım promptu kendini
"Personal Information Organizer" olarak tanımlıyor (`prompts.py:15`).
Kopyalanacak bir örnek yok; tasarımı sıfırdan yapacağız. Soru: yazma
anında sınıflandırma mı (pahalı, her yazmada), yoksa katman politikası
mı (ucuz: "bu katmana kişisel veri yazılamaz" kuralı ve şema
zorlaması)?

**S4 — Yaklaşık token sayımı yeterli mi?** Gerçek tokenizer her sağlayıcı
için farklı; Letta yaklaşık sayaç + %30 pay kullanıyor, LlamaIndex
medya blokları için sabit tahminler (`image_token_size_estimate=256`)
kullanıyor. Sağlayıcı bağımsız kalmak istiyorsak (ADR-000 K3) kesin
sayım her sağlayıcı için ayrı bağımlılık demek. Pay oranına karar
verilmeli.

**S5 — Bellek yazımı senkron mu asenkron mu?** mem0 proxy'de yazma arka
plana atılıyor (`_async_add_to_memory`), LightRAG'de ayrı bir boru hattı
ve durum makinesi var. Asenkron yazma gecikmeyi düşürür ama "az önce
söylediğimi hatırlamıyor" tutarlılık sorunu üretir. Orkestrasyon
mimarisiyle (Faz 3) birlikte karar verilmeli.

---

## 7. Dürüstlük notları

- Yedi projenin **haftalık PyPI indirme** sayısı hiçbirinde
  doğrulanmadı; PyPI'ye erişilmedi. Yıldız ve son push GitHub API'den
  ölçüldü (7 Eylül 2026).
- Letta analizi `main` değil `origin/archive` dalı üzerinden yapıldı
  (main boşaltılmış); bu, projenin canlılığı hakkında bu özetin
  cevaplayamadığı bir soru bırakıyor.
- LlamaIndex sparse checkout ile incelendi; `workflows/`, `agent/`,
  `llms/` ve entegrasyon paketleri **kasıtlı olarak kapsam dışı**
  bırakıldı — o alanlar hakkında "yok" değil, "bakılmadı" demek doğru.
- Tohum listesindeki **mem0 dışındaki** iki aday (Zep hosted ürünü,
  Haystack) incelenmedi: Zep'in açık kaynak çekirdeği zaten graphiti
  olduğu için ayrı dosya açılmadı; Haystack bütçe nedeniyle sıraya
  girmedi. İkisi de "incelenmedi" olarak kalır, README'den özet
  uydurulmadı.
- Anthropic bağlam yönetimi belgeleri (tohum listesinde) bu turda
  okunmadı — kod okunamayan kaynak olduğu için protokol §3 şablonuna
  oturmuyor; İ5 veya sentez aşamasında birincil kaynak olarak ayrıca
  ele alınmalı.
