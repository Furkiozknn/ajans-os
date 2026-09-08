# RouteLLM

## Kimlik
repo: `lm-sys/RouteLLM` (README urls, `pyproject.toml:32` `"Homepage" = "https://github.com/lm-sys/RouteLLM"`) · yıldız: klondan doğrulanamadı (internet erişimi yok) · son push: `2024-08-10T12:10:15-07:00` (`git log -1 --format=%cI`, yerel klon) · lisans: Apache-2.0 (`LICENSE:1-3`) · dil: Python (`pyproject.toml:10` `classifiers = ["Programming Language :: Python :: 3"]`, sürüm `pyproject.toml:7` `version = "0.2.0"`).
canlılık: **TARİHÎ REFERANS — son push 2024-08-10, bugün (2026-09-08) itibarıyla ~760 gün önce**, 90 günlük eşiğin çok üzerinde. Depo aktif geliştirilmiyor gibi görünüyor; aşağıdaki tüm bulgular bu tarihte donmuş bir kod tabanına dayanıyor.

## Çözdüğü problem
İki model arasında (bir "güçlü/pahalı" model ve bir "zayıf/ucuz" model) her isteği, o istek için güçlü modelin kazanma olasılığını tahmin eden bir yönlendirici (router) ile birine yönlendirerek maliyeti düşürüp kaliteyi mümkün olduğunca koruma çerçevesi. README'nin motivasyon bölümü: "we focus on routing between 2 models: a stronger, more expensive model and a cheaper but weaker model" (`README.md:119`).

## Mimari
Beş yönlendirici sınıfı tek bir soyut arayüzü (`Router.calculate_strong_win_rate`) uygular; `Controller` bunlardan birini seçip 0-1 arası bir eşik (threshold) ile karşılaştırıp güçlü/zayıf model adını döndürür, sonra `litellm.completion`'a o model adıyla gerçek isteği yapar.

```
İstek (messages) ──► Controller.completion()
                        │  model="router-mf-0.1159" formatını parse eder
                        │  (Controller._parse_model_name, routellm/controller.py:93-103)
                        ▼
                 Router[router_adı].route(prompt, threshold, ModelPair)
                        │  calculate_strong_win_rate(prompt) >= threshold ?
                        │  (routellm/routers/routers.py:41-45)
                        ▼
              strong_model_adı  veya  weak_model_adı  (düz string)
                        ▼
                 litellm.completion(model=..., **kwargs)   [routellm/controller.py:153]
                        ▼
              Gerçek sağlayıcıya (OpenAI/Anyscale/…) HTTP çağrısı — litellm kütüphanesi içinde
```

## Klasör yapısı
- `routellm/controller.py` — `Controller`: OpenAI istemcisiyle aynı arayüz (`chat.completions.create`), model adını `router-<isim>-<eşik>` biçiminden ayrıştırıp yönlendirici seçer, sonra `litellm` ile gerçek çağrıyı yapar.
- `routellm/routers/routers.py` — beş `Router` alt sınıfı (`RandomRouter`, `MatrixFactorizationRouter`, `CausalLLMRouter`, `BERTRouter`, `SWRankingRouter`) ve `ROUTER_CLS` kayıt tablosu.
- `routellm/routers/matrix_factorization/` — `model.py`: `MFModel` (matris çarpanlarına ayırma modeli) ve sabit `MODEL_IDS` sözlüğü; `train_matrix_factorization.py` (kapsam dışı, okunmadı).
- `routellm/routers/causal_llm/` — LLM tabanlı sınıflandırıcı (`model.py`, `configs.py`, `llm_utils.py`, `prompt_format.py`).
- `routellm/routers/similarity_weighted/` — Elo/benzerlik ağırlıklı yönlendirici yardımcıları (`utils.py`) ve gömme üretim betiği (`generate_embeddings.py`, okunmadı).
- `routellm/calibrate_threshold.py` — eşik kalibrasyon CLI'ı.
- `routellm/openai_server.py`, `routellm/evals/` — kapsam dışı bırakıldı (görev talimatına göre).
- `config.example.yaml` — dört öğrenilmiş yönlendirici için Hugging Face üzerindeki hazır kontrol noktası (checkpoint) yollarını tanımlıyor.

## Ajan tasarımı
uygulanamaz — RouteLLM bir çoklu-ajan çerçevesi değil, tek bir ikili sınıflandırma kararı (güçlü mü zayıf mı) veren bir yönlendirme kütüphanesi. "Ajan" kavramı yok; `Router` sınıfları birer karar fonksiyonu, konuşma durumu veya araç çağırma yeteneği taşımıyor.

