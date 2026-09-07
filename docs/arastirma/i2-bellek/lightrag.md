# LightRAG

## Kimlik
HKUDS/LightRAG · 39.452 yıldız · 302 watcher · son push 2026-09-07 · MIT · Python · haftalık PyPI indirme: doğrulanmadı
Sürüm: `pyproject.toml:7` dinamik (`lightrag/_version.py`), `requires-python = ">=3.10"`.
canlılık: geçti — arşivlenmemiş, son push bugün (2026-09-07), klon HEAD `8287dc3`.
Tohum listesinde **yok** — protokol §2'nin "en az iki listede olmayan aday" kuralına sayılır.
İnceleme kapsamı: `lightrag/operate.py` (6.960 satır), `lightrag/pipeline.py` (7.794), `lightrag/constants.py`, `lightrag/base.py`, `lightrag/utils_graph.py`, `lightrag/prompt.py`, `lightrag/api/auth.py`, `lightrag/kg/` (adapter listesi). Kapsam dışı: `lightrag_webui/` (React arayüz), `lightrag/parser/`, `lightrag/multimodal_context.py`, tekil storage adapter'larının iç kodu.

## Çözdüğü problem
Klasik vektör-RAG'in "ilgili parçaları getir, LLM'e ver" modeli belge sayısı arttıkça ilişkisel soruları (X ile Y arasındaki bağ nedir, bu konunun geneli nedir) cevaplayamaz. LightRAG belgelerden **bilgi grafı** (varlık + ilişki) çıkarıp bunu vektör aramasıyla birleştirir; sorgu anında hem grafı hem metin parçalarını, **sabit bir token bütçesi içinde** birleştirip tek bağlam üretir. Hedef kitle: kendi belge kümesi üzerinde soru-cevap kuran ekipler; ajan belleği için tasarlanmamıştır ama bilgi katmanı (knowledge layer) örneği olarak İ2'ye girer.

## Mimari
İki ayrı boru hattı: **yazma** (belge → graf) ve **okuma** (sorgu → bağlam → cevap).

```
YAZMA (pipeline.py + operate.py)
  belge → doc_status: PENDING
    │ parse (PARSING) → chunk'lama
    │ opsiyonel VLM analizi (ANALYZING)
    │ her chunk için LLM varlık/ilişki çıkarımı (PROCESSING)
    │   prompt: PROMPTS["entity_extraction_system_prompt"] (prompt.py:56)
    │   "gleaning": eksik kalanı sor (entity_continue_extraction, prompt.py:145)
    │ merge_nodes_and_edges (operate.py:3515)
    │   aynı varlığın açıklamaları birleşir → gerekirse LLM özeti
    └ doc_status: PROCESSED | FAILED

OKUMA (operate.py kg_query)
  sorgu → anahtar kelime çıkarımı (LLM)
    │ varlık ve ilişki vektör araması (top_k=40 varsayılan)
    │ ilişkili chunk toplama
    │ TOKEN BÜTÇESİ DAĞITIMI (operate.py:5796-5875)
    └ tek bağlam string'i → cevap LLM'i
```

Depolama dört soyut arayüze bölünmüş (`lightrag/base.py`): `BaseKVStorage`, `BaseVectorStorage`, `BaseGraphStorage`, `DocStatusStorage`. Her biri için birden çok uygulama (`lightrag/kg/`: postgres, neo4j, memgraph, milvus, qdrant, faiss, mongo, opensearch, networkx, nano-vector-db, json dosyası). Depo seçimi `lightrag/kg/factory.py` üzerinden.

## Klasör yapısı
```
lightrag/
├── lightrag.py          LightRAG ana sınıfı: yapılandırma, insert/query giriş noktaları (7.006 satır)
├── pipeline.py          belge işleme kuyruğu, durum makinesi, resume/retry mantığı (7.794 satır)
├── operate.py           çıkarım, birleştirme, sorgu bağlamı kurma — çekirdek algoritmalar (6.960)
├── base.py              storage arayüzleri + DocStatus enum + QueryParam sözleşmesi
├── constants.py         tüm varsayılan eşikler (token bütçeleri, top_k, cosine eşiği)
├── prompt.py            varlık çıkarımı, özetleme, RAG cevabı promptları
├── utils_graph.py       grafı ELLE düzenleme API'si: create/edit/delete/merge entity
├── kg/                  storage adapter aileleri (14 uygulama) + factory
├── api/                 FastAPI sunucusu, auth, routers (document/graph/query/ollama)
├── llm/                 LLM sağlayıcı bağlayıcıları
└── rerank.py            opsiyonel yeniden sıralama

lightrag_webui/          React arayüz (graf görselleştirme, belge yönetimi)
tests/ reproduce/ docs/  test, deney tekrarı, belgeler
k8s-deploy/ docker-*     dağıtım
```

## Bilgi/bellek modeli
Bellek katmanı değil, **bilgi katmanı**: kalıcı olan şey belge kaynaklı varlıklar ve ilişkilerdir. Oturum, kullanıcı veya ajan kavramı yoktur; yalıtım tek bir `workspace` alanıyla yapılır (`lightrag.py:418` — `os.getenv("WORKSPACE", "")`), yani **örnek başına** bir ad alanı, istek başına değil.

Her varlık düğümü bir `description` alanı taşır ve aynı varlık farklı belgelerde geçtikçe açıklamalar `GRAPH_FIELD_SEP = "<SEP>"` ile biriktirilir (`constants.py:49`). Biriken açıklama şişince devreye map-reduce özetleme girer (aşağıda). İlişkilerin bir `weight` değeri vardır ve kanıtsız (elle oluşturulmuş) ilişkiler için taban değer uygulanır: `RELATION_NO_EVIDENCE_SOURCE_IDS = {"manual_creation", "UNKNOWN"}` kanıt sayılmaz (`constants.py:51-54`, `apply_relation_weight_floor` `utils_graph.py:218`). Bu, "insan elle eklediyse bunu LLM'in çıkardığı kanıt gibi ağırlıklandırma" diyen nadir ve doğru bir ayrımdır.

## Bağlam yönetimi
Görev sorusu "bağlam penceresi dolunca ne oluyor?" — LightRAG bu soruya İ2'de incelenen projeler arasındaki **en açık cevabı** veriyor: bağlam bir bütçe olarak modellenmiş ve her sorguda yeniden dağıtılıyor.

`_build_query_context` içinde (`operate.py:5796-5875`):
1. `max_total_tokens` alınır (varsayılan 30.000, `constants.py:61`).
2. Sistem promptu **gerçekten render edilecek şablonla** boş doldurularak ölçülür (`sys_prompt_tokens`). Koddaki yorum bunun neden böyle olduğunu anlatıyor: çağıranın özel şablonu varsa varsayılanla ölçmek bütçeyi yanlış hesaplar (`operate.py:5802-5813`).
3. Graf bağlamı (varlıklar + ilişkiler) ölçülür (`kg_context_tokens`).
4. Sorgu ölçülür, 200 token güvenlik payı ayrılır.
5. Kalan = `available_chunk_tokens = max_total_tokens - (sys + kg + query + buffer)` (`operate.py:5864`).
6. Metin parçaları bu **dinamik** limite göre kırpılır (`process_chunks_unified(..., chunk_token_limit=available_chunk_tokens)`).

Graf tarafının kendi alt bütçeleri var: `max_entity_tokens` 6.000, `max_relation_tokens` 8.000 (`constants.py:59-60`), ikisi de `atruncate_list_by_token_size` ile uygulanıyor (`operate.py:5541-5560`). Yani taşma durumunda **önce metin parçaları kısılır, graf çekirdeği korunur** — açık ve savunulabilir bir öncelik sırası.