## Orkestrasyon / iş akışı modeli
Orkestrasyon yok — tek adımlı senkron karar: `Router.route()` bir olasılık hesaplar, eşikle karşılaştırır, iki sabit model isminden birini döndürür (`routellm/routers/routers.py:41-45`). Çok turlu konuşmalarda bile sadece son mesaj kullanılır: `Controller._get_routed_model_for_completion` içinde `prompt = messages[-1]["content"]` ve yorum "Our current routers were only trained on first turn data, so more research is required here." (`routellm/controller.py:108-110`).

## Durum ve bellek
Yönlendiriciler durumsuz karar verir (her çağrı bağımsız); tek "hafıza" `Controller.model_counts` — sadece hangi router'ın hangi modele kaç kez yönlendirdiğini sayan bir `defaultdict` (`routellm/controller.py:56`, `routellm/controller.py:113`), izleme/muhasebe amaçlı, karara geri beslenmiyor.

## Hata yönetimi
Minimal ve giriş-doğrulama odaklı: `Controller._validate_router_threshold` bilinmeyen router adında veya eşik `[0,1]` dışındaysa `RoutingError` fırlatır (`routellm/controller.py:79-91`); model adı `router-...` formatında değilse veya eşik `float`'a çevrilemezse yine `RoutingError` (`routellm/controller.py:93-103`). `CausalLLMRouter.calculate_strong_win_rate` içinde model çıktısı `None` ise güvenli tarafta kalıp güçlü modele yönlendiriyor: `if output is None: # Route to strong model if output is invalid \n return 1` (`routellm/routers/routers.py:98-100`). Diğer router'larda (mf, sw_ranking, bert) modelin/gömme API'sinin başarısız olma durumu için özel bir try/except yok — hata olduğu gibi yukarı fırlar.

## Genişletilebilirlik
README açıkça yeni router ekleme yolunu tarif ediyor: `Router` soyut sınıfını uygulayıp `ROUTER_CLS` sözlüğüne eklemek yeterli (`README.md:198-202`, kayıt noktası `routellm/routers/routers.py:256-262`). Tek zorunlu metot `calculate_strong_win_rate(prompt)`.

## Güçlü yönler (kanıtlı)
- Router arayüzü gerçekten dar ve tutarlı: beş farklı yaklaşım (rastgele, matris çarpanlarına ayırma, ince ayarlı causal LLM, BERT sınıflandırıcı, benzerlik ağırlıklı Elo) hepsi tek bir `calculate_strong_win_rate(prompt) -> float` sözleşmesine indirgenmiş (`routellm/routers/routers.py:32-45`), bu da karşılaştırmayı ve değiştirmeyi kolaylaştırıyor.
- `Controller`, OpenAI istemci arayüzünü birebir taklit ediyor (`self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.completion, acreate=self.acompletion))`, `routellm/controller.py:72-77`) — mevcut OpenAI tabanlı kod tabanlarına drop-in entegrasyon sağlıyor, mimari tasarımı basit ve okunur.
- Eşik kalibrasyonu ayrı, tekrarlanabilir bir CLI adımına ayrılmış (`routellm/calibrate_threshold.py`), gerçek dünya trafiğine göre eşik seçme fikri net bir arayüzle sunuluyor.