Yazma tarafında ikinci bir mekanizma: **açıklama sıkıştırma.** `_handle_entity_relation_summary` (`operate.py:373`) bir varlığın biriken açıklamalarını map-reduce ile özetler: açıklama sayısı `force_llm_summary_on_merge`'in (varsayılan 8, `constants.py:30`) altında ve toplam token `summary_max_tokens`'ın (1.200) altındaysa LLM çağrılmaz, açıklamalar birleştirilir; üstündeyse LLM özetler; `summary_context_size`'ı (12.000) aşarsa parçalara bölünüp özyinelemeli özetlenir (`operate.py:439-470`). Bu, "bellek dolunca ne olur" sorusunun ikinci cevabıdır: **eski içerik silinmez, kayıplı biçimde sıkıştırılır.** Bedeli açık — özetleme geri döndürülemez, orijinal açıklama metinleri kaybolur; yalnızca kaynak chunk id'leri (`source_id`) izlenebilirlik bırakır.

Çıkarım girdisi de sınırlı: `max_extract_input_tokens` 20.480 (`constants.py:38`), bölüm başlığı izi 256 token'ı aşarsa `first → … → leaf` biçimine çöker (`constants.py:43`).

## Bilgi yazma yetkisi ve güvenlik
**Kim yazar:** varsayılan yol LLM'dir. Hangi varlığın ve ilişkinin grafa gireceğine çıkarım promptu karar verir (`prompt.py:56`, `prompt.py:127`) ve "gleaning" adımıyla LLM'e bir kez daha "kaçırdığın var mı" diye sorulur (`prompt.py:145`). Çıktı doğrudan grafa yazılır; insan onayı kapısı **yoktur**.

Ama LightRAG, incelenen projeler arasında insan müdahalesine en açık yüzeye sahip olan: `lightrag/utils_graph.py` tam bir elle düzenleme API'si sunar — `acreate_entity` (1680), `aedit_entity` (1153), `adelete_by_entity` (396), `acreate_relation` (1851), `aedit_relation` (1440), `adelete_by_relation` (603), `amerge_entities` (2786). Bunlar REST üzerinden de açık (`api/routers/graph_routes.py`) ve WebUI'de graf editörüne bağlı. Yani model şu: **LLM yazar, insan sonradan düzeltir** (post-hoc denetim), "insan önce onaylar" (pre-hoc kapı) değil. Elle yazılan verinin ayrı işaretlenmesi (`manual_creation` kaynak id'sinin kanıt sayılmaması, `constants.py:54`) bu modelin bilinçli tasarlandığını gösteriyor.

**PII:** hiçbir şey yok. `grep -rni "pii|redact|anonymi" --include=*.py lightrag/` → sıfır eşleşme. Belgeler ne içeriyorsa graf da onu içerir; varlık çıkarımı kişi adlarını zaten birinci sınıf varlık tipi olarak hedefler (`prompt.py` örnekleri: person, organization). Silme tarafı mem0'dan daha temiz: `adelete_by_entity` düğümü, kenarlarını ve vektör kayıtlarını birlikte siler ve yetim izleri süpürür (`_sweep_orphan_tracking_row`, `utils_graph.py:370`) — yani bir kişiyi grafdan çıkarmak gerçekten mümkün. Ancak kaynak belge ve chunk'lar KV deposunda kalır; "unutulma" için belgenin de silinmesi gerekir.

**Kimlik doğrulama:** `AUTH_ACCOUNTS` ayarlanmamışsa sunucu **guest moduna** düşer ve varsayılan JWT gizli anahtarını kullanır — kod bunu açıkça uyarı olarak logluyor (`api/auth.py:57-63`). Yani varsayılan kurulum kimliksiz yazmaya açıktır. Ayarlandığında da yetki tanesi kaba: kullanıcı:parola çiftleri var, rol yalnızca `user`/`guest` (`api/auth.py:157-167`); "hangi kullanıcı hangi workspace'e yazabilir" diye bir model yok, çünkü workspace istek başına değil süreç başına.

## RAG ve bilgi katmanı
LightRAG'in asıl konusu bu. Dört sorgu modu (`base.py` `QueryParam.mode`): `naive` (saf vektör), `local` (varlık merkezli), `global` (ilişki merkezli), `hybrid`/`mix` (graf + vektör birleşimi). Sorgu önce LLM ile anahtar kelimelere ayrılır (yüksek seviye / düşük seviye), sonra bu kelimeler varlık ve ilişki vektör indekslerinde aranır.

İzlenebilirlik güçlü: her chunk'a `reference_id` atanır ve bağlamın sonuna kaynak listesi eklenir (`generate_reference_list_from_chunks`, `operate.py:5884`), böylece cevaptaki bilginin hangi dosyadan geldiği gösterilebilir. `only_need_context` / `only_need_prompt` hata ayıklama anahtarları gerçek sorgunun göreceği bağlamı **birebir** önizler; kod, bütçe hesabının bu yollarda da uygulandığını ve nedenini açıkça yazıyor (`operate.py:5849-5857`) — operatörün önizlemeye bakıp yanlış boyutlandırma yapmaması için.

## Ajan tasarımı
Ajan kavramı yok. LightRAG bir kütüphane/servis olarak çağrılır; `lightrag/tools/` altında MCP benzeri yardımcılar var ama ajan sözleşmesi, yetenek tanımı veya araç izin modeli bulunmuyor. Bizim mimarimizde LightRAG'in karşılığı bir ajan değil, **Knowledge Layer bileşenidir**.

## Hata yönetimi
Bu projenin en olgun tarafı. Belge işleme gerçek bir durum makinesi (`DocStatus`, `base.py:1028`): PENDING → PARSING → ANALYZING → PROCESSING → PROCESSED | FAILED.

- **Otomatik kurtarma yalnızca ölü-süreç yetimleri için:** `_AUTO_RESUME_DOC_STATUSES = (PENDING, PROCESSING, PARSING, ANALYZING)` (`pipeline.py:162-168`). Koddaki yorum FAILED'ın kasten dışarıda bırakıldığını söylüyor: gerçekten başarısız olmuş belge yalnızca **açık bir elle istek** üzerine yeniden denenir, alakasız bir yüklemenin yan etkisi olarak değil.
- Elle yeniden deneme ayrı bir faz olarak modellenmiş (EXCLUSIVE_RESET): kuyruk dondurulur, FAILED→PENDING geçişi hiçbir worker çalışmazken sayfa sayfa yapılır (`pipeline.py:257-281`, `1309`). Eşzamanlı yükleme isteği 409 ile reddedilir (`pipeline.py:800-815`).
- Bu, incelenen projeler arasında "rollback gerçekten geri alıyor mu yoksa yeniden mi deniyor" sorusuna en dürüst cevabı veren tasarım: LightRAG rollback iddia etmez, **yeniden denemeyi kontrollü hâle getirir** ve hangi durumun otomatik hangisinin elle olduğunu kodda gerekçesiyle yazar.
- Grafa yazma atomik değil ama sarmalanmış: `_commit_graph_or_raise` (`utils_graph.py:348`), `_persist_graph_updates` (`utils_graph.py:271`) ve iptal sırasında yarım kalmayı önleyen `_finish_deferring_cancellation` (`utils_graph.py:314`).
- Metin sanitizasyonu savunma amaçlı: GraphML XML'ini bozan kontrol karakterleri yazmadan önce temizleniyor (`sanitize_text_for_encoding`, `operate.py:411`) — gerçek bir üretim yarasının izi.

## Genişletilebilirlik
Yeni depolama arka ucu eklemek: `base.py`'deki dört arayüzden birini uygulayıp `kg/factory.py`'ye kaydetmek — iki dosya. 14 hazır uygulama bunun gerçekten çalıştığının kanıtı. LLM/embedding sağlayıcısı `llm/` altında benzer şekilde takılıyor, `rerank.py` ayrı bir uzatma noktası.

Çekirdek algoritma tarafı ise devasa dosyalarda toplanmış: `operate.py` 6.960, `pipeline.py` 7.794, `lightrag.py` 7.006 satır. Sorgu bağlamı kurma mantığını değiştirmek bu dosyaların içine girmeyi gerektirir; modüler değildir.

## Güçlü yönler (kanıtlı)
- **Gerçek token bütçesi dağıtımı** (`operate.py:5796-5875`) — sistem promptu, graf, sorgu ve tampon ölçülüp kalan metin parçalarına veriliyor. İncelenen projeler arasında bunu yapan tek proje.
- **Bileşen bazlı alt bütçeler ve öncelik** (`constants.py:59-61`, `operate.py:5541-5560`) — taşmada graf korunur, metin kısılır.
- **Kayıplı sıkıştırmanın eşiğe bağlanması** (`operate.py:373-470`) — LLM özetleme "her zaman" değil, açıklama sayısı ve token eşiği aşılınca; ucuz durumda LLM hiç çağrılmıyor.
- **Durum makinesi + kasıtlı kurtarma politikası** (`pipeline.py:154-168`) — hangi durumun otomatik kurtarılacağı ve FAILED'ın neden dışarıda olduğu kodda gerekçeli.
- **Kanıtsız (elle eklenmiş) verinin ağırlıklandırmada ayrıştırılması** (`constants.py:51-54`, `utils_graph.py:218`).
- **Kaynak referansı zinciri** — chunk → `reference_id` → dosya yolu (`operate.py:5884`), cevabın kaynağı gösterilebilir.
- **Depolama soyutlaması gerçekten çoklu** — 14 adapter, tek fabrika.

## Zayıf yönler (kanıtlı)
- **Yalıtım süreç başına.** `workspace` bir ortam değişkeni (`lightrag.py:418`); çok kiracılı kullanım için istek başına ad alanı yok.
- **Varsayılan kurulum kimliksiz yazmaya açık** (`api/auth.py:57-63`, guest modu + varsayılan JWT gizli anahtarı).
- **PII için sıfır mekanizma** — arama sonucu boş; üstelik çıkarım promptu kişi varlıklarını hedefliyor.
- **Özetleme geri döndürülemez.** `_handle_entity_relation_summary` orijinal açıklamaları LLM özetiyle değiştirir; özet yanlışsa kaynak metin graf tarafında geri getirilemez (yalnızca chunk'lara dönmek gerekir).
- **Dev dosyalar.** `operate.py`/`pipeline.py`/`lightrag.py` üçü toplam 21.760 satır; çekirdek davranışı değiştirmek riskli.
- **İnsan kapısı sonradan.** Elle düzenleme API'si zengin ama LLM'in yazdığı yanlış bilgi düzeltilene kadar sorgulara karışır.
- **Sorgu başına birden çok LLM çağrısı** (anahtar kelime çıkarımı + cevap, hibrit modda daha fazla) — gecikme ve maliyet tarafı belgelenmemiş.

## Puan (1-5)
- olgunluk: 4 — çok aktif geliştirme, 14 storage adapter'ı, k8s/docker dağıtımı, gerçek üretim yaralarının izleri (sanitizasyon, 409 çakışma yönetimi); tam belgelenmemiş devasa modüller not düşürüyor.
- mimari netlik: 3 — dört storage arayüzü ve iki boru hattı ayrımı net; ama çekirdek mantığın 7.000 satırlık dosyalara yığılması netliği ciddi biçimde düşürüyor.
- genişletilebilirlik: 4 — yeni depo/LLM/reranker takmak iki dosya; çekirdek algoritmayı değiştirmek zor.
- güvenilirlik ilkelleri: 4 — durum makinesi, otomatik yetim kurtarma, kontrollü elle yeniden deneme, iptal sırasında tutarlılık koruması. Atomik işlem (transaction) garantisi yok.
- gözlemlenebilirlik: 3 — `pipeline_metrics.py`, ayrıntılı token dağıtım log'u (`operate.py:5869`), doc_status sorgulanabilir; OpenTelemetry yok.
- güvenlik duruşu: 2 — varsayılan guest modu, süreç başına yalıtım, PII yok. Elle düzenleme API'si ve kanıt ayrımı olumlu ama yetki modeli zayıf.

## Alınacak fikir
- **Bağlam bütçesinin bileşenlere dağıtılması** (`operate.py:5864`) — Context Manager'ımızın çekirdeği bu olmalı: toplam bütçeden sistem promptu, kalıcı bilgi, sorgu ve tampon düşülüp kalan geri getirmeye verilir. "top_k anı döndür" değil, "şu kadar token'lık bağlam kur".
- **Bileşen bazlı alt bütçe + taşmada öncelik sırası** (`constants.py:59-61`) — hangi katmanın önce kısılacağının önceden ve açıkça yazılması. Bizde sıra: sistem sözleşmesi > görev durumu > bilgi katmanı > geçmiş.
- **Bütçenin gerçekten render edilecek şablonla ölçülmesi** (`operate.py:5802-5813`) — tahmini şablonla ölçmek sessizce yanlış hesaplar; ölçüm ile kullanım aynı metinden yapılmalı.
- **Eşiğe bağlı kayıplı sıkıştırma** (`operate.py:439-450`) — ucuz durumda LLM'i hiç çağırmamak, yalnızca eşik aşılınca özetlemek. Bellek sıkıştırmasında varsayılanımız bu olmalı.
- **Otomatik kurtarma ile elle kurtarmanın ayrılması** (`pipeline.py:154-168`) — yetim (ölü süreç) durumları otomatik, gerçek başarısızlık elle. Recovery Manager'ımızda aynı ayrım "sonsuz yeniden deneme döngüsü"nü baştan engeller.
- **Kanıt kaynağının ağırlığa yansıması** (`constants.py:51-54`) — bilgi katmanımızda "LLM çıkardı" ile "insan yazdı" ile "araç doğruladı" farklı güven ağırlıkları taşımalı.
- **Kaynak referans listesi** (`operate.py:5884`) — bağlamın sonuna hangi kaydın nereden geldiğini eklemek; cevabın denetlenebilirliği için ucuz ve etkili.

## Alınmayacak
- **Süreç başına workspace yalıtımı** (`lightrag.py:418`) — çok ajanlı sistemde her ajanın/kiracının ayrı süreç istemesi kabul edilemez; yalıtım istek/çağrı bağlamında olmalı.
- **Varsayılan guest modu** (`api/auth.py:57-63`) — kimlik doğrulaması yapılandırılmamışsa sistem açılmamalı, misafir olarak açılmamalı.
- **Geri döndürülemez özetleme** — özet yazılırken orijinali atmak; bizde sıkıştırma sonucu yeni bir katman olarak yazılmalı, kaynak kayıt (en azından referansıyla) korunmalı.
- **Çekirdek mantığın tek dosyada toplanması** (`operate.py` 6.960 satır) — Faz 4'te modül sınırlarını baştan çizmek için doğrudan karşı örnek.
- **Sorgu başına zorunlu ekstra LLM çağrısı (anahtar kelime çıkarımı)** — her okuma için ek gecikme ve maliyet; bizde geri getirme yolu LLM'siz çalışabilmeli, LLM yalnızca gerektiğinde devreye girmeli.

## Matris cevapları
- saglayici_bagimsiz: evet — `lightrag/llm/` altında çoklu sağlayıcı bağlayıcısı, `rerank.py` ayrı; storage tarafında 14 uygulama (`lightrag/kg/`), hepsi `factory.py` üzerinden seçiliyor. Tek sağlayıcıya bağlı bir çekirdek yol bulunmadı.
- sozlesme_var: kısmen — `base.py` içinde storage arayüzleri ve `QueryParam` net bir iç sözleşme; REST katmanı Pydantic ile makine-okur. Ancak bu bir **ajan** sözleşmesi değil, veri erişim sözleşmesidir; ajan kavramı projede yok. Bu yüzden "kısmen".
- insan_kapisi: kısmen — yazmadan önce onay yok (LLM çıkarımı doğrudan grafa yazılıyor), ama yazdıktan sonra tam kapsamlı elle düzeltme API'si var (`utils_graph.py`: create/edit/delete/merge entity ve relation) ve elle eklenen veri kanıt olarak ayrı ağırlıklandırılıyor (`constants.py:51-54`). Ayrıca FAILED belgelerin yeniden denenmesi **yalnızca** elle istekle başlar (`pipeline.py:159-168`). Kapı önce değil sonra olduğu için "evet" değil.
- checkpoint: evet — `DocStatus` durum makinesi (`base.py:1028-1040`) belge işlemenin nerede kaldığını kalıcı olarak tutar; süreç ölürse PROCESSING/PARSING/ANALYZING'de kalan belgeler bir sonraki koşuda otomatik devralınır (`pipeline.py:162-168`).