## Zayıf yönler (kanıtlı)
- `mf` (önerilen, README'de "we recommend the `mf` router", `README.md:134`) ve `sw_ranking` router'ları, gömme (embedding) üretmek için doğrudan `OpenAI()` istemcisine bağımlı: `OPENAI_CLIENT = OpenAI()` modül seviyesinde sabit (`routellm/routers/similarity_weighted/utils.py:11`), `MFModel.forward` içinde `OPENAI_CLIENT.embeddings.create(...)` çağrısı (`routellm/routers/matrix_factorization/model.py:112-116`). README bunu doğruluyor: "regardless of the model pair used, an `OPENAI_API_KEY` will currently still be required to generate embeddings for the `mf` and `sw_ranking` routers" (`README.md:103`). Yani "sağlayıcıdan bağımsız yönlendirme" iddiası kısmen yanıltıcı — karar mekanizmasının kendisi OpenAI'ye sabitlenmiş.
- Model kimliği sabit ve kapalı bir sözlüğe (`MODEL_IDS`, 64 giriş, `routellm/routers/matrix_factorization/model.py:6-71`) bağlı; `MatrixFactorizationRouter.__init__` bu sözlükten `strong_model_id`/`weak_model_id` arıyor (`routellm/routers/routers.py:235-236`) — sözlükte olmayan bir model adı verilirse `KeyError` ile çöker (kodda yakalanmıyor).
- Hata toleransı tutarsız: `causal_llm` router geçersiz çıktıda güvenli tarafa (güçlü model) düşerken, `mf`/`sw_ranking`/`bert` için eşdeğer bir koruma yok.

## Puan (1–5)
olgunluk: 2 — 2024-08 sonrası donmuş, PyPI paketi var ama bakım sinyali yok.
mimari netlik: 4 — tek metotlu router sözleşmesi ve ince Controller son derece anlaşılır.
genişletilebilirlik: 3 — yeni router eklemek kolay dokümante edilmiş, ama yeni *model* eklemek `mf`/`bert`/`causal_llm` için pratikte sabit checkpoint'lere/model kimlik tablosuna bağımlı (aşağıya bkz.).
güvenilirlik ilkelleri: 2 — retry/circuit breaker/timeout kodda görünmüyor (litellm'e devredilmiş olabilir ama routellm katmanında yok); router hata yönetimi tutarsız.
gözlemlenebilirlik: 1 — `model_counts` sayaç dışında log/metrik/trace yok.
güvenlik duruşu: 2 — API anahtarları ortam değişkeninden okunuyor (standart), ama girdi/prompt sanitizasyonu veya rate-limit gibi bir katman yok; bu kapsam dışı olabilir çünkü RouteLLM bir kütüphane, servis değil.

## Alınacak fikir
- **Tek metotlu router sözleşmesi** (`calculate_strong_win_rate(prompt) -> float [0,1]`): ADR-000'daki "Model Router" sınırını somutlaştırmak için iyi bir minimal arayüz örneği — karar mantığı ile çağrı mantığı (`Controller.completion`) net ayrılmış.
- **Eşiği ayrı bir kalibrasyon adımına çıkarma fikri** (`routellm/calibrate_threshold.py`): maliyet/kalite dengesini kod içine gömmek yerine veri setinden türetilen tek bir sayıya indirgemek — İ5'in "gözlem ve ekonomi" izni için maliyet-kalite eşiği kavramı olarak faydalı, uygulaması (Chatbot Arena'ya bağımlı kod) değil, fikri alınabilir.
- **Model adı formatı `router-[isim]-[eşik]`** (`routellm/controller.py:93-103`): yönlendirici seçimini ve eşiği tek bir string alanına kodlamak, OpenAI uyumlu API'lerle geriye dönük uyumluluğu koruyan zarif bir hack — bir "sürücü" (router) seçimini mevcut `model` alanına sızdırmak istenirse referans alınabilir.

## Alınmayacak
- **OpenAI'ye sabit gömme bağımlılığı** (`OPENAI_CLIENT = OpenAI()`, `routellm/routers/similarity_weighted/utils.py:11`): ADR-000 K4 ile doğrudan çelişir — tek sağlayıcıya modül seviyesinde sabitlenmiş bir istemci, "hiçbir LLM sağlayıcısına doğrudan bağlanmaz" ilkesini ihlal eden tam örnek. Alınmamalı.
- **Kapalı, sabit `MODEL_IDS` tablosu** (`routellm/routers/matrix_factorization/model.py:6-71`): yeni/özel model eklemek `KeyError` ile çöküyor; ajans-os'ta model kataloğu Model Router'ın kendi sorumluluğu olmalı, RouteLLM'deki gibi eğitim zamanında donmuş bir sözlük olmamalı.
- **Sadece son mesajı yönlendirme kararına sokma** (`routellm/controller.py:108-110`, yorumda kendileri de "more research is required" diyor): çok turlu ajan konuşmaları için yetersiz bir basitleştirme, olduğu gibi alınmamalı.

## ADR-000 K4 için kanıt
K4: "Sistem hiçbir LLM sağlayıcısına doğrudan bağlanmaz. Tek bir Model Router sınırı vardır."

RouteLLM'in kendisi bu sınırı **kısmen** somutlaştırıyor ama iki noktada ihlal ediyor:

1. **Router sınırı gerçek ama sağlayıcıya sabitlenmiş bir alt bağımlılık taşıyor.** `Controller.completion` tüm gerçek model çağrılarını tek bir yerden, `litellm.completion(...)` üzerinden yapıyor (`routellm/controller.py:153`) — bu, "tek Model Router sınırı" fikrine uygun bir tasarım. Ama yönlendirme **kararının kendisi** (hangi modele gideceği) `mf` ve `sw_ranking` router'larında OpenAI'nin gömme API'sine doğrudan bağlı: `OPENAI_CLIENT = OpenAI()` (`routellm/routers/similarity_weighted/utils.py:11`) ve README bunu teyit ediyor: "an `OPENAI_API_KEY` will currently still be required to generate embeddings for the `mf` and `sw_ranking` routers" (`README.md:103`). Yani "tek sağlayıcıya bağlanmama" ilkesi, çağrı katmanında tutulsa da, karar katmanında (router içinde) kırılıyor — Model Router'ın kendisi gizli bir OpenAI bağımlılığı taşıyor.

2. **Karar model çiftine (eğitilmiş checkpoint'e) bağlı, tam model-agnostik değil.** `MatrixFactorizationRouter.__init__`, verilen `strong_model`/`weak_model` string'lerini sabit `MODEL_IDS` sözlüğünden (`routellm/routers/matrix_factorization/model.py:6-71`, 64 sabit giriş, ör. `"gpt-4-1106-preview": 24`, `"mixtral-8x7b-instruct-v0.1": 36`) kimliğe çeviriyor (`self.strong_model_id = MODEL_IDS[strong_model]`, `routellm/routers/routers.py:235-236`). Bu sözlükte olmayan bir model adı verilirse (ör. yeni çıkan bir model) yakalanmamış bir `KeyError` fırlar. README bunu "generalizes well" diye çerçeveliyor ve "you can replace the model pair used for routing without having to retrain these models" diyor (`README.md:182`) — ama bu iddia sadece **MODEL_IDS içindeki 64 model arasında** geçerli; tablo dışı bir modele geçmek retrain gerektirir (yeni bir `torch.nn.Embedding` satırı eğitilmesi lazım, `self.P = torch.nn.Embedding(num_models, dim)`, `routellm/routers/matrix_factorization/model.py:86`). `causal_llm` ve `bert` router'ları ise doğrudan bir prompt sınıflandırıcısı (Hugging Face checkpoint) kullandığı için model çiftinden bağımsız çalışıyor — o ikisi gerçek anlamda model-agnostik.

**Sonuç:** RouteLLM'in Model Router mimarisi (tek çağrı noktası fikri) K4'e ilham verebilir, ama `mf`/`sw_ranking` router'larının somut uygulaması hem sağlayıcı bağımsızlığını (OpenAI gömme zorunluluğu) hem de tam model-agnostikliği (sabit `MODEL_IDS` kataloğu) ihlal ediyor. `causal_llm`/`bert` router'ları prompt'u doğrudan sınıflandırdığı için bu iki sorunu taşımıyor — ajans-os için örnek alınacaksa bu ikisinin yaklaşımı (harici gömme API'sine bağımlı olmayan, model kimliğine değil sadece prompt içeriğine bakan sınıflandırıcı) K4'e daha uygun.

## Dürüstlük
- `examples/`, `tests/`, `notebooks/`, `docs/`, `benchmarks/`, `assets/`, `routellm/evals/`, `routellm/openai_server.py` kapsam dışı bırakıldı, görev talimatı gereği okunmadı — bu dosyalardaki (ör. `openai_server.py`'deki FastAPI servis katmanı, `evals/` içindeki gerçek benchmark sonuçları) davranış bu raporda değerlendirilmedi.
- `routellm/routers/causal_llm/model.py`, `configs.py`, `llm_utils.py`, `prompt_format.py` ve `routellm/routers/matrix_factorization/train_matrix_factorization.py` içeriği detaylı okunmadı — sadece `routers.py` üzerinden bu router'ların `__init__`/`calculate_strong_win_rate` çağrı imzaları incelendi. `CausalLLMClassifier`'ın iç mimarisi (ör. tam olarak nasıl bir sınıflandırma başlığı kullandığı) doğrulanmadı.
- Yıldız sayısı, açık issue sayısı, katkıda bulunan sayısı gibi GitHub metrikleri **doğrulanamadı** — internet erişimi yok, sadece yerel klon incelendi. Uydurulmadı.
- "Maliyet %85 azaltma, GPT-4 performansının %95'i" iddiası (`README.md:14`) **koddan doğrulanmadı** — bu sayılar makaleye/README'ye ait, `routellm/` altında bu yüzdeleri hesaplayan bir kod yolu görülmedi (yalnızca `routellm/evals/` altında olabilir, kapsam dışı bırakıldığı için kontrol edilmedi). Görev talimatındaki soru 5'in cevabı: maliyet/tasarruf hesaplaması muhtemelen `benchmarks/`/`evals/` içinde yapılıyor, ama bu rapor kapsamında **doğrulanamadı** — sadece iddia olarak README'de var, kod içinde teyit edilmedi.
- `sw_ranking` router'ının Elo/tier hesaplama algoritması (`compute_elo_mle_with_tie`, `compute_tiers`) satır satır incelenmedi, sadece imzası ve genel akışı okundu.
